# Research: packaging

## Toolchain choice: Capacitor 8 wins, but Cordova is a close and lighter second

**Recomendacion:** Use Capacitor 8.5.1 (@capacitor/core, @capacitor/cli, @capacitor/android all at 8.5.1). Reject TWA outright — it is disqualified, not merely worse. Reject a hand-rolled WebView wrapper unless you want to hand-maintain Gradle files.

TWA (Trusted Web Activity) is disqualified on two independent grounds: it loads the app from an HTTPS origin over the network, and it requires a Digital Asset Links file served from that domain to verify ownership. A 100%-offline app has no origin and no domain. Do not use Bubblewrap here regardless of how often it is recommended for 'web app to APK'.

Cordova would work and produces a marginally smaller APK, but its plugin ecosystem is in maintenance drift and its Android platform lags AGP/target-SDK deadlines. Capacitor's android/ folder is a plain, checked-in Gradle project you can edit directly — which is exactly what you need for the manifest/immersive/orientation edits below.

A hand-rolled WebView wrapper is genuinely viable for this narrow case (~1.2 MB APK, one Activity, zero dependencies) and is the smallest possible output. Choose it only if you are comfortable writing build.gradle by hand. Capacitor costs roughly +2-3 MB for a scaffold that already handles asset copying, the local scheme, and versioned Gradle wiring.

Expected APK size, debug, single game: Capacitor ~3.5-4.5 MB; Cordova ~3-4 MB; hand-rolled ~1.2 MB. All are trivially WhatsApp-adjacent in size; size is not the deciding factor here, setup friction is.

**Por que:** Verified @capacitor/{core,cli,android} all publish 8.5.1 and @capacitor/cli@8.5.1 declares engines {node:'>=22.0.0'}, which the machine's Node v24.17.0 satisfies. TWA's Digital Asset Links + HTTPS-origin requirement is structural, not configurable, so it cannot meet the offline constraint.

## CRITICAL — JDK 17 is sufficient; do NOT install JDK 21

**Recomendacion:** Keep the existing Temurin 17. Verified locally: openjdk 17.0.20 (Temurin-17.0.20+8), javac 17.0.20, JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot\'.

Capacitor 8's docs say 'Android Studio 2025.2.1+', and a large amount of forum advice reads that as 'you need JDK 21'. That is wrong for a command-line build. The actual constraint is the Android Gradle Plugin's floor, and AGP 8.13.0's official compatibility table is: JDK minimum 17 / default 17, Gradle minimum 8.13, SDK Build-Tools 35.0.0. Capacitor 8 ships AGP 8.13.0 and Gradle 8.14.3, so JDK 17 is above the floor.

The 'Android Studio bundles JDK 21' statement is about the IDE's own runtime, not a build requirement. Since you are building with ./gradlew and never opening Android Studio, it does not apply.

Only if you hit 'Unsupported class file major version' should you revisit — and that error means Gradle is too OLD for the JDK, i.e. it appears when someone runs JDK 21+ against an older Gradle. Installing JDK 21 is the thing most likely to CAUSE it, not fix it.

**Por que:** Fetched the AGP 8.13.0 release notes compatibility table directly: JDK minimum 17, default 17. Confirmed the local JDK is 17.0.20 with JAVA_HOME already set, so no toolchain change is needed and a 'helpful' JDK 21 install would add risk.

## Exact scaffold sequence, empty folder to debug APK (Windows PowerShell)

**Recomendacion:** Put the game at web/index.html first (Capacitor needs a webDir that already contains index.html or `cap add` fails).

  mkdir C:\dev\romina-game; cd C:\dev\romina-game
  npm init -y
  npm i -D @capacitor/cli@8.5.1
  npm i @capacitor/core@8.5.1 @capacitor/android@8.5.1
  mkdir web
  # copy game files into .\web\ ; index.html MUST exist before the next step
  npx cap init "Juegos Romina" com.romina.juegos --web-dir=web
  npx cap add android
  npx cap sync android
  cd android
  .\gradlew.bat assembleDebug

Output lands at:
  C:\dev\romina-game\android\app\build\outputs\apk\debug\app-debug.apk

After ANY change to files in web\, re-run `npx cap sync android` (or at minimum `npx cap copy android`) before rebuilding — editing web\ alone does nothing, because the build packages android\app\src\main\assets\public\, which sync overwrites.

appId rules that commonly bite: must have at least two segments separated by a dot, must not start a segment with a digit, and hyphens are illegal. 'com.romina.juegos' is safe; 'com.romina.juegos-2' or 'com.romina.2juegos' will fail.

First `gradlew.bat assembleDebug` downloads Gradle 8.14.3 plus the whole dependency graph: expect 5-15 minutes and ~500 MB-1 GB into C:\Users\ander\.gradle. Later builds are 20-60 seconds.

**Por que:** Command order is dictated by Capacitor's own validation: `cap init` writes the config, `cap add android` scaffolds and immediately copies webDir, and it errors out if webDir has no index.html. Version-pinning all three packages to 8.5.1 avoids the very common failure where cli and android drift to different majors.

```js
npm i -D @capacitor/cli@8.5.1
npm i @capacitor/core@8.5.1 @capacitor/android@8.5.1
npx cap init "Juegos Romina" com.romina.juegos --web-dir=web
npx cap add android
npx cap sync android
cd android && .\gradlew.bat assembleDebug
```

## capacitor.config.json — and what it genuinely cannot do

**Recomendacion:** Write capacitor.config.json exactly as below. Be aware that of your five requirements, this file only delivers black background and overscroll-adjacent behavior; portrait lock, immersive, and permission removal are NOT Capacitor config options and must be done in the native project (next findings). Any guide claiming a config key for orientation is wrong.

Use androidScheme 'https' with hostname 'localhost' (Capacitor's default). Do not switch it to 'file' — that silently breaks localStorage/IndexedDB persistence and is a classic 'her high score vanished' bug.

Set webContentsDebuggingEnabled true while you are still iterating: it lets you attach chrome://inspect over USB to profile the 60fps target on the Adreno 612. Flip to false for the final build.

**Por que:** Verified against the Capacitor config docs: android.backgroundColor, android.webContentsDebuggingEnabled, android.zoomEnabled, android.captureInput, server.androidScheme and server.hostname are real keys; there is no orientation or fullscreen key. The https/localhost scheme gives the WebView a stable secure origin so web storage persists across launches.

```js
{
  "appId": "com.romina.juegos",
  "appName": "Juegos Romina",
  "webDir": "web",
  "android": {
    "backgroundColor": "#000000",
    "allowMixedContent": false,
    "captureInput": true,
    "webContentsDebuggingEnabled": true,
    "zoomEnabled": false
  },
  "server": {
    "androidScheme": "https",
    "hostname": "localhost"
  }
}
```

## AndroidManifest.xml — portrait lock, zero network permission, screen-on

**Recomendacion:** Edit android\app\src\main\AndroidManifest.xml. Three things matter.

1) Remove INTERNET. Deleting the line is NOT enough — @capacitor/android's own library manifest merges INTERNET back in. You must actively override the merger with tools:node="remove", which requires the xmlns:tools namespace on <manifest>. Verify afterwards (see the verification finding); this is the single most-likely-to-silently-fail requirement in the brief.

2) Lock portrait with android:screenOrientation="portrait" on the activity. Add android:resizeableActivity="false" so MIUI's split-screen/floating-window gestures cannot letterbox the canvas mid-game.

3) Keep the screen on. Do NOT use the WAKE_LOCK permission — that adds a permission back, contradicting the no-permissions goal. Use android:keepScreenOn="true" on the activity's layout, or simplest, one line in MainActivity (next finding). getWindow().addFlags(FLAG_KEEP_SCREEN_ON) needs no permission at all.

On 'preventing the app from being killed': you cannot truly prevent this, and attempting it via foreground services would require permissions and make the app look sketchier. What actually matters for a casual game is that state survives being killed — so persist progress/high score to localStorage on every 'visibilitychange' to hidden, not on unload (Android WebViews frequently never fire unload/beforeunload). That is a web-side fix, and it is the right one.

**Por que:** Confirmed the manifest-merger behavior: library manifests inject permissions, and tools:node="remove" with the tools namespace is the documented mechanism to strip them. FLAG_KEEP_SCREEN_ON is a window flag rather than a permission, so it satisfies keep-awake without reintroducing a manifest permission.

```js
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

  <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />

  <application android:usesCleartextTraffic="false" ...>
    <activity
      android:name=".MainActivity"
      android:screenOrientation="portrait"
      android:resizeableActivity="false"
      android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
      android:exported="true"> ... </activity>
  </application>
</manifest>
```

## Immersive fullscreen must be native code — and targetSdk 36 removed the opt-out

**Recomendacion:** There is no Capacitor config flag for immersive mode; do it in android\app\src\main\java\com\romina\juegos\MainActivity.java.

Important behavior change: Capacitor 8 defaults to compileSdk/targetSdk 36. Android 15 (API 35) introduced edge-to-edge enforcement with an opt-out attribute (windowOptOutEdgeToEdgeEnforcement); for apps targeting API 36 that attribute is deprecated AND disabled — you cannot opt out. So do not chase the styles.xml opt-out flag, it is inert at targetSdk 36.

What still works is actively hiding the bars via WindowInsetsControllerCompat with BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE. Re-apply it in onWindowFocusChanged, because the bars come back after any interruption (notification shade pull, app switch) and a one-shot call in onCreate will appear to 'stop working'.

The device is 20:9 (1080x2400) with a punch-hole camera, so also set LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES in styles.xml, otherwise you get a black letterbox bar. Since you cannot avoid drawing under the cutout, keep the game's HUD inside a safe inset using CSS env(safe-area-inset-top).

Drop this in MainActivity.java (it also handles keep-screen-on, no permission needed).

**Por que:** Verified that for apps targeting Android 16 / API 36 the edge-to-edge opt-out attribute is deprecated and disabled, while WindowInsetsControllerCompat.hide() remains the supported path. Re-applying on focus change is required because transient-bar behavior restores system bars after user gestures.

```js
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle s) {
    super.onCreate(s);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideBars();
  }
  @Override public void onWindowFocusChanged(boolean f) {
    super.onWindowFocusChanged(f);
    if (f) hideBars();
  }
  private void hideBars() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c =
      new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    c.hide(WindowInsetsCompat.Type.systemBars());
    c.setSystemBarsBehavior(
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }
}
```

## Killing bounce/overscroll — CSS is necessary but not sufficient

**Recomendacion:** Do both layers; each alone leaves a visible artifact.

Web side (in the game's CSS/HTML) removes rubber-banding and the pull-to-refresh-style drag, and also kills the double-tap-zoom and long-press callout that ruin a touch game:

  html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#000;
    overscroll-behavior:none;touch-action:none;
    -webkit-user-select:none;user-select:none;
    -webkit-tap-highlight-color:transparent;
    -webkit-touch-callout:none;}
  canvas{display:block;touch-action:none;}

Also add to index.html:
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">

viewport-fit=cover is required for the punch-hole/cutout handling above to behave.

Native side removes the blue/grey glow the WebView paints at scroll limits, which CSS cannot reach. In MainActivity.onCreate, after super.onCreate:

  bridge.getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);

touch-action:none is the one that most often gets omitted; without it Chrome delays or steals touch events for gesture detection and you will see input lag that gets misdiagnosed as a framerate problem.

**Por que:** overscroll-behavior and touch-action address DOM-level gesture handling, while the overscroll glow is drawn by the native View and is only removable via setOverScrollMode. Splitting the fix across both layers is why single-layer attempts appear to 'not work'.

```js
bridge.getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
```

## Local Android SDK via command-line tools only (no Android Studio)

**Recomendacion:** Download commandlinetools-win-15859902_latest.zip (155.7 MB, SHA-256 90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a) from the 'Command line tools only' section of developer.android.com/studio.

The nesting is the classic trap. sdkmanager requires the path <SDK>\cmdline-tools\latest\bin. The zip extracts to a folder literally named cmdline-tools, so a naive extract yields ...\cmdline-tools\bin and every command fails with 'Could not determine SDK root'.

PowerShell, exact:

  $sdk="C:\Android\sdk"
  New-Item -ItemType Directory -Force "$sdk\cmdline-tools" | Out-Null
  Expand-Archive "$env:USERPROFILE\Downloads\commandlinetools-win-15859902_latest.zip" -DestinationPath "$env:TEMP\cmdt" -Force
  Move-Item "$env:TEMP\cmdt\cmdline-tools" "$sdk\cmdline-tools\latest"

  setx ANDROID_HOME "$sdk"
  setx ANDROID_SDK_ROOT "$sdk"
  # then OPEN A NEW TERMINAL — setx does not affect the current session

  & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
  & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"

Pin build-tools 36.0.0 to match compileSdk 36. Accept every license prompt with 'y'; an unaccepted license surfaces later as a confusing Gradle failure, not a license error.

Download budget: cmdline-tools 156 MB + platform-tools ~15 MB + platform android-36 ~60 MB + build-tools ~55 MB ≈ 290 MB, roughly 5-10 minutes on a decent line. Then Gradle pulls another ~500 MB-1 GB on first build. Total realistic first-run: ~1 GB and 20-30 minutes.

Note the docs now describe sdkmanager as deprecated in favor of a newer `android sdk` command, but sdkmanager.bat still ships in this package and remains the reliable route today.

**Por que:** Filename, size and checksum were read from the current Android Studio download page. The cmdline-tools/latest nesting requirement is a documented layout constraint and the most frequent setup failure. Build-tools 36.0.0 is the current stable and aligns with Capacitor 8's compileSdk 36.

```js
$sdk="C:\Android\sdk"
Move-Item "$env:TEMP\cmdt\cmdline-tools" "$sdk\cmdline-tools\latest"
setx ANDROID_HOME "$sdk"
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

## GitHub Actions alternative — no local SDK at all

**Recomendacion:** ubuntu-latest already ships the Android SDK and sets ANDROID_HOME, so you need no SDK install step. Pin Java to 17 with setup-java (temurin) to mirror local behavior and stay at AGP 8.13's floor.

Commit the repo (including the android\ folder — Capacitor's android project is meant to be checked in), push, and read the APK from the run's Artifacts section: Actions tab, click the run, scroll to Artifacts, download romina-debug-apk.zip, unzip to get app-debug.apk. Artifacts are ZIPs, so the .apk arrives inside a zip — which incidentally solves the WhatsApp problem below.

Add workflow_dispatch so you can trigger builds manually from the web UI without pushing.

Build time is typically 3-6 minutes; enable the gradle cache to keep reruns near the low end.

Common failure: 'Permission denied' on ./gradlew, because Git on Windows does not preserve the executable bit. The chmod line below is not optional.

**Por que:** Confirmed GitHub's ubuntu-latest images preinstall the Android SDK with ANDROID_HOME predefined, so the workflow only needs Java pinned and Node for the Capacitor sync. The chmod +x step addresses the Windows-authored-repo case specifically.

```js
name: Build APK
on:
  push: { branches: [main] }
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: gradle
      - run: npm ci
      - run: npx cap sync android
      - run: chmod +x android/gradlew
      - run: ./gradlew assembleDebug
        working-directory: android
      - uses: actions/upload-artifact@v4
        with:
          name: romina-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
```

## Signing: debug-signed is fine here — do not overbuild this

**Recomendacion:** For sideloading to one person's phone, the debug APK from assembleDebug is already signed with the auto-generated debug keystore and installs normally. Use it. Debug signing is only a problem for Play Store upload (rejected) and for the 1-year debug-cert expiry, which is irrelevant at this scale.

One real consequence to know: debug builds set android:debuggable="true", which slightly slows the WebView (JIT/debug hooks) and can matter when chasing 60fps on a Snapdragon 678. If the game feels marginal, build a self-signed release instead — that alone can be worth a few frames.

Self-signed release, exact commands:

  keytool -genkeypair -v -keystore romina.keystore -alias romina -keyalg RSA -keysize 2048 -validity 10000 -storepass CHANGEME -keypass CHANGEME -dname "CN=Romina Game, O=Home, C=AR"

  cd android
  .\gradlew.bat assembleRelease
  # produces app-release-unsigned.apk

  & "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" sign --ks ..\romina.keystore --ks-key-alias romina --ks-pass pass:CHANGEME --out app-release.apk app\build\outputs\apk\release\app-release-unsigned.apk

  & "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --print-certs app-release.apk

Use apksigner, not jarsigner — apksigner applies v2/v3 scheme signatures, and modern Android rejects v1-only APKs on install.

Critical: keep romina.keystore forever and never commit it. If you lose it, you cannot ship an update over the installed app — she would have to uninstall (losing her high scores) before installing the new one. Signature mismatch is the #1 cause of INSTALL_FAILED_UPDATE_INCOMPATIBLE. Same rule applies to switching from debug- to release-signed later: that is a signature change, so uninstall first.

**Por que:** Debug keystores are auto-generated and install fine off-Store, making release signing unnecessary for a single-recipient sideload. The debuggable flag's WebView performance cost is the one genuine reason to prefer release given the 60fps target on mid-range hardware. apksigner is required because v1-only signatures are refused by current Android versions.

```js
keytool -genkeypair -v -keystore romina.keystore -alias romina -keyalg RSA -keysize 2048 -validity 10000
apksigner sign --ks romina.keystore --ks-key-alias romina --out app-release.apk app-release-unsigned.apk
apksigner verify --print-certs app-release.apk
```

## BLOCKER — WhatsApp refuses .apk files; use a zip or USB

**Recomendacion:** The delivery method in the brief does not work as stated. WhatsApp blocks executable attachments including .apk on every platform; the send will fail or the file will be rejected as unsupported. Plan around it.

Best options, in order:

1) Zip it. Send juegos-romina.zip. She taps it, MIUI's built-in File Manager opens the archive, she extracts, then taps the .apk. This works and needs no extra app — but adds an extraction step where a non-technical user can get lost.

2) USB, the smoothest path. Enable USB debugging on her phone (Settings > About phone > tap 'MIUI version' 7 times > back > Additional settings > Developer options > USB debugging), then:
     adb install -r app-debug.apk
   `-r` reinstalls over an existing copy. On MIUI you must ALSO enable 'Install via USB' in Developer options, and that toggle frequently requires a Xiaomi account and an active SIM/data connection — a well-known MIUI annoyance worth knowing before you are standing there with a cable.

3) Google Drive / Telegram. Both pass .apk untouched. Telegram is the least-friction of all: she taps the file, taps Install.

Do NOT use the 'rename .apk to .pdf' trick — she would have to rename it back with a file manager, which is more confusing than the zip, and MIUI hides extensions by default.

If you use the GitHub Actions route, the downloaded artifact is already a .zip containing the APK — you can forward that file directly.

**Por que:** Confirmed WhatsApp blocks executable file types (.exe/.apk/.bat and similar) as a platform-wide security policy, with zipping being the standard documented workaround. The MIUI 'Install via USB' account/SIM requirement is a long-standing device-specific gate that derails the USB path if unanticipated.

```js
adb install -r app-debug.apk
```

## MIUI install friction — exactly what she will see and tap

**Recomendacion:** Sequence on a Redmi Note 10:

1) She taps the APK. MIUI shows 'For your security, your phone is not allowed to install unknown apps from this source.' MIUI has no single master 'unknown sources' switch any more — permission is per-installing-app. So the app she opens the file WITH (File Manager, Chrome, Telegram) is the one needing permission. Tap Settings on that dialog and it jumps straight to the right toggle; otherwise: Settings > Privacy protection > Special permissions > Install unknown apps > [that app] > Allow.

2) MIUI runs its own scan and shows a full-screen-ish warning, often red-tinted, along the lines of 'This app is unverified / may be unsafe' or an 'App scanning' result. There is usually a small, low-contrast 'Install anyway' or 'Continue' link — deliberately less prominent than Cancel. This scan flags essentially every unsigned-by-a-known-developer APK; it does not mean anything is wrong.

3) Google Play Protect may add a second prompt: 'Send app for scanning?' — she can decline, or tap 'Install without scanning'. Declining is fine and keeps it fully offline.

4) MIUI Pure Mode: if enabled, it BLOCKS sideloading outright with no bypass on the install screen. Turn it off first: Settings > Privacy protection > Pure Mode (or Security app > Settings) > disable. Check this BEFORE you start, because when it is on the failure looks like a generic 'can't install' with no explanation.

Minimizing scariness — this is where your zero-permission manifest pays off. Because you removed INTERNET, the permission screen shows essentially nothing, so the install reads as clean. Concretely: give it a real app name (not 'MyApp'/'Untitled'), a proper icon (see below) so it is not the default grey Android robot, and be present for the first install. Tell her up front 'it will show two scary warnings, tap Install anyway both times' — expected warnings are far less alarming than surprise ones.

If install still fails, the usual MIUI culprit is MIUI Optimization: Developer options > turn OFF 'MIUI optimization', reboot, retry.

**Por que:** Verified MIUI replaced the global unknown-sources switch with per-app 'Install unknown apps' permissions, that Pure Mode disables sideloading entirely, and that disabling MIUI Optimization is the standard fix for otherwise-inexplicable sideload failures. The removed INTERNET permission genuinely produces an emptier, less alarming permission display.

## Icon and splash with no design tools — generate them from code

**Recomendacion:** You are already drawing 8-bit art with Canvas 2D, so reuse that skill: render the icon in a canvas in your browser, right-click > Save image, and let @capacitor/assets (verified current: 3.0.5) generate every density.

Produce two source files in an assets\ folder at the project root:
  assets\icon.png   — 1024x1024, opaque, keep art inside the middle ~66% (Android's adaptive-icon mask crops corners hard; art near edges gets clipped)
  assets\splash.png — 2732x2732, subject centered in the middle ~40%, black background to match backgroundColor

Then:
  npx @capacitor/assets generate --android
  npx cap sync android

That writes all mipmap densities, adaptive foreground/background layers, and splash drawables. Land-vs-portrait splash cropping is why the splash source must be square and center-safe.

A 60-second generator — paste into the browser console, save the result as icon.png:

  const c=document.createElement('canvas');c.width=c.height=1024;
  const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  x.fillStyle='#000';x.fillRect(0,0,1024,1024);
  const P=['#ff004d','#ffa300','#ffec27','#00e436','#29adff'];
  const S=64, off=256; // 8x8 grid of 64px 'pixels' centered in safe zone
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    x.fillStyle=P[(i*j+i)%P.length];
    x.fillRect(off+i*S, off+j*S, S, S);
  }
  c.toBlob(b=>{const a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download='icon.png';a.click();});

Replace the loop with an actual sprite from the game — a heart, a star, the player character — for something recognizable on her home screen.

Set the splash background to #000000 in capacitor.config.json's android.backgroundColor so there is no white flash between splash and first frame. That white flash is the most common 'feels cheap' artifact and it is a one-line fix.

**Por que:** Verified @capacitor/assets 3.0.5 is the current tool and generates Android densities plus adaptive-icon layers from single square sources. The safe-zone guidance reflects Android's adaptive-icon masking, which crops a significant margin and is the usual cause of clipped custom icons.

```js
npx @capacitor/assets generate --android
npx cap sync android
```

## Verify the offline guarantee instead of assuming it

**Recomendacion:** Do not trust that INTERNET was actually stripped — the manifest merger is exactly the kind of thing that silently reinstates it. Check the built APK:

  & "$env:ANDROID_HOME\build-tools\36.0.0\aapt2.exe" dump permissions .\android\app\build\outputs\apk\debug\app-debug.apk

A correct build lists no android.permission.INTERNET. If it appears, the tools:node="remove" line or the xmlns:tools namespace is missing/misplaced.

Also inspect the merged manifest, which shows exactly which library injected what:
  android\app\build\outputs\logs\manifest-merger-debug-report.txt

Then prove it end-to-end on the device: put the phone in Airplane mode and play a full session. With INTERNET removed the app physically cannot reach the network even if some stray code tried — which is the strongest possible form of the offline guarantee, and better than a promise in a README.

One caveat worth designing around: with INTERNET removed, any accidental absolute URL (a CDN font, an analytics beacon) fails silently rather than loudly. Audit web\ for 'http://' and 'https://' before shipping; a blocked request can manifest as a mysterious startup hang rather than an obvious error.

**Por que:** The permission-removal requirement depends on manifest-merger behavior that is invisible in source, so APK-level verification with aapt2 is the only reliable confirmation. The merger report pinpoints the injecting library when removal fails, and airplane-mode testing validates the guarantee against the real runtime.

```js
aapt2 dump permissions app-debug.apk   # expect NO android.permission.INTERNET
```

## Pitfalls

- WhatsApp CANNOT send .apk files — it blocks executable attachments platform-wide. The delivery path named in the brief will fail. Zip the APK, or use USB/Telegram/Drive.
- Do NOT install JDK 21 'because Capacitor 8 needs it'. AGP 8.13.0's table says JDK minimum 17, and the machine already has Temurin 17.0.20 with JAVA_HOME set. The 'JDK 21' advice refers to Android Studio's bundled IDE runtime, not command-line Gradle builds.
- cmdline-tools nesting: the zip extracts to a folder named cmdline-tools, so a naive extract gives <SDK>\cmdline-tools\bin. sdkmanager requires <SDK>\cmdline-tools\latest\bin. Wrong nesting fails with 'Could not determine SDK root'.
- setx does not change the current shell. After setting ANDROID_HOME you MUST open a new terminal, or every subsequent command sees an empty variable.
- Deleting the INTERNET <uses-permission> line does nothing — @capacitor/android's library manifest merges it back. You need tools:node="remove" AND xmlns:tools on <manifest>. Verify with aapt2 dump permissions; never assume.
- Editing files in web\ without re-running `npx cap sync android` changes nothing. The build packages android\app\src\main\assets\public\, which sync overwrites.
- `npx cap add android` fails if webDir has no index.html. Create web\index.html before scaffolding.
- At targetSdk 36 (Capacitor 8's default) the edge-to-edge opt-out attribute is deprecated and disabled. Chasing windowOptOutEdgeToEdgeEnforcement in styles.xml is wasted effort — hide the bars via WindowInsetsControllerCompat instead.
- Calling hideBars() only in onCreate makes immersive mode 'stop working' after any notification-shade pull or app switch. Re-apply in onWindowFocusChanged.
- CSS overscroll-behavior alone does not remove the WebView's native overscroll glow. You also need setOverScrollMode(OVER_SCROLL_NEVER). Omitting touch-action:none causes input lag that gets misdiagnosed as low framerate.
- Do not set androidScheme to 'file' — it breaks localStorage/IndexedDB persistence, so her high scores vanish between launches. Keep https + localhost.
- MIUI Pure Mode blocks sideloading outright with no bypass on the install screen, and the failure looks like a generic 'can't install'. Disable it before starting.
- MIUI's 'Install via USB' toggle often demands a Xiaomi account sign-in and an active SIM/data connection — it will derail the adb path at the worst moment if unanticipated.
- Use apksigner, not jarsigner, for release signing. v1-only signatures are rejected on install by modern Android.
- Switching an installed app between debug- and release-signed, or losing romina.keystore, causes INSTALL_FAILED_UPDATE_INCOMPATIBLE. She must uninstall first, losing saved progress. Pick one signing mode and keep the keystore.
- In GitHub Actions, ./gradlew arrives non-executable from a Windows-authored repo. Without `chmod +x android/gradlew` the build fails with Permission denied.
- Adaptive icons crop hard — art near the edges of icon.png gets clipped by the mask. Keep it inside the middle ~66%.
- Android WebViews frequently never fire unload/beforeunload. Persist game state on visibilitychange to hidden, or progress is lost when MIUI kills the app.
- With INTERNET removed, a stray absolute URL fails silently and can look like a startup hang rather than a network error. Grep web\ for http:// and https:// before shipping.
- First Gradle build downloads ~500 MB-1 GB and takes 5-15 minutes. Budget ~1 GB / 20-30 min total for a cold local setup; do not assume the build is hung.
