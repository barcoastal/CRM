const routes: Record<string, string> = { "closer.html": "/call-center/closer", "live-floor.html": "/call-center/live-floor", "manage.html": "/call-center/manage" };
export const usePathname = () => routes[window.location.pathname.split("/").pop() || ""] || "/call-center/opener";
export const useRouter = () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} });
export const useSearchParams = () => new URLSearchParams();
