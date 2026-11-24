package biz.camideyiz.app.widget;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
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
 * Product-consistent, cached native circular prayer clock for RemoteViews.
 * Six true-length sectors come exclusively from published clock boundaries.
 * No astronomical calculation, JS timer, network or animated rendering.
 */
public final class PrayerRingBitmapRenderer {
  private static final int[] COLORS={
      0xFF3D9DBB,0xFFD7A657,0xFF3AACB6,0xFF2AA38A,0xFFC47E64,0xFF887CC5
  };
  private static final LruCache<String,Bitmap> CACHE=new LruCache<String,Bitmap>(2*1024*1024){
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
  private static void sector(Canvas canvas,Paint pen,RectF ring,int from,int to,
      int color,boolean active,float size){
    if(to<=from)return;
    float start=-90f+from*.25f;
    float sweep=(to-from)*.25f;
    float gap=Math.min(1.65f,sweep*.12f);
    float begin=start+gap*.5f;
    float span=Math.max(.1f,sweep-gap);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.ROUND);
    // Deep, restrained corona rather than a heavy filled annulus.
    if(active){
      pen.setColor(alpha(color,56));
      pen.setStrokeWidth(size*.069f);
      canvas.drawArc(ring,begin,span,false,pen);
    }
    pen.setStrokeWidth(size*.045f);
    pen.setColor(alpha(color,active?255:180));
    canvas.drawArc(ring,begin,span,false,pen);
    if(active){
      pen.setStrokeWidth(size*.007f);
      pen.setColor(0xCCD8C08B);
      canvas.drawArc(ring,begin+.25f,Math.max(.1f,span-.5f),false,pen);
    }
  }

  // Translucent slate inks read correctly on BOTH the navy and the ivory card,
  // so one bitmap serves light, dark and launcher-resolved day/night layouts.
  private static final int TRACK=0x4D8FB3C8;
  private static final int INNER_RIM=0x405F8196;
  private static final int OUTER_RIM=0x335F8196;

  /** Ring bitmaps are drawn at about the size the launcher shows them
   * (2×2 ≈ 150dp, 4×4 ≈ 240dp on a 3× screen), so arcs stay crisp instead of
   * being upscaled 2-3× from a small bitmap. */
  public static final int SMALL=448,LARGE=720;

  /** A single theme-neutral SMALL / LARGE bitmap per installed ring host. */
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
    String key=size+"|"+ready+"|"+current+"|"+Arrays.toString(boundaries);
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
    // Ring fills the bitmap: outer rim at r+.043 and the active halo at
    // r+.035 stay inside the edge, so no transparent margin is wasted on the
    // home screen. Centre text lives in a ring-proportional layout box.
    float mid=size*.5f,radius=size*(size==SMALL?.43f:.44f);
    RectF ring=new RectF(mid-radius,mid-radius,mid+radius,mid+radius);
    Paint pen=new Paint(Paint.ANTI_ALIAS_FLAG);
    pen.setStyle(Paint.Style.STROKE);
    pen.setStrokeCap(Paint.Cap.ROUND);
    pen.setColor(TRACK);
    pen.setStrokeWidth(size*.051f);
    canvas.drawCircle(mid,mid,radius,pen);
    if(ready){
      // Night splits across the date boundary; this is two portions of Yatsı.
      sector(canvas,pen,ring,0,boundaries[0],COLORS[5],current==5,size);
      for(int i=0;i<5;i++)
        sector(canvas,pen,ring,boundaries[i],boundaries[i+1],COLORS[i],current==i,size);
      sector(canvas,pen,ring,boundaries[5],1440,COLORS[5],current==5,size);
    }
    // Subtle inner watch dial and outer rim; no crowded time labels or dots.
    pen.setStyle(Paint.Style.STROKE);
    pen.setColor(INNER_RIM);
    pen.setStrokeWidth(size*.0027f);
    canvas.drawCircle(mid,mid,radius-size*.052f,pen);
    pen.setColor(OUTER_RIM);
    canvas.drawCircle(mid,mid,radius+size*.043f,pen);
    CACHE.put(key,bitmap);
    lastBitmapMs=SystemClock.elapsedRealtime()-renderAt;
    maxBitmapMs=Math.max(maxBitmapMs,lastBitmapMs);
    return bitmap;
  }
}
