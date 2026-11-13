# Live dial timing engine — v0.5

## Implemented
- One-second updates in the local IANA timezone, based on the prayer-time boundaries.
- A fixed **outside ring** indicates elapsed progress toward the next prayer; the prayer dial itself remains freely rotatable.
- Relative proximity triggers gradual brighter accent/glow (<=45m approaching, <=15m imminent).
- If the next prayer is Akşam, approaching accent becomes amber/peach; a restricted sunset window takes visual precedence with coral-red.
- Three **distinct indicative** kerahat segments, generated only in explicit DEMO mode.
- Morning sunrise: sample +45m. Pre-noon: sample -10m. Pre-sunset: sample -45m.
- The summary chip and details distinguish approach from restriction.
- Important: the three windows do not cover all restrictions on nafile prayers; some depend on whether the person has prayed the farz.
- Midnight rollover handled by a continuous progress calculation.
- Unit tests cover boundaries, rollover, imminence and demo restrictions.

## Religious safety / data source

The default illustrative kerahat windows come from the approximate temperate-region explanations of the Diyanet Din İşleri Yüksek Kurulu:
https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73

- These fixed-minute demo intervals **are not exact official start and end times** and are not applicable at all latitudes and seasons.
- As per Diyanet, during the sunset prohibition window that day's Ikindi farz is an exception; oversimplified “no prayer whatsoever” messages would be inaccurate.
- Other periods apply only to nafile prayers and depend on prayer completion.
- Jurisprudential differences exist; the app should present its chosen method transparently.
- Production mode MUST NOT derive religious warnings from this demo model. Supply a reliable approved source, valid local date/zone, and appropriately reviewed kerahat period logic before enabling live religious guidance.
- Diyanet API requires a usage application and has quotas: https://awqatsalah.diyanet.gov.tr/
- Never expose Diyanet API credentials in the mobile client.

## QA scenarios
1. 16:09→19:21: progress 0→1 as the sun goes down.
2. At 18:36 in the DEMO: warning takes precedence over approaching-Akşam orange.
3. At 19:21: demo sunset restriction ends; next Yatsı begins.
4. At 23:00 and 03:00: next İmsak and progress correctly cross midnight.
5. User drags dial: fixed outside ring keeps displaying actual time, manual selected segment remains independent.
6. Date changes with stale production schedule: no religious guidance.
7. Reduced motion and screen reader, Android/iOS performance and touch testing remain necessary.
