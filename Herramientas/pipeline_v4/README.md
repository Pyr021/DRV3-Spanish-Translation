# Pipeline de traducción v4 — DRV3 al español de España (sin faltas)

Copia esta carpeta entera dentro de `C:\Users\david\traductor_v3\` (queda como
`traductor_v3\pipeline_v4\`). Usa el `glosario.txt`, el `personajes.txt` y el
`verificar_integridad.mjs` de la carpeta de arriba.

Antes de usarlo (una sola vez):

```cmd
cd C:\Users\david\traductor_v3\pipeline_v4
node comprobar_prohibidos.mjs .. --bloquear
set DEEPSEEK_API_KEY=sk-...tu clave...
```

`--bloquear` renombra `limpiar_acentos.mjs` y `limpiar_mod.mjs` a `*.PROHIBIDO`. Esos
scripts borran tildes, ñ y ¿¡; fueron la causa de los 83 archivos sin tildes. El
pipeline se niega a arrancar si siguen activos.

**La clave ya no va escrita en el código.** La de `traductor_stx_v2.mjs` estaba
expuesta: revócala en DeepSeek y usa una nueva solo como variable de entorno.

## Uso rápido

```cmd
pipeline_v4.cmd C:\Users\david\Desktop\chap3_work\txt C:\Users\david\Desktop\chap3_work
pipeline_v4.cmd C:\Users\david\Desktop\chap3_work\txt C:\Users\david\Desktop\chap3_work --revisar-ia
```

El resultado queda en `chap3_work\trad_final`, ya corregido y reajustado a la caja.
Después se sigue como siempre: `stx_repack_v2.mjs`, `empaquetar_spc.mjs` y probar en
el juego.

## Qué hace cada paso

| Paso | Script | Coste API | Qué hace |
|---|---|---|---|
| 0 | `comprobar_prohibidos.mjs` | — | Para si `limpiar_acentos.mjs` o `limpiar_mod.mjs` siguen activos |
| 1 | `traductor_v4.mjs` | sí | Traduce con el prompt reforzado. Tras cada trozo pasa el verificador; si hay errores seguros, pide **una** corrección con la lista exacta. Rechaza salidas sin ninguna tilde. |
| 2 | `verificar_integridad.mjs` (el tuyo) | — | Bloques y etiquetas intactos |
| 3 | `retraducir_sin_tildes.mjs` | solo si hace falta | Detecta archivos sin tildes y los retraduce **desde el inglés** |
| 4 | `revisar_ia.mjs` (opcional) | poco | Segunda pasada de gramática, concordancia y género, **solo en los bloques con avisos** |
| 5 | `verificar_ortografia.mjs --corregir` | — | Corrige solo lo seguro: tildes obligatorias, ¿ y ¡, «he echo», «haber si»... |
| 6 | `reajustar_saltos.mjs` | — | Reparte el texto en ≤ 3 líneas medidas en píxeles reales de la fuente |
| — | `verificar_ortografia.mjs` | — | Informe final (`_informe_ortografia.txt`) con lo que queda por revisar a mano |

## Los 83 archivos sin tildes del capítulo 2

```cmd
rem 1) ver cuáles son (no gasta nada)
node retraducir_sin_tildes.mjs C:\Users\david\Desktop\chap2_work\txt C:\Users\david\Desktop\chap2_work\trad C:\Users\david\Desktop\chap2_work\trad_v4 ..\glosario.txt --solo-listar

rem 2) simular (no gasta nada): enseña los trozos que enviaría
node retraducir_sin_tildes.mjs C:\Users\david\Desktop\chap2_work\txt C:\Users\david\Desktop\chap2_work\trad C:\Users\david\Desktop\chap2_work\trad_v4 ..\glosario.txt --simular

rem 3) de verdad: copia la traducción actual a trad_v4 y retraduce encima solo esos archivos
node retraducir_sin_tildes.mjs C:\Users\david\Desktop\chap2_work\txt C:\Users\david\Desktop\chap2_work\trad C:\Users\david\Desktop\chap2_work\trad_v4 ..\glosario.txt

rem 4) corregir lo seguro y reajustar
node verificar_ortografia.mjs C:\Users\david\Desktop\chap2_work\trad_v4 --original C:\Users\david\Desktop\chap2_work\txt --corregir C:\Users\david\Desktop\chap2_work\trad_v4_corr
node reajustar_saltos.mjs C:\Users\david\Desktop\chap2_work\txt C:\Users\david\Desktop\chap2_work\trad_v4_corr C:\Users\david\Desktop\chap2_work\trad_reajustado
```

Con la traducción actual del capítulo 2 detecta **84 archivos**: los 83 sin ninguna
tilde más 1 mezclado.

## El verificador de ortografía

`node verificar_ortografia.mjs <dir_trad> [--original <dir_ingles>] [--corregir <dir_salida>] [--probables]`

Cada aviso tiene una gravedad:

- **SEGURO** (se corrige solo con `--corregir`):
  - palabras que nunca van sin tilde: *también, aquí, así, quizás, está(n), había,
    podría, día, razón...* y todas las terminadas en *-ción* / *-sión*;
  - interrogativos tras ¿ o ¡: *¿que* → *¿qué*;
  - *¿porque* → *¿por qué*;
  - confusiones: *haber si* → *a ver si*, *he echo* → *he hecho*, *hecho de menos* →
    *echo de menos*, *ay que* → *hay que*, *¡Hay!* → *¡Ay!*, *tubo que* → *tuvo que*,
    *iva* → *iba*, *osea*, *enserio*, *aveces*...;
  - **¿ y ¡ que faltan**, con el mismo algoritmo que `anadir_signos_apertura.mjs`.
- **PROBABLE** (se corrige solo si añades `--probables`):
  - *esta bien* → *está bien*;
  - *para el.* → *para él.*;
  - *tu eres* → *tú eres*;
  - *No se.* → *No sé.*;
  - *Si,* → *Sí,*;
  - *mas* → *más*;
  - *hay está* → *ahí está*;
  - dobles espacios y espacios antes de signos.
- **DUDOSO** (solo informe):
  - *aun* / *aún*;
  - frases partidas entre bloques;
  - bloques idénticos al inglés o con palabras inglesas.

En la traducción actual del capítulo 2 encuentra 1.965 errores seguros, 415 probables y
100 dudosos. Con `--corregir` arregla 1.455 bloques sin tocar ninguna etiqueta. Las
pruebas del detector están en `node test_ortografia.mjs` (14/14).

**Lo que el verificador NO puede ver:** errores de concordancia y de género que
dependen del sentido («Kaede está cansado»). Para eso está `revisar_ia.mjs`, que se los
da a corregir a DeepSeek con el original inglés y `personajes.txt` delante. Valida
cada corrección: mismas etiquetas, longitud entre el 60 % y el 150 % de la original.

## Coste aproximado (DeepSeek)

- Prompt de sistema: unos 2.800 tokens, que se cachean entre llamadas (más barato).
- Traducción: igual que la v2, más una llamada extra solo en los trozos con errores
  seguros.
- `revisar_ia.mjs` en el capítulo 2 actual: 1.694 bloques con avisos, unas 57
  llamadas de 30 bloques.

Usa `--simular` en `traductor_v4.mjs`, `retraducir_sin_tildes.mjs` y `revisar_ia.mjs`
para ver lo que haría sin gastar nada.

## Todos los capítulos de una vez: `pipeline_todos.cmd`

Procesa los `.SPC` de texto de `wrd_script\007` uno detrás de otro: chap0, chap1,
chap3–7, ainori, gallery, sub_routine y test.

```cmd
pipeline_todos.cmd --simular      rem primero: todo menos copiar al mod
pipeline_todos.cmd                rem de verdad
pipeline_todos.cmd --retraducir   rem además retraduce desde el inglés los archivos sin tildes (API)
pipeline_todos.cmd --desde chap4  rem reanudar tras un fallo
```

Por cada SPC hace estos pasos, deteniéndose al primer fallo sin tocar el mod:
1. Extrae el original inglés y el del mod.
2. Comprueba que tienen los mismos `.stx` y el mismo número de entradas.
3. Ejecuta `verificar_integridad`.
4. Con `--retraducir`, retraduce los archivos sin tildes.
5. Corrige la ortografía (seguros + probables) y reajusta a 3 líneas.
6. Vuelve a ejecutar `verificar_integridad`.
7. Ejecuta `stx_repack_v2` y comprueba cada `.stx` nuevo: entradas, IDs y textos.
8. Ejecuta `spc_repack_generic_v3` en el orden del original y lo extrae otra vez para
   compararlo byte a byte.
9. Hace una copia de seguridad del SPC del mod, copia el nuevo y comprueba con un hash
   que la copia es idéntica.

- Log: `C:\Users\david\Desktop\todos_work\_pipeline_todos_log.txt`
- Copias de seguridad: `C:\Users\david\Desktop\BACKUP_DanganronpaV3_Esp\pipeline_todos_<fecha>\`
- Para deshacer un capítulo, copia su `.SPC` de la carpeta de copias de seguridad al mod.

## Archivos

| Archivo | Para qué |
|---|---|
| `pipeline_todos.cmd` / `pipeline_todos.mjs` | Todos los SPC de texto de `wrd_script\007` con verificación, copias de seguridad y log |
| `pipeline_v4.cmd` | Todo el flujo de un capítulo |
| `traductor_v4.mjs` | Traductor con control de ortografía |
| `prompt_es.mjs` | Prompt reforzado (ortografía, diacríticas, ¿¡, concordancia, género). Edítalo aquí. |
| `ortografia.mjs` | Detector y corrector (módulo) |
| `verificar_ortografia.mjs` | Verificador e informe `_informe_ortografia.txt` |
| `retraducir_sin_tildes.mjs` | Retraduce los archivos que pasaron por `limpiar_acentos` |
| `revisar_ia.mjs` | Revisión opcional de gramática y concordancia con IA |
| `anadir_signos_apertura.mjs` | ¿ y ¡ (también lo usa el verificador) |
| `reajustar_saltos.mjs` | Reajuste a la caja (v3: 3 líneas, píxeles reales, corte tras guion, `--metricas`) |
| `comprobar_prohibidos.mjs` | Guardián contra `limpiar_acentos.mjs` y `limpiar_mod.mjs` |
| `comun.mjs` | Utilidades compartidas |
| `test_ortografia.mjs` | Pruebas del detector |
