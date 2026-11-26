package biz.camideyiz.app.widget;

import android.content.Context;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.util.DisplayMetrics;
import android.util.SizeF;
import android.util.TypedValue;

/**
 * One text size for a whole group of sibling texts (owner, 26.11.2026: "all
 * fonts the same size"). Android's per-view autosize gives every TextView its
 * own size, so in a narrow widget "Öğle" grew larger than "İkindi" and "1448"
 * larger than "17 Cemaziyelahir". Here the group's widest text is measured in
 * the system face and the one size that fits EVERY member into its (identical)
 * box is applied to all of them.
 *
 * The box sizes come from the row and column layouts: the constants below
 * mirror their paddings, margins and weights, and verify-widget-designs.mjs
 * recomputes each one from the dark layout XML, so the two cannot drift.
 */
final class WidgetTypeScale{
  private WidgetTypeScale(){}

  /** Share of a box's width a line may use: launcher rounding, glyph overhang. */
  static final float WIDTH_SAFETY=0.94f;
  /** Nominal 1-cell height (dp) when the launcher reports no size. */
  static final float NOMINAL_ROW_HEIGHT=72f;
  /** Nominal 1-cell width (dp) when the launcher reports no size. */
  static final float NOMINAL_COLUMN_WIDTH=76f;

  // Six-prayer row (widget_prayer_row.xml), dp and layout weights.
  static final float ROW_PAD=6f,ROW_GAP=4f,ROW_CELL_PAD=2f;
  static final float ROW_LOGO=1.2f,ROW_REMAINING=1.7f;
  /** Label share of a cell: icon .28, label .32, clock .40. */
  static final float ROW_LABEL_SHARE=0.32f;
  /** 6×1 calendar band under the prayers: a 1dp rule with 4/3dp margins,
   * then the date line (weight .28 against the prayers' 1), two halves
   * parted by a 1dp stroke. */
  static final float ROW_RULE=8f,ROW_CALENDAR=0.28f,ROW_DIVIDER=1f;

  // Six-prayer column (widget_prayer_column.xml).
  static final float COL_PAD=6f,COL_GAP=4f;
  static final float COL_LOGO=1.5f,COL_BRAND=3.0f,COL_REMAINING=1.8f;
  /** Calendar leaf: mark (weight 1), rule (5dp), two day numerals (.38 each)
   * and three captions (.22 each). */
  static final float COL_RULE=5f,COL_MARK=1f,COL_NUMERAL=0.38f,COL_CAPTION=0.22f;
  static final float COL_BRAND_PAD=2f;

  // Six-prayer strip (widget_prayer_strip.xml): header 36dp, rule 1dp with
  // 4/2dp margins, cells (weight 1, 5dp bottom margin) and a 46dp footer
  // that also takes weight .34; cells pad 2dp sideways and 3dp vertically,
  // and the clock sits 3dp under the name (name .8 : clock 1).
  static final float STRIP_PAD=8f,STRIP_HEADER=36f,STRIP_RULE=7f,STRIP_CELLS_BOTTOM=5f;
  static final float STRIP_FOOTER=46f,STRIP_FOOTER_WEIGHT=0.34f;
  static final float STRIP_CELL_PAD_X=2f,STRIP_CELL_PAD_Y=3f,STRIP_TIME_GAP=3f;
  static final float NAME_SHARE=0.8f/1.8f;
  static final float NOMINAL_STRIP_WIDTH=300f,NOMINAL_STRIP_HEIGHT=160f;
  // Premium ring footer (widget_ring_premium.xml): 10dp card padding, a 50dp
  // chip with 3dp side padding, cells padding 1dp sideways and 4dp vertically.
  static final float PREMIUM_PAD=10f,PREMIUM_CHIP=50f,PREMIUM_CHIP_PAD=3f;
  static final float PREMIUM_CELL_PAD_X=1f,PREMIUM_CELL_PAD_Y=4f,PREMIUM_TIME_GAP=3f;
  static final float NOMINAL_PREMIUM_WIDTH=300f;

  /** Strip: one size for the six prayer names (regular face). */
  static float strip(Context context,SizeF size,String... names){
    float width=size==null?NOMINAL_STRIP_WIDTH:size.getWidth();
    float height=size==null?NOMINAL_STRIP_HEIGHT:size.getHeight();
    float leftover=height-2*STRIP_PAD-STRIP_HEADER-STRIP_RULE-STRIP_CELLS_BOTTOM-STRIP_FOOTER;
    float cells=Math.max(0f,leftover)/(1f+STRIP_FOOTER_WEIGHT);
    float cell=(width-2*STRIP_PAD)/6f;
    return fit(context,cell-2*STRIP_CELL_PAD_X,
        (cells-2*STRIP_CELL_PAD_Y-STRIP_TIME_GAP)*NAME_SHARE,8f,13f,false,names);
  }

  /** Premium ring footer: one size for the six prayer names (regular face). */
  static float premium(Context context,SizeF size,String... names){
    float width=size==null?NOMINAL_PREMIUM_WIDTH:size.getWidth();
    float cell=(width-2*PREMIUM_PAD-2*PREMIUM_CHIP_PAD)/6f;
    return fit(context,cell-2*PREMIUM_CELL_PAD_X,
        (PREMIUM_CHIP-2*PREMIUM_CELL_PAD_Y-PREMIUM_TIME_GAP)*NAME_SHARE,8f,13f,false,names);
  }

  /** Text sizes (px) for one row card at one launcher size. */
  static final class RowType{
    final float caption;
    RowType(float caption){this.caption=caption;}
  }
  /** Text sizes (px) for one column card at one launcher size. */
  static final class ColumnType{
    final float numeral,caption;
    ColumnType(float numeral,float caption){this.numeral=numeral;this.caption=caption;}
  }

  /**
   * Row: the six prayer names and, at 6×1, both dates of the calendar band
   * share ONE caption size, the largest at which every one fits its box.
   */
  static RowType row(Context context,SizeF size,boolean band,boolean remaining,
      String[] labels,String... dateLines){
    float width=size.getWidth()-2*ROW_PAD,height=size.getHeight()-2*ROW_PAD;
    float prayers=band?(height-ROW_RULE)/(1f+ROW_CALENDAR):height;
    float weights=ROW_LOGO+6f+(remaining?ROW_REMAINING:0f);
    float flex=width-ROW_GAP*(6+(remaining?1:0));
    float cell=flex/weights;
    float caption=fit(context,cell-2*ROW_CELL_PAD,
        (prayers-2*ROW_CELL_PAD)*ROW_LABEL_SHARE,7f,15f,true,labels);
    if(band){
      float line=(height-ROW_RULE)*ROW_CALENDAR/(1f+ROW_CALENDAR);
      caption=Math.min(caption,
          fit(context,(width-ROW_DIVIDER)/2f,line,7f,14f,true,dateLines));
    }
    return new RowType(caption);
  }

  /** Column (1×6): both day numerals share one size, the three captions
   * (Hijri month, Gregorian month, weekday) another. */
  static ColumnType column(Context context,SizeF size,boolean remaining,
      String[] numerals,String... captions){
    float width=size.getWidth()-2*COL_PAD-2*COL_BRAND_PAD;
    float height=size.getHeight()-2*COL_PAD;
    float weights=COL_BRAND+6f+(remaining?COL_REMAINING:0f);
    float flex=height-COL_GAP*(6+(remaining?1:0));
    float brand=flex*COL_BRAND/weights-COL_RULE;
    float unit=brand/(COL_MARK+2*COL_NUMERAL+3*COL_CAPTION);
    return new ColumnType(
        fit(context,width,unit*COL_NUMERAL,9f,26f,true,numerals),
        fit(context,width,unit*COL_CAPTION,6f,13f,true,captions));
  }

  /**
   * Largest size (px), between minSp and maxSp, at which every text fits one
   * line of a boxWidthDp × boxHeightDp box (no font padding). Empty texts
   * are ignored; a group with nothing to measure gets maxSp.
   */
  static float fit(Context context,float boxWidthDp,float boxHeightDp,
      float minSp,float maxSp,boolean bold,String... texts){
    DisplayMetrics metrics=context.getResources().getDisplayMetrics();
    float min=TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,minSp,metrics);
    float max=TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,maxSp,metrics);
    Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    paint.setTypeface(bold?Typeface.DEFAULT_BOLD:Typeface.DEFAULT);
    paint.setTextSize(100f);
    float widest=0f;
    for(String text:texts){
      if(text!=null&&!text.isEmpty())widest=Math.max(widest,paint.measureText(text));
    }
    Paint.FontMetrics font=paint.getFontMetrics();
    float lineAt100=font.descent-font.ascent;
    float byWidth=widest>0f
        ?100f*Math.max(0f,boxWidthDp)*metrics.density*WIDTH_SAFETY/widest:max;
    float byHeight=lineAt100>0f
        ?100f*Math.max(0f,boxHeightDp)*metrics.density/lineAt100:max;
    return Math.max(min,Math.min(max,Math.min(byWidth,byHeight)));
  }
}
