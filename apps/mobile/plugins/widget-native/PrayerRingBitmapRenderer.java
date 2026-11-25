package biz.camideyiz.app.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.util.LruCache;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Native circular prayer clock for RemoteViews, drawn like the app's home
 * dial: six true-length sectors in the prayer colours, turned so the CURRENT
 * time sits at the top under a gold marker, with a gold rim and hour ticks.
 * Sectors come exclusively from published clock boundaries. No astronomical
 * calculation, JS timer or network; the scheduler re-renders it on a
 * non-wakeup tick so it turns with the clock while the screen is on.
 */
public final class PrayerRingBitmapRenderer {
  // The home dial's PRAYER_COLORS: İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı.
  private static final int[] COLORS={
      0xFF3593B5,0xFFD69E44,0xFF1EAFB0,0xFF10B981,0xFFDA7049,0xFF7162BB
  };
  // Every turn is a new bitmap; the cache only shares one pass between the
  // mini and square rings (same SMALL size), so it holds a few bitmaps.
  private static final LruCache<String,Bitmap> CACHE=new LruCache<String,Bitmap>(5*1024*1024){
    @Override protected int sizeOf(String key,Bitmap bitmap){return bitmap.getByteCount();}
  };
  private static volatile long lastBitmapMs=0;
  private static volatile long maxBitmapMs=0;
  private static volatile long cacheHits=0;
  private static volatile long cacheMisses=0;
  private PrayerRingBitmapRenderer(){}

  /** Pure in-memory timing counters. Never force an extra ring render for QA. */
  public static synchronized void appendMetrics(JSONObject output)throws JSONException{
    output.put("nativeRingBitmapMs",lastBitmapMs);
    output.put("nativeRingMaxBitmapMs",maxBitmapMs);
    output.put("nativeRingCacheHits",cacheHits);
    output.put("nativeRingCacheMisses",cacheMisses);
  }

  private static int minutesOfDay(String clock)throws JSONException{
    if(clock==null||!clock.matches("([01]\\d|2[0-3]):[0-5]\\d"))
      throw new JSONException("Invalid published prayer boundary");
    return Integer.parseInt(clock.substring(0,2))*60+
        Integer.parseInt(clock.substring(3,5));
  }
  private static int localMinute(long millis){
    SimpleDateFormat f=new SimpleDateFormat("HH:mm",Locale.US);
    f.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
    String t=f.format(new Date(millis));
    return Integer.parseInt(t.substring(0,2))*60+Integer.parseInt(t.substring(3,5));
  }
  private static int alpha(int color,int a){return (color&0x00FFFFFF)|(a<<24);}
  private static int shade(int color,float factor){
    int r=Math.min(255,Math.round(((color>>16)&0xFF)*factor));
    int g=Math.min(255,Math.round(((color>>8)&0xFF)*factor));
    int b=Math.min(255,Math.round((color&0xFF)*factor));
    return (color&0xFF000000)|(r<<16)|(g<<8)|b;
  }
  /** Clock angle of a minute of the day, with "now" at 12 o'clock. */
  private static float angle(int minute,int now){return -90f+(minute-now)*.25f;}

  // Geometry as fractions of the bitmap side; everything stays inside it.
  static final float RADIUS=.41f;     // centre line of the coloured band
  static final float BAND=.064f;      // band thickness
  static final float MARKER=.034f;    // "now" marker height above the band
  // Gold that reads on BOTH the navy and the ivory card (one theme-neutral bitmap).
  private static final int GOLD=0xFFC9A462;
  private static final int TRACK=0x4D8FB3C8;

  private static void sector(Canvas canvas,Paint pen,RectF ring,int from,int to,
      int color,boolean active,float size,int now){
    if(to<=from)return;
    float mid=size*.5f,r=size*RADIUS,band=size*BAND;
    float inner=r-band*.5f,outer=r+band*.5f;
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.BUTT);
    if(active){
      // Soft corona: the running prayer glows like the home dial's live sector.
      pen.setShader(null);
      pen.setColor(alpha(color,70));
      pen.setStrokeWidth(band*1.42f);
      canvas.drawArc(ring,angle(from,now),(to-from)*.25f,false,pen);
    }
    // Depth: darker at the inner edge, full colour mid-band, lit outer edge.
    pen.setShader(new RadialGradient(mid,mid,outer,
        new int[]{shade(color,.78f),color,shade(color,1.16f)},
        new float[]{inner/outer,r/outer,1f},Shader.TileMode.CLAMP));
    pen.setAlpha(active?255:214);
    pen.setStrokeWidth(band);
    canvas.drawArc(ring,angle(from,now),(to-from)*.25f,false,pen);
    pen.setShader(null);
    pen.setAlpha(255);
  }

  /** Ring bitmaps are drawn at about the size the launcher shows them
   * (2×2 ≈ 150dp, 4×4 ≈ 240dp on a 3× screen), so arcs stay crisp instead of
   * being upscaled 2-3× from a small bitmap. */
  public static final int SMALL=448,LARGE=720;

  /** A single theme-neutral SMALL / LARGE bitmap per installed ring host,
   * turned to the current minute. */
  public static synchronized Bitmap render(JSONArray times,long nowMs,int size)
      throws JSONException{
    if(size!=SMALL&&size!=LARGE)throw new IllegalArgumentException("Invalid ring size");
    int[] boundaries=new int[6];
    boolean ready=times!=null&&times.length()==6;
    if(ready){
      int previous=-1;
      for(int i=0;i<6;i++){
        JSONObject row=times.getJSONObject(i);
        int minute=minutesOfDay(row.getString("time"));
        if(minute<=previous)throw new JSONException("Unordered published prayer boundaries");
        boundaries[i]=minute;
        previous=minute;
      }
    }
    int minuteNow=localMinute(nowMs),current=5;
    if(ready){
      for(int i=0;i<6;i++)if(minuteNow>=boundaries[i])current=i;
    }
    String key=size+"|"+ready+"|"+current+"|"+minuteNow+"|"+Arrays.toString(boundaries);
    Bitmap cached=CACHE.get(key);
    if(cached!=null&&!cached.isRecycled()){
      cacheHits++;
      lastBitmapMs=0;
      return cached;
    }
    cacheMisses++;
    long renderAt=SystemClock.elapsedRealtime();
    Bitmap bitmap=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);
    Canvas canvas=new Canvas(bitmap);
    float mid=size*.5f,radius=size*RADIUS,band=size*BAND;
    float inner=radius-band*.5f,outer=radius+band*.5f;
    RectF ring=new RectF(mid-radius,mid-radius,mid+radius,mid+radius);
    Paint pen=new Paint(Paint.ANTI_ALIAS_FLAG);

    // Hour ticks on a fine gold rim, turning with the dial: long every 6 h.
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.ROUND);
    for(int hour=0;hour<24;hour++){
      boolean major=hour%6==0;
      double a=Math.toRadians(angle(hour*60,minuteNow));
      float from=outer+size*.010f,to=from+size*(major?.024f:.012f);
      pen.setStrokeWidth(size*(major?.0055f:.0035f));
      pen.setColor(alpha(GOLD,major?210:120));
      canvas.drawLine(mid+(float)Math.cos(a)*from,mid+(float)Math.sin(a)*from,
          mid+(float)Math.cos(a)*to,mid+(float)Math.sin(a)*to,pen);
    }
    pen.setStrokeWidth(size*.004f);
    pen.setColor(alpha(GOLD,150));
    canvas.drawCircle(mid,mid,outer+size*.006f,pen);

    if(ready){
      // Yatsı runs across midnight into the next İmsak: one continuous arc.
      sector(canvas,pen,ring,0,boundaries[0],COLORS[5],current==5,size,minuteNow);
      for(int i=0;i<5;i++)
        sector(canvas,pen,ring,boundaries[i],boundaries[i+1],COLORS[i],current==i,size,minuteNow);
      sector(canvas,pen,ring,boundaries[5],1440,COLORS[5],current==5,size,minuteNow);
      // Crisp ivory separators at every published prayer boundary.
      pen.setStrokeCap(Paint.Cap.BUTT);
      pen.setStrokeWidth(size*.006f);
      pen.setColor(0xF2FFFDF7);
      for(int boundary:boundaries){
        double a=Math.toRadians(angle(boundary,minuteNow));
        canvas.drawLine(mid+(float)Math.cos(a)*inner,mid+(float)Math.sin(a)*inner,
            mid+(float)Math.cos(a)*outer,mid+(float)Math.sin(a)*outer,pen);
      }
    }else{
      pen.setStrokeCap(Paint.Cap.BUTT);
      pen.setStrokeWidth(band);
      pen.setColor(TRACK);
      canvas.drawCircle(mid,mid,radius,pen);
    }

    // Gold inner rim framing the centre text, as around the home medallion.
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeWidth(size*.0065f);
    pen.setColor(alpha(GOLD,235));
    canvas.drawCircle(mid,mid,inner-size*.010f,pen);
    pen.setStrokeWidth(size*.0025f);
    pen.setColor(alpha(GOLD,110));
    canvas.drawCircle(mid,mid,inner-size*.024f,pen);

    // "Now" at 12 o'clock: an ivory hairline across the band and a gold
    // pointer above it.
    pen.setStrokeCap(Paint.Cap.ROUND);
    pen.setStrokeWidth(size*.008f);
    pen.setColor(0xFFFFFDF7);
    canvas.drawLine(mid,mid-inner+size*.004f,mid,mid-outer-size*.004f,pen);
    Path pointer=new Path();
    float tip=mid-outer-size*.006f,base=tip-size*MARKER,half=size*.021f;
    pointer.moveTo(mid,tip);
    pointer.lineTo(mid-half,base);
    pointer.lineTo(mid+half,base);
    pointer.close();
    pen.setStyle(Paint.Style.FILL);
    pen.setColor(GOLD);
    canvas.drawPath(pointer,pen);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeWidth(size*.003f);
    pen.setColor(0xFF8C6B33);
    canvas.drawPath(pointer,pen);

    CACHE.put(key,bitmap);
    lastBitmapMs=SystemClock.elapsedRealtime()-renderAt;
    maxBitmapMs=Math.max(maxBitmapMs,lastBitmapMs);
    return bitmap;
  }
}
