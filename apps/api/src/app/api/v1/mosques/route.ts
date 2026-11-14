// Legacy OSM endpoint retired. Do not silently mix OSM records with Google Places.
export function GET(){
  return Response.json({error:'legacy_osm_endpoint_retired_use_google_places'},
    {status:410,headers:{'Cache-Control':'no-store'}});
}
