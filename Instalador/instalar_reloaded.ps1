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
