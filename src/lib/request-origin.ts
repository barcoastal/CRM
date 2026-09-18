/** Public host can differ from Next's internal request URL behind a reverse proxy. */
export function hasSameOrigin(request: Request): boolean {
  const origin=request.headers.get('origin');
  if(!origin)return true;
  const host=request.headers.get('x-forwarded-host')?.split(',')[0].trim()
    || request.headers.get('host') || new URL(request.url).host;
  try{return new URL(origin).host===host;}catch{return false;}
}
