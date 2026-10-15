@echo off
rem ======================================================================
rem  pipeline_todos.cmd - aplica el pipeline v4 a todos los .SPC de texto de
rem  wrd_script\007 (chap0, chap1, chap3-7, ainori, gallery, sub_routine, test),
rem  uno detras de otro, con verificacion, copia de seguridad y log.
rem
rem  Uso:
rem    pipeline_todos.cmd --simular            (RECOMENDADO primero: no toca el mod)
rem    pipeline_todos.cmd                      (de verdad: copia al mod)
rem    pipeline_todos.cmd --retraducir         (ademas retraduce los archivos sin tildes; usa la API)
rem    pipeline_todos.cmd --solo chap0,chap7   (solo esos)
rem    pipeline_todos.cmd --desde chap4        (reanudar despues de un fallo)
rem
rem  Log:     C:\Users\david\Desktop\todos_work\_pipeline_todos_log.txt
rem  Backups: C:\Users\david\Desktop\BACKUP_DanganronpaV3_Esp\pipeline_todos_<fecha>\
rem ======================================================================
setlocal
chcp 65001 >nul
where node >nul 2>nul || (echo No encuentro node en el PATH & exit /b 1)
node "%~dp0pipeline_todos.mjs" %*
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (echo === TERMINADO SIN ERRORES ===) else (echo === SE HA DETENIDO POR UN ERROR: mira el log ===)
exit /b %RC%
