/**
 * Native (Capacitor) bootstrap.
 * Every call is a no-op in the browser, so web behaviour is unchanged.
 */

let nativeChecked = false;
let nativeAvailable = false;

export function isNativeApp() {
  if (typeof window === "undefined") return false;
  if (!nativeChecked) {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    nativeAvailable = !!cap?.isNativePlatform?.();
    nativeChecked = true;
  }
  return nativeAvailable;
}

export async function initNativeShell(onBack: () => void) {
  if (!isNativeApp()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* status bar unavailable */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* splash unavailable */
  }

  try {
    const { App } = await import("@capacitor/app");
    const listener = await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) onBack();
      else App.exitApp();
    });
    return () => {
      listener.remove();
    };
  } catch {
    /* app plugin unavailable */
  }
}

export async function tapFeedback() {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* haptics unavailable */
  }
}

/**
 * Deep links: routes notification / App Link opens to an in-app path.
 * Handles cold start (launch URL) and warm opens (appUrlOpen).
 */
export async function initDeepLinks(onDeepLink: (url: string) => void) {
  if (!isNativeApp()) return;
  try {
    const { App } = await import("@capacitor/app");
    const launch = await App.getLaunchUrl();
    if (launch?.url) onDeepLink(launch.url);
    const listener = await App.addListener("appUrlOpen", ({ url }) => {
      if (url) onDeepLink(url);
    });
    return () => {
      listener.remove();
    };
  } catch {
    /* app plugin unavailable */
  }
}
