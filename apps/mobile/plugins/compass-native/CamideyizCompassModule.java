package biz.camideyiz.app.compass;

import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * Fused, tilt-aware true-north compass for the Qibla screen.
 *
 * expo-location's Android heading is raw accelerometer+magnetometer through
 * getOrientation at SENSOR_DELAY_NORMAL with a ~2° send gate: jittery, laggy,
 * no tilt or interference signal, and its true north can turn negative where
 * declination is negative. This module instead reads TYPE_ROTATION_VECTOR
 * (sensor-hub fusion of gyroscope, accelerometer and magnetometer) and adds:
 *  - the sensor's own heading-error estimate (values[4], radians) → "±N°";
 *  - device tilt from horizontal (top-edge heading is only meaningful flat);
 *  - measured magnetic field strength vs. the WGS84/WMM expected strength at
 *    the user's GPS fix → magnet / metal interference detection;
 *  - declination from the SAME fresh GPS fix the Qibla bearing uses.
 * Sensors are delivered on a dedicated HandlerThread (never the UI thread),
 * events are throttled to ~30 Hz and only sent on a meaningful change.
 * No location or sensor data is stored or uploaded.
 */
public final class CamideyizCompassModule extends ReactContextBaseJavaModule
    implements SensorEventListener {
  static final String EVENT="CamideyizCompass";
  private static final long MIN_EMIT_MS=33;      // ≈30 Hz ceiling
  private static final long HEARTBEAT_MS=400;    // keeps JS freshness alive
  private static final float MIN_DELTA_DEG=0.15f;

  private final SensorManager sensors;
  private HandlerThread thread;
  private Handler handler;
  private Sensor rotation;
  private Sensor magnetometer;
  private String source="none";
  private boolean running=false;

  private final float[] matrix=new float[9];
  private final float[] vector4=new float[4];
  private volatile GeomagneticField field;
  private float fieldUT=-1f;
  private int magAccuracy=-1;
  private int rotationAccuracy=-1;
  private long lastEmit=0;
  private float lastHeading=Float.NaN;
  private int lastQuality=-2;

  public CamideyizCompassModule(ReactApplicationContext context){
    super(context);
    sensors=(SensorManager)context.getSystemService(Context.SENSOR_SERVICE);
    if(sensors!=null){
      rotation=sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
      source="rotation-vector";
      if(rotation==null){
        // No gyroscope fusion available: magnetometer+accelerometer fusion.
        rotation=sensors.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        source=rotation==null?"none":"geomagnetic-rotation-vector";
      }
      magnetometer=sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
    }
  }

  @Override public String getName(){return "CamideyizCompass";}

  @ReactMethod public void getCapabilities(Promise promise){
    WritableMap map=Arguments.createMap();
    map.putBoolean("supported",rotation!=null);
    map.putString("source",source);
    map.putBoolean("magnetometer",magnetometer!=null);
    promise.resolve(map);
  }

  /** Same GPS fix as the Qibla bearing → consistent declination. */
  @ReactMethod public void setLocation(double latitude,double longitude,double altitude){
    if(!Double.isFinite(latitude)||!Double.isFinite(longitude)||
       Math.abs(latitude)>90||Math.abs(longitude)>180)return;
    double alt=Double.isFinite(altitude)?altitude:0;
    field=new GeomagneticField((float)latitude,(float)longitude,(float)alt,
        System.currentTimeMillis());
  }

  @ReactMethod public synchronized void start(Promise promise){
    if(sensors==null||rotation==null){
      promise.reject("COMPASS_UNAVAILABLE","Rotation vector sensor unavailable");
      return;
    }
    if(!running){
      thread=new HandlerThread("CamideyizCompass");
      thread.start();
      handler=new Handler(thread.getLooper());
      lastEmit=0;lastHeading=Float.NaN;lastQuality=-2;
      sensors.registerListener(this,rotation,SensorManager.SENSOR_DELAY_GAME,handler);
      if(magnetometer!=null)
        sensors.registerListener(this,magnetometer,SensorManager.SENSOR_DELAY_UI,handler);
      running=true;
    }
    promise.resolve(source);
  }

  @ReactMethod public synchronized void stop(){
    if(!running)return;
    running=false;
    if(sensors!=null)sensors.unregisterListener(this);
    if(thread!=null){thread.quitSafely();thread=null;handler=null;}
    fieldUT=-1f;magAccuracy=-1;rotationAccuracy=-1;
  }

  // Required by NativeEventEmitter on the JS side.
  @ReactMethod public void addListener(String eventName){}
  @ReactMethod public void removeListeners(double count){}

  @Override public void invalidate(){
    stop();
    super.invalidate();
  }

  @Override public void onAccuracyChanged(Sensor sensor,int accuracy){
    if(sensor==magnetometer)magAccuracy=accuracy;
    else if(sensor==rotation)rotationAccuracy=accuracy;
  }

  @Override public void onSensorChanged(SensorEvent event){
    if(!running)return;
    if(event.sensor==magnetometer){
      float x=event.values[0],y=event.values[1],z=event.values[2];
      float strength=(float)Math.sqrt(x*x+y*y+z*z);
      // Light smoothing: interference is a sustained condition, not a spike.
      fieldUT=fieldUT<0?strength:fieldUT+(strength-fieldUT)*0.2f;
      magAccuracy=event.accuracy;
      return;
    }
    if(event.sensor!=rotation)return;
    rotationAccuracy=event.accuracy;
    try{
      SensorManager.getRotationMatrixFromVector(matrix,event.values);
    }catch(IllegalArgumentException samsungQuirk){
      // Some devices send 5 values that the API rejects; use the first four.
      System.arraycopy(event.values,0,vector4,0,4);
      SensorManager.getRotationMatrixFromVector(matrix,vector4);
    }
    // Device axes in world (East, North, Up) are the matrix columns. The
    // phone's TOP edge is device +Y: its horizontal projection is the heading.
    double east=matrix[1],north=matrix[4];
    double horizontal=Math.hypot(east,north);
    float tilt=(float)Math.toDegrees(Math.acos(Math.max(-1,Math.min(1,matrix[8]))));
    float magnetic=horizontal<1e-3?Float.NaN
        :(float)((Math.toDegrees(Math.atan2(east,north))+360)%360);
    GeomagneticField geo=field;
    float declination=geo==null?Float.NaN:geo.getDeclination();
    float heading=Float.isNaN(magnetic)||Float.isNaN(declination)?Float.NaN
        :(magnetic+declination+360f)%360f;
    float accuracyDeg=-1f;
    if(source.equals("rotation-vector")&&event.values.length>4&&event.values[4]>=0)
      accuracyDeg=(float)Math.toDegrees(event.values[4]);
    int quality=magAccuracy>=0?magAccuracy:rotationAccuracy;

    long now=SystemClock.elapsedRealtime();
    if(now-lastEmit<MIN_EMIT_MS)return;
    float reference=Float.isNaN(heading)?magnetic:heading;
    boolean moved=Float.isNaN(lastHeading)!=Float.isNaN(reference)||
        (!Float.isNaN(reference)&&Math.abs(((reference-lastHeading+540f)%360f)-180f)>=MIN_DELTA_DEG);
    if(!moved&&quality==lastQuality&&now-lastEmit<HEARTBEAT_MS)return;
    lastEmit=now;lastHeading=reference;lastQuality=quality;

    ReactApplicationContext context=getReactApplicationContext();
    if(!context.hasActiveReactInstance())return;
    WritableMap map=Arguments.createMap();
    map.putDouble("trueHeading",Float.isNaN(heading)?-1:heading);
    map.putDouble("magHeading",Float.isNaN(magnetic)?-1:magnetic);
    map.putInt("quality",quality);
    map.putDouble("accuracyDeg",accuracyDeg);
    map.putDouble("tiltDeg",tilt);
    map.putDouble("fieldUT",fieldUT);
    map.putDouble("expectedUT",geo==null?-1:geo.getFieldStrength()/1000.0);
    map.putString("source",source);
    map.putDouble("timestamp",System.currentTimeMillis());
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(EVENT,map);
  }
}
