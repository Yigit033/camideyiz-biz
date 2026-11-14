export const runtime='nodejs';
export function GET(){
  return Response.json({status:'ok',service:'camideyiz-prayer-api'},
    {headers:{'Cache-Control':'no-store'}});
}
