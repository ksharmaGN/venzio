# Venzio native apps (Capacitor)

Android and iOS shells load the hosted app (`CAPACITOR_SERVER_URL` or `https://venzio.ai/me`). Auth uses cookies plus native session backup on both platforms.

## Android

```bash
npm run cap:build:android:debug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or run on device/emulator:

```bash
npm run cap:run:android
```

Regenerate launcher icons from `public/icon-512.png`:

```bash
npm run android:icons
```

Regenerate the iOS App Icon (1024×1024) from the same source:

```bash
npm run ios:icons
```

Then clean-build in Xcode (**Product → Clean Build Folder**) or delete the app from the device/simulator and reinstall — iOS caches home-screen icons aggressively.

## iOS

### Prerequisites (Mac only)

1. **Xcode** from the Mac App Store (Command Line Tools alone are not enough).
2. **CocoaPods**: `brew install cocoapods`
3. Select Xcode: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

### Sync and open

```bash
npm run cap:sync:ios      # cap sync ios + pod install
npm run cap:ios           # open Xcode workspace
npm run cap:run:ios       # build and run on simulator/device
```

First-time setup:

```bash
npm run ios:setup         # cap add ios (if missing) + pod install
```

### Building an `.ipa` without a **paid** Apple Developer account

| Goal | Apple account | Notes |
|------|---------------|--------|
| **Simulator only** | None | `cap run ios` → pick an iPhone simulator. Fastest for UI/dev. |
| **Your own iPhone** | **Free Apple ID** | Xcode → Signing → Team: Personal Team. App expires in **~7 days**, then reinstall. |
| **IPA for TestFlight / App Store** | **Paid** ($99/yr) | Required to distribute to other people officially. |
| **Sideload IPA to others** | Paid, or ad-hoc with registered UDIDs | No legitimate way to ship IPAs widely with zero Apple signing. |

**Free Apple ID flow (personal device):**

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Target **App** → **Signing & Capabilities** → enable **Automatically manage signing**.
3. Choose your **Personal Team** (Apple ID).
4. Connect iPhone, trust the computer, select the device, **Run** (▶).

Xcode builds a debug `.app` on the device. To export an IPA for archival without paid membership, use **Product → Archive** only works with a team that supports distribution; free teams are limited to direct run.

**Simulator (no Apple ID):**

```bash
npm run cap:run:ios
```

### Notifications on native

- Uses **local notifications** (`@capacitor/local-notifications`), not FCM/APNs.
- On check-in: immediate confirmation + auto-checkout time (T+12h).
- Then reminders at **4h, 8h, 12h, 16h, 18h, 20h, 22h** (`en.notifications.stale`).
- Warning **15 minutes before** scheduled auto-checkout.
- Allow notifications when prompted after check-in.

### Android: no notifications after check-in

Local notifications are scheduled on the device. They do **not** use FCM. If nothing appears:

1. **Deploy latest web** — the WebView loads `CAPACITOR_SERVER_URL` (default `https://venzio.ai/me`). Notification JS must be on that server.
2. **Rebuild the APK** after manifest/plugin changes (`npm run cap:build:android:debug` or release workflow).
3. **Allow notifications** for Venzio in system Settings (Android 13+).
4. **Alarms & reminders** — on Android 12+, open app info → Alarms & reminders (or “Schedule exact alarms”) and allow, so 4h/8h/… reminders fire on time.
5. **Battery** — disable aggressive battery optimization for Venzio on OEM skins (Samsung, Xiaomi, etc.) or reminders may be delayed in Doze.

The app creates notification channels (`venzio_checkin`, `venzio_reminders`, `venzio_arrival`) on first use. Check-in shows an immediate confirmation; stale reminders use `allowWhileIdle` on Android.

### Custom plugins (both platforms)

| Plugin | Purpose |
|--------|---------|
| `NativeTrust` | Device hash, mock-location hints |
| `NativeSession` | Persist login across app restarts |
| `NativeGeofence` | Office arrival monitoring |

## Environment

| Variable | Purpose |
|----------|---------|
| `CAPACITOR_SERVER_URL` | WebView entry (e.g. `https://venzio.ai/me` or staging) |

After changing web code that affects auth or notifications, deploy the server **and** rebuild the native app if plugins changed.

## iOS opens Safari / no permissions / feels like a website

The native shell loads **your hosted URL** (`https://venzio.ai/me`). Most UI and fixes come from the **deployed website**, not only the Xcode build.

| Symptom | Cause | Fix |
|---------|--------|-----|
| Banner “Add to Home Screen” / Share in Safari | PWA install prompt treated native WebView as Safari | Deploy latest web code; rebuild iOS |
| Login only works in Safari | Session cookies + PWA metadata in WebView | Deploy web + `NativeSession` plugin (rebuild iOS) |
| No notification/location prompts | `Capacitor.isNativePlatform()` false in Safari | Stay in app WebView; deploy web fixes |
| Blank or external browser | `target=_blank` / navigation | Rebuild iOS (`MyViewController` keeps links in-app) |

**Verify you are in the native app:** In Safari you will **not** get native plugins. The Venzio icon must be the Xcode-built app, not a home-screen bookmark.

**Local dev against your Mac:**

```bash
CAPACITOR_SERVER_URL=http://127.0.0.1:3000/me npm run cap:sync:ios
```

Run `npm run dev` on the Mac, then run from Xcode. Simulator uses `127.0.0.1`; a physical iPhone needs your Mac’s LAN IP instead.
