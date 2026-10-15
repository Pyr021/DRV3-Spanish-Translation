# Pipeline de traducción — Danganronpa V3 (español de España)

Documento de referencia del flujo completo. Actualizado tras el arreglo del
truncamiento y del reajuste de líneas.

## Estado

### Ya desplegado en el mod
- **`game_resident_US.spc`** — 50 archivos, **con tildes/Ñ/¿¡** y **saltos de
  línea reajustados**. Fuente original (212.992 bytes) → sin crash en juicios.
  Verificado: 56/56 subarchivos, 50/50 IDs intactos, 50/50 textos en su slot.

## Scripts actuales

| Script | Para qué |
|---|---|
| `traductor_stx_v2.mjs` | **Traductor blindado.** Trocea, verifica y aborta en vez de guardar a medias. |
| `verificar_integridad.mjs` | **Guardián.** Detecta entradas perdidas, etiquetas rotas, saltos perdidos. Exit 1 si bloquea. |
| `reajustar_saltos.mjs` | **Reajuste de líneas.** Reparte el texto al ancho del original sin tocar una palabra. |
| `empaquetar_resident.mjs` | Empaqueta `game_resident_US.spc` emparejando **por contenido**. |
| `empaquetar_spc.mjs` | Reempaqueta cualquier `.spc` de capítulo emparejando por contenido. |
| `mapear_resident.mjs` | Descubre a qué nombre corresponde cada slot `.stx` de `game_resident`. |
| `spc_extract.mjs` / `stx_extract.mjs` | Extracción `.spc` → `.stx` → `.txt`. |
| `stx_repack_v2.mjs` | `.txt` → `.stx` **preservando los IDs internos**. |
| `spc_cmp.mjs` | Compresor LZ del `.spc`. |
| `glosario.txt` / `personajes.txt` | Terminología y género de personajes. |

## Flujo para re-traducir un archivo

```cmd
rem 1. Extraer .spc -> .stx -> .txt
node spc_extract.mjs archivo.spc carpeta_stx
node stx_extract.mjs carpeta_stx carpeta_txt

rem 2. Traducir (troceado y verificado)
node traductor_stx_v2.mjs carpeta_txt carpeta_trad glosario.txt --max-entradas 50

rem 3. VERIFICAR antes de reempaquetar (gratis). Si falla, NO continuar.
node verificar_integridad.mjs carpeta_txt carpeta_trad

rem 4. Reajustar saltos de linea al ancho del original
node reajustar_saltos.mjs carpeta_txt carpeta_trad carpeta_reajustada

rem 5. .txt reajustado -> .stx preservando IDs
node stx_repack_v2.mjs carpeta_reajustada carpeta_stx carpeta_stx_trad

rem 6. .stx -> .spc emparejando por contenido
node empaquetar_spc.mjs archivo_original.spc carpeta_stx carpeta_stx_trad salida.spc

rem 7. Copiar al mod y probar en el juego
```

Para `game_resident_US.spc` el paso 6 es `empaquetar_resident.mjs`.

## Recordatorios

- Lanzar el juego **desde Reloaded II**, no desde Steam.
- Mantener el **ASI Loader desactivado**.
- **Backup antes de cada cambio** importante.
- Probar en el juego tras cada modificación.
