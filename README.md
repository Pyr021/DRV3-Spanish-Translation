# Danganronpa V3: Killing Harmony — Traducción al español

Traducción de fans, no oficial, al español de **Danganronpa V3: Killing Harmony** (PC/Steam),
junto con un instalador que la aplica automáticamente sin tocar los archivos originales del juego.

> **Aviso legal**: "DANGANRONPA" es una marca registrada de Spike Chunsoft Co., Ltd., Too Kyo
> Games, LLC y/o NIS America Inc. Este proyecto no está afiliado ni respaldado por dichas
> empresas. Es un trabajo de fans sin ánimo de lucro; necesitas una copia legítima del juego
> en Steam para usarlo.

## 🧪 Estado del proyecto: v0.1-beta (fase de pruebas)

Esta es la **primera versión pública de prueba**. El texto principal del juego está traducido
y es jugable, pero todavía no se ha verificado al 100% en todas las partes del juego ni en todos
los modos. Según se vaya probando y puliendo, iré sacando nuevas versiones hasta llegar a una
definitiva. Si encuentras algo roto, a medio traducir o raro, abre un *issue* en este repositorio.

## Contenido de la traducción

- Todo el diálogo de los 6 capítulos, prólogo y epílogo.
- Los menús del juego: menú principal, selección de capítulo, "Pulsa cualquier botón", opciones, etc.
- La interfaz del capítulo 6 (los "Recuerdos").
- Los minijuegos de los juicios: no solo se tradujeron sus textos, también se **reprogramó su
  lógica interna** para que funcionen correctamente en español (por ejemplo, los que dependen de
  letras o palabras concretas en inglés).
- Los objetos, habilidades, regalos y nombres del mapa.
- La fuente del juego adaptada para los caracteres españoles.
- ¡¡IMPORTANTE!! Los géneros estan mal definidos, la IA no distingue si el texto va dirigido a una mujer o un hombre, con lo cual muchos de los textos estarán mal definidos. Esto se ira revisando y se irán buscando soluciones. 

### Lo que todavía no se ha verificado o falta

- **Modos alternativos a la historia principal** (minijuegos del campus, casino, etc. fuera de
  los capítulos): aún no se sabe con certeza si están traducidos o en qué medida.
- No está garantizado que el mod funcione al 100% en absolutamente todas las partes del juego;
  esta es precisamente la fase de pruebas para detectar esos casos.
- Quedan algunas **imágenes o archivos Flash sin traducir** todavía por identificar e implementar.

## Instalación

1. Ve a la carpeta [`Instalador/`](Instalador/).
2. Haz doble clic en `Instalar.bat`.
3. Si no encuentra el juego automáticamente, indica la carpeta donde está instalado
   (la que contiene `Dangan3Win.exe`).
4. Abre el juego directamente desde Steam: la traducción se carga sola.

Para desinstalar (volver al inglés), haz doble clic en `Desinstalar.bat` dentro de la misma carpeta.

Instrucciones detalladas en [`Instalador/LEEME.txt`](Instalador/LEEME.txt).

## Cómo funciona el instalador

El instalador **no modifica ningún archivo `.cpk` del juego**. En su lugar, instala una copia
portátil y automática de [Reloaded-II](https://github.com/Reloaded-Project/Reloaded-II) con el
mod [CriFs.V2.Hook](https://github.com/Sewer56/CriFs.V2.Hook.ReloadedII) ya configurado con la
traducción integrada. Al arrancar el juego desde Steam, Reloaded se inyecta automáticamente
(vía [Ultimate ASI Loader](https://github.com/ThirteenAG/Ultimate-ASI-Loader)) y los archivos
traducidos sustituyen a los originales **en memoria**, sin tocar nada en disco dentro de los `.cpk`.

Es completamente reversible: el desinstalador restaura cualquier archivo que hubiera antes
(por ejemplo, si ya tenías otro `dinput8.dll` instalado por otro motivo) usando un marcador
explícito de qué se instaló, en vez de adivinar.

### ¿Por qué no se sustituyen los archivos directamente (sin Reloaded)?

Se investigó a fondo la posibilidad de un instalador que sustituyera archivos del juego
directamente (reempaquetando los `.cpk`, o usando archivos sueltos en `data\win\` como hace el
método documentado por el equipo de traducción italiano,
[V3UPSManager](https://github.com/IndacoSub/V3UPSManager)). Ninguna de las variantes probadas
funcionó en nuestras pruebas:

| Método probado | Resultado |
|---|---|
| Reempaquetar el `.cpk` con CriPakTools | Crash determinista al iniciar (`0xc0000005`, offset `0x57858e`) |
| Carpetas sueltas en `data\win\` (sin los `.cpk`) | El juego llega a los avisos legales en inglés y se queda colgado cargando indefinidamente |
| Carpeta con el mismo nombre que el `.cpk` (p. ej. `data\win\partition_data_win_us.cpk\...`) | Crash inmediato, en el **mismo offset exacto** que el `.cpk` reempaquetado |

Analizando el código fuente de CriFs.V2.Hook se confirmó que el mecanismo de "archivos sueltos
con prioridad sobre el CPK" es una **inyección activa** sobre la API nativa de CRI File System
(`criFsBinder_BindDirectory`), no un comportamiento nativo del motor del juego. Por eso el
instalador usa ese mismo mecanismo (ya probado y jugado sin problemas durante días) en vez de
intentar reinventarlo sin un hook.

## Herramientas de traducción

En [`Herramientas/`](Herramientas/) se publican, como referencia y documentación técnica, los
scripts usados para producir la traducción: extracción/reempaquetado de los formatos propios del
juego (`.spc`, `.stx`, `.srd`), el pipeline de traducción asistida con IA, verificación de
integridad y el glosario de términos. No son una herramienta de uso general lista para instalar;
más detalles en [`Herramientas/README.md`](Herramientas/README.md).

## Créditos y licencias de terceros

Este instalador incluye binarios de terceros, redistribuidos bajo sus licencias originales:

- **[Reloaded-II](https://github.com/Reloaded-Project/Reloaded-II)** (GPL v3) — gestor de mods.
  Código fuente: <https://github.com/Reloaded-Project/Reloaded-II>.
  Texto de la licencia y de sus dependencias en
  [`Instalador/ReloadedPortable/THIRD_PARTY_LICENSES_Reloaded-II.txt`](Instalador/ReloadedPortable/THIRD_PARTY_LICENSES_Reloaded-II.txt).
- **[CriFs.V2.Hook](https://github.com/Sewer56/CriFs.V2.Hook.ReloadedII)** por Sewer56 — mod que
  permite sustituir archivos CPK sin reempaquetarlos.
- **[Ultimate ASI Loader](https://github.com/ThirteenAG/Ultimate-ASI-Loader)** por ThirteenAG
  (MIT) — cargador de mods vía `dinput8.dll`.

Gracias también al equipo [IndacoSub / DAIX](https://indacosub.github.io/) (traducción italiana)
por documentar públicamente su proceso de modding, que sirvió de referencia en la investigación.

## Historial de versiones

- **v0.1-beta** (actual) — Primera versión pública de pruebas. Diálogo de los 6 capítulos, prólogo
  y epílogo, menús, interfaz del capítulo 6 y minijuegos de los juicios (con su lógica reprogramada)
  traducidos. Géneros gramaticales aún sin revisar del todo (traducción con IA). Pendiente de
  verificar los modos alternativos a la historia y de completar algunas imágenes/Flash.
