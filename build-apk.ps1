# Construye el APK de ROMINA'S ARCADE.
# Uso:  powershell -ExecutionPolicy Bypass -File build-apk.ps1
#
# Requisitos: Node (ya lo tienes), Java 17 (ya lo tienes), Android SDK.
# Si no tienes el SDK, este script te dice como instalarlo y se detiene.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

Write-Host ''
Write-Host '=== ROMINA''S ARCADE - build APK ===' -ForegroundColor Magenta
Write-Host ''

# --- 1. Comprobar Java ---
try {
  $javaOut = (& java -version 2>&1) -join ' '
  if ($javaOut -match '"?(\d+)') { $jv = [int]$Matches[1] } else { $jv = 0 }
  if ($jv -ge 21) {
    Write-Host "AVISO: Java $jv detectado. Gradle de Capacitor falla con Java 21+." -ForegroundColor Yellow
    Write-Host 'Necesitas Java 17. Instala Temurin 17 y apunta JAVA_HOME ahi.' -ForegroundColor Yellow
    exit 1
  }
  Write-Host "Java $jv OK" -ForegroundColor Green
} catch {
  Write-Host 'ERROR: no se encuentra java en el PATH.' -ForegroundColor Red
  exit 1
}

# --- 2. Comprobar Android SDK ---
$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

if (-not (Test-Path $sdk)) {
  Write-Host 'FALTA EL ANDROID SDK.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'Opcion A - instalarlo (una sola vez, ~700MB):' -ForegroundColor Cyan
  Write-Host '  1. Baja las command-line tools de https://developer.android.com/studio#command-line-tools-only'
  Write-Host "  2. Descomprime en $sdk\cmdline-tools\latest"
  Write-Host "  3. setx ANDROID_HOME `"$sdk`""
  Write-Host "  4. $sdk\cmdline-tools\latest\bin\sdkmanager.bat `"platform-tools`" `"platforms;android-35`" `"build-tools;35.0.0`""
  Write-Host '  5. Vuelve a correr este script.'
  Write-Host ''
  Write-Host 'Opcion B - compilar en la nube gratis:' -ForegroundColor Cyan
  Write-Host '  Sube el proyecto a GitHub; el workflow en .github/workflows/apk.yml'
  Write-Host '  construye el APK solo y lo deja en Actions > Artifacts.'
  Write-Host ''
  exit 1
}
Write-Host "Android SDK: $sdk" -ForegroundColor Green
$env:ANDROID_HOME = $sdk

# --- 3. Dependencias de Capacitor ---
if (-not (Test-Path (Join-Path $root 'node_modules\@capacitor\cli'))) {
  Write-Host 'Instalando Capacitor...' -ForegroundColor Cyan
  npm i -D @capacitor/cli@8.5.1
  npm i @capacitor/core@8.5.1 @capacitor/android@8.5.1
}

# --- 4. Proyecto Android ---
if (-not (Test-Path (Join-Path $root 'android'))) {
  Write-Host 'Creando proyecto Android...' -ForegroundColor Cyan
  npx cap add android
}

Write-Host 'Sincronizando archivos del juego...' -ForegroundColor Cyan
npx cap sync android

# --- 5. Parchear el manifest: quitar INTERNET, bloquear vertical ---
$manifest = Join-Path $root 'android\app\src\main\AndroidManifest.xml'
if (Test-Path $manifest) {
  $m = Get-Content $manifest -Raw
  if ($m -notmatch 'xmlns:tools') {
    $m = $m -replace '(<manifest\s+xmlns:android="[^"]+")', '$1 xmlns:tools="http://schemas.android.com/tools"'
  }
  # Capacitor reinyecta INTERNET: hay que forzar su eliminacion, no basta borrar la linea.
  if ($m -notmatch 'android.permission.INTERNET"\s+tools:node="remove"') {
    $m = $m -replace '(<application)', @"
<uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />

    `$1
"@
  }
  if ($m -notmatch 'screenOrientation') {
    $m = $m -replace '(<activity\s)', '$1android:screenOrientation="portrait" android:resizeableActivity="false" '
  }
  Set-Content $manifest $m -Encoding utf8
  Write-Host 'Manifest parcheado: sin INTERNET, vertical fijo' -ForegroundColor Green
}

# --- 6. Compilar ---
Write-Host ''
Write-Host 'Compilando APK (la primera vez tarda 5-15 min)...' -ForegroundColor Cyan
Set-Location (Join-Path $root 'android')
& .\gradlew.bat assembleDebug
Set-Location $root

$apk = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  $dest = Join-Path $root 'RominaArcade.apk'
  Copy-Item $apk $dest -Force
  $mb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
  Write-Host ''
  Write-Host "LISTO -> $dest  ($mb MB)" -ForegroundColor Green
  Write-Host ''
  Write-Host 'Para pasarselo a Romina:' -ForegroundColor Cyan
  Write-Host '  - WhatsApp NO acepta .apk. Usa Telegram, Drive, o cable USB.'
  Write-Host '  - En el celular: Ajustes > permitir instalar apps de origen desconocido.'
  Write-Host '  - MIUI mostrara un aviso de seguridad: es normal al instalar fuera de la tienda.'
} else {
  Write-Host 'La compilacion no genero el APK. Revisa los errores de Gradle arriba.' -ForegroundColor Red
  exit 1
}
