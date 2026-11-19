package biz.camideyiz.app.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
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
 * Native launcher-only prayer ring. Does not start React, load network data,
 * calculate astronomical times or animate in the app process. Android's
 * Chronometer owns the independently live central countdown.
 *
 * Daily published boundaries cover the 24-hour clock. The Yatsi segment
 * wraps at midnight (the previous Yatsi until today's Imsak); no next-day
 * prayer time is invented and no "live rotating needle" is implied.
 */
public final class PrayerRingBitmapRenderer {
  private static final int[] COLORS={
    0xFF3593B5,0xFFD69E44,0xFF1EAFB0,0xFF10B981,0xFFDA7049,0xFF7162BB
  };
  // A 224px mini is ~196KB; a 432px premium is ~729KB. Keep cache bounded.
  private static final LruCache<String,Bitmap> CACHE=
      new LruCache<String,Bitmap>(2*1024*1024){
        @Override protected int sizeOf(String key,Bitmap bitmap){
          return bitmap.getByteCount();
        }
      };

  private PrayerRingBitmapRenderer(){}

  private static int minutesOfDay(String clock)throws JSONException{
    if(clock==null||!clock.matches("([01]\\d|2[0-3]):[0-5]\\d"))
      throw new JSONException("Invalid published ring boundary");
    return Integer.parseInt(clock.substring(0,2))*60+
        Integer.parseInt(clock.substring(3,5));
  }

  private static int localMinute(long nowMs){
    SimpleDateFormat f=new SimpleDateFormat("HH:mm",Locale.US);
    f.setTimeZone(TimeZone.getTimeZone("Europe/Istanbul"));
    String clock=f.format(new Date(nowMs));
    return Integer.parseInt(clock.substring(0,2))*60+
        Integer.parseInt(clock.substring(3,5));
  }

  private static int withAlpha(int base,int alpha){
    return (base&0x00FFFFFF)|(alpha<<24);
  }

  private static void sector(Canvas canvas,Paint pen,RectF bounds,
      int from,int to,int color,boolean current,float size){
    if(to<=from)return;
    float start=-90f+from*.25f;
    float sweep=(to-from)*.25f;
    // Small, consistent breathing gap between real-duration sectors.
    float gap=Math.min(1.35f,sweep*.10f);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.BUTT);
    pen.setColor(withAlpha(color,current?235:135));
    pen.setStrokeWidth(size*.071f);
    canvas.drawArc(bounds,start+gap*.5f,Math.max(.15f,sweep-gap),false,pen);
  }

  /**
   * Renders only after an actual widget host instance exists. Cache key includes
   * the six verified times, active segment, theme and bounded bitmap size.
   * Full updateAppWidget is used (never an accumulating partial bitmap update).
   */
  public static synchronized Bitmap render(JSONArray times,long nowMs,
      boolean light,int size) throws JSONException {
    if(size!=224&&size!=432)throw new IllegalArgumentException("Invalid ring size");
    int[] boundaries=new int[6];
    boolean ready=times!=null&&times.length()==6;
    if(ready){
      int last=-1;
      for(int i=0;i<6;i++){
        JSONObject entry=times.getJSONObject(i);
        int minute=minutesOfDay(entry.getString("time"));
        if(minute<=last)throw new JSONException("Unordered published ring boundaries");
        boundaries[i]=minute;
        last=minute;
      }
    }
    int current=5;
    int minuteNow=localMinute(nowMs);
    if(ready){
      for(int i=0;i<6;i++){
        if(minuteNow>=boundaries[i])current=i;
      }
    }
    String key=size+"|"+light+"|"+ready+"|"+current+"|"+
        Arrays.toString(boundaries);
    Bitmap cached=CACHE.get(key);
    if(cached!=null&&!cached.isRecycled())return cached;

    Bitmap bitmap=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);
    Canvas canvas=new Canvas(bitmap);
    float mid=size/2f;
    float ringR=size*.326f;
    Paint pen=new Paint(Paint.ANTI_ALIAS_FLAG);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.BUTT);
    RectF arc=new RectF(mid-ringR,mid-ringR,mid+ringR,mid+ringR);

    // One quiet, elegant ring. No triple borders, no large overlaid labels.
    pen.setStrokeWidth(size*.074f);
    pen.setColor(0xFF233D53);
    canvas.drawCircle(mid,mid,ringR,pen);
    if(ready){
      // Astronomical times are never calculated here: only the published clock
      // boundaries provided by the validated calendar are used.
      sector(canvas,pen,arc,0,boundaries[0],COLORS[5],current==5,size);
      for(int i=0;i<5;i++)
        sector(canvas,pen,arc,boundaries[i],boundaries[i+1],
            COLORS[i],current==i,size);
      sector(canvas,pen,arc,boundaries[5],1440,COLORS[5],current==5,size);

      // Small gilded position marker on the active prayer sector, NOT a
      // continuously rotating clock needle. Drawing is still event-driven.
      int start=current==5?boundaries[5]:boundaries[current];
      int end=current==5?1440:boundaries[current+1];
      float markerAngle=(start+(end-start)*.5f)*.25f;
      double theta=Math.toRadians(markerAngle);
      float cx=mid+(float)Math.sin(theta)*ringR;
      float cy=mid-(float)Math.cos(theta)*ringR;
      pen.setStyle(Paint.Style.FILL);
      pen.setColor(0xFFD8BF8D);
      canvas.drawCircle(cx,cy,size*.012f,pen);
    }
    CACHE.put(key,bitmap);
    return bitmap;
  }
}
