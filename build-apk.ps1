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
# Capacitor EXIGE Java 21 (con 17 falla Gradle). Antes este bloque rechazaba
# Java 21+, que es justo el que hace falta.
#
# `java -version` escribe en STDERR aunque todo vaya bien. En PowerShell 5.1 un
# `2>&1` sobre un exe nativo envuelve cada linea en un ErrorRecord, lo que
# disparaba el catch y abortaba con 'no se encuentra java' teniendo Java
# instalado y funcionando. Por eso aqui no se redirige stderr.
# Se busca SIEMPRE un JDK 21, sin mirar primero JAVA_HOME ni el PATH: en esta
# maquina conviven un Java 17 (primero en el PATH) y el 21, y Gradle necesita
# el 21. Confiar en el PATH elegia el 17 y la compilacion fallaba.
$jdk21 = $null
foreach ($d in @("$env:ProgramFiles\Microsoft", "$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Java")) {
  if (-not (Test-Path $d)) { continue }
  $hit = Get-ChildItem $d -Directory -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match 'jdk-?21' } |
         Sort-Object Name -Descending | Select-Object -First 1
  if ($hit) { $jdk21 = $hit.FullName; break }
}
if ($jdk21) {
  $env:JAVA_HOME = $jdk21
  $env:PATH = (Join-Path $jdk21 'bin') + ';' + $env:PATH
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-Host 'ERROR: no se encuentra java. Instala Java 21 (Temurin o Microsoft OpenJDK).' -ForegroundColor Red
  exit 1
}
# `java -version` escribe en STDERR aunque todo vaya bien; en PowerShell 5.1 eso
# genera un NativeCommandError. Se captura con cmd para evitar ese ruido.
$javaExe = Join-Path (Join-Path $env:JAVA_HOME 'bin') 'java.exe'
$javaOut = (cmd /c "`"$javaExe`" -version 2>&1") -join ' '
if ($javaOut -match 'version "?(\d+)') { $jv = [int]$Matches[1] } else { $jv = 0 }
if ($jv -lt 21) {
  Write-Host "AVISO: Java $jv detectado. Capacitor necesita Java 21." -ForegroundColor Yellow
  exit 1
}
Write-Host "Java $jv OK" -ForegroundColor Green

# --- 2. Comprobar Android SDK ---
# Se prueban varias ubicaciones: en esta maquina el SDK esta en C:\Android\Sdk,
# no en la ruta por defecto, y sin las variables de entorno definidas.
$sdk = $null
foreach ($cand in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT,
                    (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
                    'C:\Android\Sdk')) {
  if ($cand -and (Test-Path (Join-Path $cand 'platform-tools'))) { $sdk = $cand; break }
}
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

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

# --- 4b. Regenerar el icono ---
# Va DESPUES de `cap sync` a proposito: Capacitor reescribe los mipmap con su
# icono por defecto, asi que generar antes no serviria de nada. El icono se
# dibuja por codigo, como el resto del arte del juego; no hay PNG de origen que
# se pueda perder al recrear la carpeta android/.
$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) {
  Write-Host 'Generando el icono...' -ForegroundColor Cyan
  & python (Join-Path $root 'tools\icono.py')
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'AVISO: el icono no se genero. Se sigue con el de Capacitor.' -ForegroundColor Yellow
  }
} else {
  Write-Host 'AVISO: sin python, no se regenera el icono (hace falta Pillow).' -ForegroundColor Yellow
}

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
