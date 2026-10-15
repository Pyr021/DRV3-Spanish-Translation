# Instalador de la traduccion al espanol de Danganronpa V3: Killing Harmony
# Metodo: Reloaded II portatil + CriFs.V2.Hook (sustitucion de archivos en memoria,
# sin tocar los CPK del juego). Este es el metodo QUE YA FUNCIONA Y SE HA JUGADO
# durante dias sin problemas; este instalador simplemente lo automatiza para que
# cualquiera pueda instalarlo con un doble clic, sin tocar nada manualmente.
#
# Que hace exactamente:
#  1. Localiza la carpeta de instalacion del juego.
#  2. Copia una copia portatil de Reloaded II + el mod CriFs.V2.Hook (con la
#     traduccion ya integrada) a "<juego>\_Reloaded\".
#  3. Registra esa copia portatil en la configuracion de Reloaded II del usuario
#     (%APPDATA%\Reloaded-Mod-Loader-II\ReloadedII.json), SOLO si no hay ya una
#     instalacion de Reloaded II configurada (no pisamos una instalacion existente).
#  4. Genera el AppConfig.json para que Reloaded sepa donde esta el juego.
#  5. Copia dinput8.dll (Ultimate ASI Loader) y el Bootstrapper de Reloaded
#     (como .asi) a la carpeta del juego, haciendo copia de seguridad de
#     cualquier dinput8.dll preexistente.
#
# Nada de esto modifica los archivos CPK del juego. Es 100% reversible borrando
# "_Reloaded" y restaurando los 2 archivos de la raiz del juego.

param(
    [string]$GameDir = "",
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PortableSrc = Join-Path $ScriptDir 'ReloadedPortable'
$AsiLoaderSrc = Join-Path $ScriptDir 'AsiLoader\dinput8.dll'

function Test-GameRoot([string]$dir) {
    if (-not $dir) { return $false }
    return (Test-Path (Join-Path $dir 'data\win\partition_data_win_us.cpk')) -and (Test-Path (Join-Path $dir 'Dangan3Win.exe'))
}

function Find-GameRoot {
    $cands = @()
    try {
        $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
        if ($steam) { $cands += (Join-Path $steam 'steamapps\common\Danganronpa V3 Killing Harmony') }
    } catch {}
    $cands += @(
        "${env:ProgramFiles(x86)}\Steam\steamapps\common\Danganronpa V3 Killing Harmony",
        "$env:ProgramFiles\Steam\steamapps\common\Danganronpa V3 Killing Harmony",
        'C:\SteamLibrary\steamapps\common\Danganronpa V3 Killing Harmony',
        'D:\SteamLibrary\steamapps\common\Danganronpa V3 Killing Harmony',
        'E:\SteamLibrary\steamapps\common\Danganronpa V3 Killing Harmony'
    )
    foreach ($c in $cands) { if (Test-GameRoot $c) { return $c } }
    return $null
}

Write-Host ''
Write-Host '=================================================================='
Write-Host '  Danganronpa V3: Killing Harmony  -  Traduccion al espanol'
Write-Host '  (metodo: Reloaded II portatil, no modifica los archivos del juego)'
Write-Host '=================================================================='
Write-Host ''

# ---------- 0. Comprobar requisitos del sistema ----------
# Reloaded II necesita .NET 9 Desktop Runtime (x64) para funcionar.
# Las DLLs del Visual C++ Runtime (vcruntime140.dll, vcruntime140_1.dll, msvcp140.dll)
# ya van incluidas junto al bootstrapper en el paquete, asi que no hace falta instalarlas.
# Sin .NET 9, el juego mostrara:
#   "Unable to load Reloaded.Mod.Loader.Bootstrapper.asi. Error: 126"
Write-Host 'Comprobando requisitos del sistema...' -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# El Loader de Reloaded II requiere .NET 9 Desktop Runtime >= 9.0.8 (segun runtimeconfig.json).
# Comprobamos si hay una version 9.0.8+ instalada.
$dotnetOk = $false
try {
    $runtimes = & dotnet --list-runtimes 2>$null
    if ($runtimes) {
        foreach ($rt in $runtimes) {
            if ($rt -match 'Microsoft\.WindowsDesktop\.App (\d+)\.(\d+)\.(\d+)') {
                $major = [int]$Matches[1]; $minor = [int]$Matches[2]; $patch = [int]$Matches[3]
                if ($major -eq 9 -and $minor -eq 0 -and $patch -ge 8) { $dotnetOk = $true; break }
                if ($major -eq 9 -and $minor -gt 0) { $dotnetOk = $true; break }
                if ($major -gt 9) { $dotnetOk = $true; break }
            }
        }
    }
} catch {}

if (-not $dotnetOk) {
    Write-Host ''
    Write-Host '  No se ha encontrado .NET 9 Desktop Runtime (>= 9.0.8) en este equipo.' -ForegroundColor Yellow
    Write-Host '  Es necesario para que la traduccion funcione.' -ForegroundColor Yellow
    Write-Host '  Se va a descargar e instalar automaticamente (necesita Internet).' -ForegroundColor Yellow

    $dotnetUrl = 'https://builds.dotnet.microsoft.com/dotnet/WindowsDesktop/9.0.20/windowsdesktop-runtime-9.0.20-win-x64.exe'
    $dotnetInstaller = Join-Path $env:TEMP 'dotnet9-desktop-runtime.exe'

    try {
        Write-Host '  Descargando .NET 9 Desktop Runtime (~58 MB)...' -ForegroundColor Cyan
        (New-Object Net.WebClient).DownloadFile($dotnetUrl, $dotnetInstaller)
        Write-Host '  Descargado. Instalando (puede pedir permiso de administrador)...' -ForegroundColor Cyan
        # Usar -Verb RunAs para solicitar elevacion si no somos admin
        $proc = Start-Process -FilePath $dotnetInstaller -ArgumentList '/install','/quiet','/norestart' -Verb RunAs -Wait -PassThru
        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
            Write-Host "  Codigo de salida: $($proc.ExitCode). Prueba a instalar .NET 9 manualmente desde:" -ForegroundColor Yellow
            Write-Host '  https://dotnet.microsoft.com/en-us/download/dotnet/9.0' -ForegroundColor Yellow
        } else {
            Write-Host '  .NET 9 Desktop Runtime instalado correctamente.' -ForegroundColor Green
        }
    } catch {
        Write-Host ''
        Write-Host '  No se ha podido instalar automaticamente (puede haberse cancelado' -ForegroundColor Red
        Write-Host '  el permiso de administrador o no haber conexion a Internet).' -ForegroundColor Red
        Write-Host '  Por favor, instala .NET 9 Desktop Runtime (x64) manualmente desde:' -ForegroundColor Red
        Write-Host '  https://dotnet.microsoft.com/en-us/download/dotnet/9.0' -ForegroundColor Cyan
        Write-Host '  (busca "Desktop Runtime" > Windows x64 > descarga e instala)' -ForegroundColor Cyan
        Write-Host ''
        if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
        exit 1
    }
    Remove-Item $dotnetInstaller -Force -ErrorAction SilentlyContinue
} else {
    Write-Host '  .NET 9 Desktop Runtime: OK' -ForegroundColor Green
}

Write-Host ''

# ---------- 1. Localizar el juego ----------
$dir = $GameDir
if (-not (Test-GameRoot $dir)) { $dir = Find-GameRoot }
if (-not (Test-GameRoot $dir)) {
    Write-Host 'No he podido encontrar el juego automaticamente.' -ForegroundColor Yellow
    Write-Host 'Indica la carpeta de instalacion del juego (la que contiene "Dangan3Win.exe").'
    $dir = (Read-Host 'Ruta').Trim().Trim('"')
    if (-not (Test-GameRoot $dir)) {
        Write-Host 'No encuentro Dangan3Win.exe o data\win\partition_data_win_us.cpk en esa carpeta.' -ForegroundColor Red
        if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
        exit 1
    }
}
Write-Host "Juego encontrado en: $dir" -ForegroundColor Green

$ReloadedDestDir = Join-Path $dir '_Reloaded'

if (Test-Path $ReloadedDestDir) {
    Write-Host ''
    Write-Host 'Parece que la traduccion ya esta instalada (existe la carpeta "_Reloaded").' -ForegroundColor Yellow
    Write-Host 'Ejecuta primero "Desinstalar.bat" si quieres reinstalar desde cero.'
    if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
    exit 1
}

# ---------- 2. Copiar Reloaded II portatil ----------
Write-Host 'Copiando Reloaded II (portatil) al juego...' -ForegroundColor Cyan
Copy-Item $PortableSrc $ReloadedDestDir -Recurse -Force
New-Item -ItemType File -Force (Join-Path $ReloadedDestDir 'portable.txt') | Out-Null
Write-Host '  Hecho.' -ForegroundColor Green

# ---------- 3. Generar AppConfig.json apuntando al juego ----------
Write-Host 'Configurando la aplicacion...' -ForegroundColor Cyan
$appConfigDir = Join-Path $ReloadedDestDir 'Apps\dangan3win.exe'
New-Item -ItemType Directory -Force $appConfigDir | Out-Null
$appConfig = [ordered]@{
    AppId = 'dangan3win.exe'
    AppName = 'Danganronpa V3: Killing Harmony'
    AppLocation = (Join-Path $dir 'Dangan3Win.exe')
    AppArguments = ''
    AppIcon = 'Icon.png'
    AutoInject = $false
    EnabledMods = @('crifs.v2.hook')
    WorkingDirectory = $dir
    PluginData = @{}
    SortedMods = @('crifs.v2.hook','reloaded.sharedlib.hooks')
    PreserveDisabledModOrder = $true
    DontInject = $false
    IsMsStore = $false
}
$appConfig | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $appConfigDir 'AppConfig.json')
Write-Host '  Hecho.' -ForegroundColor Green

# ---------- 4. Registrar la instalacion portatil del usuario (sin pisar una ya existente) ----------
Write-Host 'Registrando Reloaded II en la configuracion del usuario...' -ForegroundColor Cyan
$configDir = Join-Path $env:APPDATA 'Reloaded-Mod-Loader-II'
$configFile = Join-Path $configDir 'ReloadedII.json'
New-Item -ItemType Directory -Force $configDir | Out-Null

$loaderX64 = Join-Path $ReloadedDestDir 'Loader\X64\Reloaded.Mod.Loader.dll'
$loaderX86 = Join-Path $ReloadedDestDir 'Loader\X86\Reloaded.Mod.Loader.dll'
$bootstrap64 = Join-Path $ReloadedDestDir 'Loader\X64\Bootstrapper\Reloaded.Mod.Loader.Bootstrapper.dll'
$bootstrap32 = Join-Path $ReloadedDestDir 'Loader\X86\Bootstrapper\Reloaded.Mod.Loader.Bootstrapper.dll'

$existingConfig = $null
if (Test-Path $configFile) {
    try { $existingConfig = Get-Content $configFile -Raw | ConvertFrom-Json } catch { $existingConfig = $null }
}

$script:UsedExistingReloaded = $false
$script:ExistingModsDirTouched = $null

if ($existingConfig -and $existingConfig.ApplicationConfigDirectory -and (Test-Path $existingConfig.ApplicationConfigDirectory)) {
    Write-Host '  Ya tienes Reloaded II instalado; se usara esa instalacion en vez de crear una nueva.' -ForegroundColor Yellow
    $script:TouchedGlobalConfig = $false
    $script:UsedExistingReloaded = $true

    # Instalar (copiar) el mod CriFs.V2.Hook + dependencias a la instalacion
    # existente del usuario, igual que si lo hubiera instalado el mismo desde
    # el gestor de mods. Esto es necesario para que "doble clic" funcione
    # tambien si el usuario ya tenia Reloaded II por otro juego.
    $existingModsDir = $existingConfig.ModConfigDirectory
    $existingAppsDir = $existingConfig.ApplicationConfigDirectory
    if ($existingModsDir -and (Test-Path $existingModsDir)) {
        Write-Host '  Instalando el mod de traduccion en tu Reloaded II existente...' -ForegroundColor Cyan
        foreach ($modName in @('CriFs.V2.Hook','reloaded.sharedlib.hooks','Reloaded.Memory.SigScan.ReloadedII')) {
            $srcMod = Join-Path $PortableSrc "Mods\$modName"
            $dstMod = Join-Path $existingModsDir $modName
            if (Test-Path $srcMod) {
                if (-not (Test-Path $dstMod)) {
                    Copy-Item $srcMod $dstMod -Recurse -Force
                    Write-Host "    -> $modName instalado." -ForegroundColor Green
                } else {
                    # Ya existe el mod (p.ej. el usuario ya lo tenia para otro
                    # juego). Solo nos aseguramos de que la traduccion este
                    # dentro de su copia de CriFs.V2.Hook.
                    if ($modName -eq 'CriFs.V2.Hook') {
                        $srcCpk = Join-Path $srcMod 'CRIFsV2Hook\CPK'
                        $dstCpk = Join-Path $dstMod 'CRIFsV2Hook\CPK'
                        if (Test-Path $srcCpk) {
                            Copy-Item "$srcCpk\*" $dstCpk -Recurse -Force
                            Write-Host "    -> Traduccion copiada dentro del mod CriFs.V2.Hook existente." -ForegroundColor Green
                        }
                    } else {
                        Write-Host "    -> $modName ya estaba instalado; no se toca." -ForegroundColor Yellow
                    }
                }
            }
        }
        $script:ExistingModsDirTouched = $existingModsDir
    }

    # Generar/actualizar el AppConfig.json dentro de la instalacion EXISTENTE
    # del usuario (ademas del que ya escribimos en nuestra copia portatil),
    # para que el juego aparezca configurado correctamente en su Reloaded II.
    if ($existingAppsDir -and (Test-Path $existingAppsDir)) {
        $existingAppConfigDir = Join-Path $existingAppsDir 'dangan3win.exe'
        if (-not (Test-Path $existingAppConfigDir)) {
            New-Item -ItemType Directory -Force $existingAppConfigDir | Out-Null
            $appConfig | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 (Join-Path $existingAppConfigDir 'AppConfig.json')
            Write-Host '    -> Aplicacion configurada en tu Reloaded II existente.' -ForegroundColor Green
        } else {
            Write-Host '    -> La aplicacion ya estaba configurada en tu Reloaded II; no se toca.' -ForegroundColor Yellow
        }
    }
} else {
    # No habia config valida: la creamos nosotros, apuntando a nuestra copia portatil.
    if (Test-Path $configFile) {
        Copy-Item $configFile "$configFile.bak_es" -Force
    }
    $newConfig = [ordered]@{
        LoaderPath32 = $loaderX86
        LoaderPath64 = $loaderX64
        LauncherPath = ''
        Bootstrapper32Path = $bootstrap32
        Bootstrapper64Path = $bootstrap64
        ApplicationConfigDirectory = (Join-Path $ReloadedDestDir 'Apps')
        ModUserConfigDirectory = (Join-Path $ReloadedDestDir 'User\Mods')
        MiscConfigDirectory = (Join-Path $ReloadedDestDir 'User\Misc')
        PluginConfigDirectory = (Join-Path $ReloadedDestDir 'Plugins')
        ModConfigDirectory = (Join-Path $ReloadedDestDir 'Mods')
        EnabledPlugins = @()
        LanguageFile = (Join-Path $ReloadedDestDir 'Assets\Languages\es-ES.xaml')
        ThemeFile = ''
        FirstLaunch = $false
        ShowConsole = $false
        LogFileCompressTimeHours = 6
        LogFileDeleteHours = 336
        CrashDumpDeleteHours = 24
        NuGetFeeds = @()
        ForceModPrereleases = $false
        ReloadedProcessListRefreshInterval = 1000
        LoaderSetupTimeout = 30000
        LoaderSetupSleeptime = 32
        ProcessRefreshInterval = 200
        SkipWineLaunchWarning = $false
        DisableDInput = $false
    }
    $newConfig | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $configFile
    $script:TouchedGlobalConfig = $true
    Write-Host '  Hecho.' -ForegroundColor Green
}

# ---------- 5. Activar el cargador ASI en la carpeta del juego ----------
Write-Host 'Activando el cargador de mods en el juego...' -ForegroundColor Cyan
$targetDinput = Join-Path $dir 'dinput8.dll'
$targetAsi = Join-Path $dir 'Reloaded.Mod.Loader.Bootstrapper.asi'

# Marcador explicito de lo que este instalador ha tocado, para que el
# desinstalador sepa EXACTAMENTE que revertir (no se basa en adivinar).
$marker = [ordered]@{
    InstalledDinputFromScratch = $false
    DinputHadBackup = $false
    TouchedGlobalConfig = $false
    AsiCreated = $false
    UsedExistingReloaded = [bool]$script:UsedExistingReloaded
    ExistingModsDir = $script:ExistingModsDirTouched
}

if (Test-Path $targetDinput) {
    $existingHash = (Get-FileHash $targetDinput -Algorithm SHA256).Hash
    $ourHash = (Get-FileHash $AsiLoaderSrc -Algorithm SHA256).Hash
    if ($existingHash -ne $ourHash) {
        Copy-Item $targetDinput "$targetDinput.bak_es" -Force
        Write-Host '  Se ha guardado una copia de seguridad del dinput8.dll existente (dinput8.dll.bak_es).' -ForegroundColor Yellow
        $marker.DinputHadBackup = $true
    }
    # Si ya habia un dinput8.dll identico al nuestro, no lo consideramos
    # "instalado por nosotros" a efectos de desinstalacion (puede ser de
    # otra instalacion previa del propio usuario); lo dejamos tal cual.
} else {
    $marker.InstalledDinputFromScratch = $true
}
Copy-Item $AsiLoaderSrc $targetDinput -Force
Copy-Item $bootstrap64 $targetAsi -Force
# Copiar las DLLs del VC++ Runtime junto al .asi (el bootstrapper las busca
# primero en su propio directorio, asi no hace falta instalar VC++ en el sistema)
$bootstrapperDir = Join-Path $ReloadedDestDir 'Loader\X64\Bootstrapper'
foreach ($vcDll in @('vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll')) {
    $vcSrc = Join-Path $bootstrapperDir $vcDll
    if (Test-Path $vcSrc) {
        Copy-Item $vcSrc (Join-Path $dir $vcDll) -Force
    }
}
$marker.AsiCreated = $true
$marker.TouchedGlobalConfig = [bool]$script:TouchedGlobalConfig
Write-Host '  Hecho.' -ForegroundColor Green

$marker | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $ReloadedDestDir 'install_marker.json')

Write-Host ''
Write-Host '=================================================================='
Write-Host '  Instalacion completada con exito.' -ForegroundColor Green
Write-Host '=================================================================='
Write-Host ''
Write-Host 'Ya puedes iniciar el juego directamente desde Steam. La traduccion'
Write-Host 'se cargara automaticamente al arrancar, sin pasos adicionales.'
Write-Host ''
Write-Host 'Para desinstalar, ejecuta "Desinstalar.bat".'
Write-Host ''
if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
