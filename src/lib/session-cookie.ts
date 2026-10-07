/** The regular CRM session takes priority when a browser also has a Five9 frame session. */
export function hasCrmSessionCookie(cookieNames: Iterable<string>): boolean {
  for (const name of cookieNames) {
    if (/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(name)) return true;
  }
  return false;
}
