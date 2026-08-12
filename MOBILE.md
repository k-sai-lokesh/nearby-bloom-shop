# HyperLocal Connect — Native mobile app (Capacitor)

The native shell wraps the same React app in an Android/iOS container.

## One-time setup (on your own machine)

Requirements: Node 20+, Android Studio (Android) and/or Xcode 15+ on macOS (iOS).

```bash
git clone <your repo url>
cd <project>
npm install

# add the platforms you need
npx cap add android
npx cap add ios

# build the web assets and sync them into the native projects
npm run build
npx cap sync
```

## Run it

```bash
npx cap run android     # or: npx cap open android
npx cap run ios         # macOS only
```

## How it loads content

`capacitor.config.ts` sets `server.url` to the deployed site
(`https://nearby-bloom-shop.lovable.app`), because the app uses server-side
rendering and server functions. The native shell therefore always shows the
latest deployed version — no rebuild needed after a content change.

For live reload against your local dev server, replace `server.url` with your
machine's LAN address (e.g. `http://192.168.1.20:8080`), run `npm run dev`,
then `npx cap sync` and re-run the app.

To ship a fully offline/bundled build instead, remove the `server` block, run
`npm run build`, and `npx cap sync` — note that server functions still require
network access.

## Native behaviour included

- Status bar styling and splash-screen dismissal on launch
- Android hardware back button mapped to in-app history
- Light haptic feedback helper (`tapFeedback()` in `src/lib/native.ts`)
- Safe-area insets applied to the header and floating UI

## Releasing

- Android: Android Studio → Build → Generate Signed Bundle (AAB) → Play Console
- iOS: Xcode → Product → Archive → Distribute App → App Store Connect

App identifiers live in `capacitor.config.ts` (`appId`, `appName`); change them
before your first store submission.
