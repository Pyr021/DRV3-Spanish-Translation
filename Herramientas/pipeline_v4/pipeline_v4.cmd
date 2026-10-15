@echo off
rem ======================================================================
rem  pipeline_v4.cmd - traduccion completa de una carpeta de .txt (un capitulo)
rem
rem  Uso:  pipeline_v4.cmd <carpeta_txt_ingles> <carpeta_trabajo> [--revisar-ia]
rem  Ej.:  pipeline_v4.cmd C:\Users\david\Desktop\chap3_work\txt C:\Users\david\Desktop\chap3_work
rem
rem  Requiere:  set DEEPSEEK_API_KEY=sk-...
rem  Resultado: <carpeta_trabajo>\trad_final  (listo para stx_repack_v2.mjs)
rem ======================================================================
setlocal
set "AQUI=%~dp0"
set "EN=%~1"
set "W=%~2"
if "%EN%"=="" goto :uso
if "%W%"=="" goto :uso
if "%DEEPSEEK_API_KEY%"=="" (echo Falta DEEPSEEK_API_KEY & exit /b 2)
rem glosario.txt, personajes.txt y verificar_integridad.mjs: en esta carpeta o en la de arriba
set "BASE=%AQUI%"
if not exist "%BASE%glosario.txt" set "BASE=%AQUI%..\"
set "GLOSARIO=%BASE%glosario.txt"
if not exist "%GLOSARIO%" (echo No encuentro glosario.txt & exit /b 1)

echo [0/6] Comprobando que no hay scripts prohibidos...
node "%AQUI%comprobar_prohibidos.mjs" "%BASE%" || exit /b 1

echo [1/6] Traduciendo (prompt reforzado + verificacion por trozo)...
node "%AQUI%traductor_v4.mjs" "%EN%" "%W%\trad" "%GLOSARIO%" || exit /b 1

echo [2/6] Integridad de bloques y etiquetas...
if exist "%BASE%verificar_integridad.mjs" (node "%BASE%verificar_integridad.mjs" "%EN%" "%W%\trad" || exit /b 1)

echo [3/6] Retraduciendo archivos que hayan salido sin tildes (si los hay)...
node "%AQUI%retraducir_sin_tildes.mjs" "%EN%" "%W%\trad" "%W%\trad_retrad" "%GLOSARIO%" || exit /b 1
set "SIG=%W%\trad_retrad"

set "REV=%SIG%"
if /i "%~3"=="--revisar-ia" (
  echo [4/6] Revision con IA de los bloques con avisos...
  node "%AQUI%revisar_ia.mjs" "%EN%" "%SIG%" "%W%\trad_revisada" "%GLOSARIO%" || exit /b 1
  set "REV=%W%\trad_revisada"
) else (
  echo [4/6] Revision con IA: omitida ^(anade --revisar-ia para activarla^)
)

echo [5/6] Autocorreccion de errores seguros (tildes obligatorias, signos de apertura)...
node "%AQUI%verificar_ortografia.mjs" "%REV%" --original "%EN%" --corregir "%W%\trad_corregida" || exit /b 1

echo [6/6] Reajuste de lineas a la caja (3 lineas, ancho real)...
node "%AQUI%reajustar_saltos.mjs" "%EN%" "%W%\trad_corregida" "%W%\trad_final" || exit /b 1

echo.
echo Informe final de ortografia (solo para revisar a mano lo que quede):
node "%AQUI%verificar_ortografia.mjs" "%W%\trad_final" --original "%EN%" --no-bloquear
echo.
echo LISTO: %W%\trad_final
exit /b 0

:uso
echo Uso: pipeline_v4.cmd ^<carpeta_txt_ingles^> ^<carpeta_trabajo^> [--revisar-ia]
exit /b 1
