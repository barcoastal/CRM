import type { AnchorHTMLAttributes } from "react";
const destinations: Record<string, string> = { "/call-center/live-floor": "live-floor.html", "/call-center/manage": "manage.html", "/call-center/opener": "opener.html", "/call-center/closer": "closer.html" };
export default function PreviewLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [path, hash] = (props.href || "").split("#");
  const destination = destinations[path];
  const href = destination && `${destination}${hash ? `#${hash}` : ""}`;
  return <a {...props} href={href || props.href} onClick={event => { if (!href) event.preventDefault(); }} />;
}
