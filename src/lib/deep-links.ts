/**
 * Deep link parsing shared by the native shell (Capacitor appUrlOpen),
 * push/flash-sale notifications, and the mobile tab bar.
 *
 * Supported shapes:
 *   hyperlocal://product/<id>            -> /product/<id>
 *   hyperlocal://category/<slug>         -> /browse?cat=<slug>
 *   hyperlocal://search?q=bread          -> /browse?q=bread
 *   hyperlocal://order/<id>              -> /orders?order=<id>
 *   hyperlocal://cart | /wishlist | /profile | /vendor | /browse | /
 *   https://<host>/product/<id>          -> same as above (App Links)
 */

export const APP_SCHEME = "hyperlocal";

export type TabKey = "home" | "browse" | "cart" | "orders" | "profile";

/** Which bottom tab owns a given in-app path. */
export function tabForPath(pathname: string): TabKey {
  if (pathname === "/") return "home";
  if (
    pathname.startsWith("/browse") ||
    pathname.startsWith("/product") ||
    pathname.startsWith("/category") ||
    pathname.startsWith("/wishlist")
  )
    return "browse";
  if (pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return "cart";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/profile") || pathname.startsWith("/auth") || pathname.startsWith("/vendor"))
    return "profile";
  return "home";
}

/**
 * Convert any incoming deep link into an app-relative path (with query string),
 * or null when the URL isn't something this app can route.
 */
export function parseDeepLink(rawUrl: string): string | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  let segments: string[];
  let search = url.searchParams;

  if (url.protocol === `${APP_SCHEME}:`) {
    // hyperlocal://product/123 -> host "product", pathname "/123"
    segments = [url.hostname, ...url.pathname.split("/")].filter(Boolean);
  } else if (url.protocol === "http:" || url.protocol === "https:") {
    segments = url.pathname.split("/").filter(Boolean);
  } else {
    return null;
  }

  const [head, ...rest] = segments;
  const qs = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  switch (head) {
    case undefined:
      return "/";
    case "product":
      return rest[0] ? `/product/${rest[0]}` : "/browse";
    case "category":
      return `/browse${qs({ cat: rest[0] })}`;
    case "search":
      return `/browse${qs({ q: search.get("q") ?? rest[0] ?? undefined })}`;
    case "order":
    case "orders":
      return `/orders${qs({ order: rest[0] ?? search.get("order") ?? undefined })}`;
    case "browse":
      return `/browse${qs({ q: search.get("q") ?? undefined, cat: search.get("cat") ?? undefined })}`;
    case "cart":
    case "checkout":
    case "wishlist":
    case "profile":
    case "vendor":
    case "auth":
      return `/${head}${url.search || ""}`;
    default:
      return null;
  }
}
