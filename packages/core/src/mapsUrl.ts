/**
 * Universal Google Maps URL: no SDK, API key, Places API or billing integration.
 * Google's Maps app (or browser) handles location, results, photos and routes.
 * https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMosqueSearchURL(area=''):string{
  if(typeof area!=='string')throw new TypeError('Search area must be text');
  const normalized=area.replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
  if(normalized.length>80)throw new RangeError('Area name is too long');
  const query=normalized ? 'camiler '+normalized : 'yakınımdaki camiler';
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
