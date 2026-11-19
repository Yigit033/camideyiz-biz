package biz.camideyiz.app.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
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
      int from,int to,int color,boolean current,float radiusPixels){
    if(to<=from)return;
    float start=-90f+from*.25f;
    float sweep=(to-from)*.25f;
    float gap=Math.min(.85f,Math.max(0f,sweep/8f));
    pen.setColor(withAlpha(color,current?255:198));
    pen.setStrokeWidth(radiusPixels*.235f);
    canvas.drawArc(bounds,start+gap/2f,sweep-gap,false,pen);
    if(current){
      pen.setColor(withAlpha(color,205));
      pen.setStrokeWidth(radiusPixels*.05f);
      RectF glow=new RectF(bounds.left-radiusPixels*.155f,
          bounds.top-radiusPixels*.155f,
          bounds.right+radiusPixels*.155f,bounds.bottom+radiusPixels*.155f);
      canvas.drawArc(glow,start+gap/2f,sweep-gap,false,pen);
    }
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
    float outer=size*.398f;
    float ringR=size*.319f;
    Paint pen=new Paint(Paint.ANTI_ALIAS_FLAG);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.BUTT);
    RectF arc=new RectF(mid-ringR,mid-ringR,mid+ringR,mid+ringR);

    // Subtle midnight-blue track, visible before a verified calendar exists.
    pen.setStrokeWidth(size*.092f);
    pen.setColor(light?0xFFDCE5E8:0xFF25465B);
    canvas.drawCircle(mid,mid,ringR,pen);
    if(ready){
      // 00:00 -> today's Imsak is the continuing previous Yatsi period.
      sector(canvas,pen,arc,0,boundaries[0],COLORS[5],current==5,size);
      for(int i=0;i<5;i++)
        sector(canvas,pen,arc,boundaries[i],boundaries[i+1],
            COLORS[i],current==i,size);
      sector(canvas,pen,arc,boundaries[5],1440,COLORS[5],
          current==5,size);
      // Premium-only six published clock labels. Labels sit at each exact
      // boundary angle, not evenly spaced or invented from astronomy.
      // The smaller 2×2 ring intentionally omits them for legibility.
      if(size==432){
        Paint labelPaint=new Paint(Paint.ANTI_ALIAS_FLAG);
        labelPaint.setStyle(Paint.Style.FILL);
        labelPaint.setTypeface(Typeface.create("sans-serif",Typeface.BOLD));
        labelPaint.setTextAlign(Paint.Align.CENTER);
        labelPaint.setTextSize(size*.038f);
        labelPaint.setColor(light?0xFF1B415B:0xFFF2F7FB);
        float labelRadius=size*.443f;
        for(int i=0;i<6;i++){
          double theta=Math.toRadians(boundaries[i]*.25d);
          float px=mid+(float)Math.sin(theta)*labelRadius;
          float py=mid-(float)Math.cos(theta)*labelRadius;
          String clock=times.getJSONObject(i).getString("time");
          canvas.drawText(clock,px,py+size*.012f,labelPaint);
        }
      }
    }
    pen.setColor(light?0xFFCBDBE1:0xFF416077);
    pen.setStrokeWidth(size*.0045f);
    canvas.drawCircle(mid,mid,outer,pen);
    pen.setColor(light?0xFFB5C9D4:0xFF34526B);
    pen.setStrokeWidth(size*.004f);
    canvas.drawCircle(mid,mid,size*.246f,pen);
    CACHE.put(key,bitmap);
    return bitmap;
  }
}
