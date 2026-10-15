# Desinstalador del metodo Reloaded II portatil.
# Elimina la copia portatil de Reloaded II del juego, restaura dinput8.dll
# si habia uno original, quita el cargador .asi, y limpia la configuracion
# de usuario SOLO si fue creada por este instalador.

param(
    [string]$GameDir = "",
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

function Test-GameRoot([string]$dir) {
    if (-not $dir) { return $false }
    return (Test-Path (Join-Path $dir 'Dangan3Win.exe'))
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
Write-Host '  Danganronpa V3  -  Desinstalar la traduccion (metodo Reloaded II)'
Write-Host '=================================================================='
Write-Host ''

$dir = $GameDir
if (-not (Test-GameRoot $dir)) { $dir = Find-GameRoot }
if (-not (Test-GameRoot $dir)) {
    $dir = (Read-Host 'Indica la carpeta de instalacion del juego').Trim().Trim('"')
}

if (-not (Test-GameRoot $dir)) {
    Write-Host 'No encuentro el juego en esa carpeta.' -ForegroundColor Red
    if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
    exit 1
}

$ReloadedDestDir = Join-Path $dir '_Reloaded'

# ---------- 0. Leer el marcador de instalacion (que acciones se hicieron) ----------
$markerFile = Join-Path $ReloadedDestDir 'install_marker.json'
$marker = $null
if (Test-Path $markerFile) {
    try { $marker = Get-Content $markerFile -Raw | ConvertFrom-Json } catch { $marker = $null }
}
if (-not $marker) {
    Write-Host 'No encuentro el marcador de instalacion ("_Reloaded\install_marker.json").' -ForegroundColor Yellow
    Write-Host 'Puede que la traduccion no se instalara con este instalador, o que la' -ForegroundColor Yellow
    Write-Host 'carpeta "_Reloaded" ya se haya movido/borrado. Para evitar borrar algo' -ForegroundColor Yellow
    Write-Host 'que no instalamos nosotros, no se tocara dinput8.dll ni el cargador .asi.' -ForegroundColor Yellow
}

# ---------- 1. Restaurar dinput8.dll y el cargador .asi (solo lo que instalamos) ----------
Write-Host 'Restaurando archivos del juego...' -ForegroundColor Cyan
$targetDinput = Join-Path $dir 'dinput8.dll'
$targetAsi = Join-Path $dir 'Reloaded.Mod.Loader.Bootstrapper.asi'
$backupDinput = "$targetDinput.bak_es"

if ($marker) {
    if ($marker.DinputHadBackup -and (Test-Path $backupDinput)) {
        if (Test-Path $targetDinput) { Remove-Item $targetDinput -Force }
        Rename-Item $backupDinput $targetDinput
        Write-Host '  -> dinput8.dll original restaurado.' -ForegroundColor Green
    } elseif ($marker.InstalledDinputFromScratch -and (Test-Path $targetDinput)) {
        Remove-Item $targetDinput -Force
        Write-Host '  -> dinput8.dll (cargador de mods) eliminado.' -ForegroundColor Green
    } else {
        Write-Host '  -> dinput8.dll no se toca (ya existia antes de instalar la traduccion).' -ForegroundColor Yellow
    }

    if ($marker.AsiCreated -and (Test-Path $targetAsi)) {
        Remove-Item $targetAsi -Force
        Write-Host '  -> Cargador de mods (.asi) eliminado.' -ForegroundColor Green
        # Limpiar las DLLs de VC++ Runtime que copiamos junto al .asi
        foreach ($vcDll in @('vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll')) {
            $vcPath = Join-Path $dir $vcDll
            if (Test-Path $vcPath) {
                Remove-Item $vcPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# ---------- 2. Eliminar la copia portatil de Reloaded II ----------
if (Test-Path $ReloadedDestDir) {
    Remove-Item $ReloadedDestDir -Recurse -Force
    Write-Host '  -> Carpeta "_Reloaded" eliminada.' -ForegroundColor Green
}

# Nota: si el instalador detecto que ya tenias Reloaded II instalado y copio
# el mod de traduccion ahi (en vez de crear una copia portatil aparte), ese
# mod se queda instalado en tu gestor de Reloaded II. Esto es intencionado:
# no tocamos tu instalacion de Reloaded II para no afectar a otros mods o
# juegos que puedas tener configurados ahi. Basta con que el cargador (.asi)
# ya este desactivado (paso anterior) para que el juego vuelva a ingles.
# Si quieres quitar tambien el mod de tu gestor de Reloaded II, puedes
# borrarlo manualmente desde la carpeta "Mods\CriFs.V2.Hook" de tu
# instalacion, o desactivarlo desde la interfaz de Reloaded II.
if ($marker -and $marker.UsedExistingReloaded) {
    Write-Host '  Nota: la traduccion se instalo en tu Reloaded II existente.' -ForegroundColor Yellow
    Write-Host '  No se ha tocado esa instalacion (para no afectar a otros mods/juegos).' -ForegroundColor Yellow
    Write-Host '  El cargador del juego ya esta desactivado, asi que basta con esto.' -ForegroundColor Yellow
}

# ---------- 3. Limpiar config de usuario SOLO si apuntaba a nuestra copia ----------
$configFile = Join-Path $env:APPDATA 'Reloaded-Mod-Loader-II\ReloadedII.json'
if (Test-Path $configFile) {
    try {
        $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
        if ($cfg.ApplicationConfigDirectory -and $cfg.ApplicationConfigDirectory.StartsWith($ReloadedDestDir)) {
            $bak = "$configFile.bak_es"
            if (Test-Path $bak) {
                Copy-Item $bak $configFile -Force
                Remove-Item $bak -Force
                Write-Host '  -> Configuracion de Reloaded II restaurada a la anterior.' -ForegroundColor Green
            } else {
                Remove-Item $configFile -Force
                Write-Host '  -> Configuracion de Reloaded II (creada por este instalador) eliminada.' -ForegroundColor Green
            }
        }
    } catch {}
}

Write-Host ''
Write-Host 'Desinstalacion completada. El juego vuelve a estar en ingles.' -ForegroundColor Green
Write-Host ''
if (-not $NoPause) { Read-Host 'Pulsa Enter para salir' }
