# Pipeline de traducción — Danganronpa V3 (español de España)

Documento de referencia del flujo completo. Actualizado tras el arreglo del
truncamiento y del reajuste de líneas.

## Estado

### Ya desplegado en el mod
- **`game_resident_US.spc`** — 50 archivos, **con tildes/Ñ/¿¡** y **saltos de
  línea reajustados**. Fuente original (212.992 bytes) → sin crash en juicios.
  Verificado: 56/56 subarchivos, 50/50 IDs intactos, 50/50 textos en su slot.

### Pendiente
- **Capítulos de historia** (12 archivos de `wrd_script/007/`): traducidos pero
  **sin tildes** (pasaron por `limpiar_acentos.mjs`). Re-traducción en curso.
- **QA de calidad** con Claude (género gramatical, naturalidad).
- **Minijuegos** (BrainDrive, Anagram, Imagination): en inglés por crashes.

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

### Prohibido
- `limpiar_acentos.mjs` y `limpiar_mod.mjs`: **eliminan las tildes y la Ñ**.
- Font patching: **la fuente original ya tiene todos los caracteres españoles**.

## Trampas conocidas (todas verificadas empíricamente)

1. **Truncamiento por límite de tokens.** El traductor antiguo mandaba el archivo
   entero en una llamada. Medido: ~70 tokens de salida por entrada, ~116 entradas
   caben en 8.192 tokens. Con 581 entradas, el modelo se cortaba sobre la 108.
   Solución: `traductor_stx_v2.mjs` trocea a 50 entradas y verifica cada trozo.

2. **Los `.stx` deduplican cadenas.** Varias entradas comparten el mismo offset
   (2.727 casos en `game_resident`). Al reconstruir se escribe una copia por
   entrada: el archivo crece pero sigue siendo correcto. No es corrupción.

3. **El orden de los slots NO es alfabético.** En `game_resident_US.spc` los
   `Anagram`/`BrainDrive`/`Imagination` van al final. **Emparejar por posición
   mete cada texto en el archivo equivocado.** Siempre por contenido.

4. **La tabla de `game_resident_US.spc` no lleva nombres.** `spc_repack_generic_v3.mjs`
   empareja por nombre y por eso no sirve para este archivo: usa
   `empaquetar_resident.mjs`.

5. **El juego corta línea con `\n`.** No hace falta `\r\n`: en chap0 el original
   usa `\n` suelto 1.038 veces y `\r\n` solo 3. Perder el `\r` es cosmético.

6. **El español ocupa un 15-30% más que el inglés.** Medido en 7.075 entradas:
   3.792 desbordaban su caja. Tras el reajuste: 358 (el 90,6% arreglado). Las 358
   restantes son palabras sueltas ("Presentador" en un hueco de 10) que no caben
   de ninguna forma.

7. **Los `—` no hay que quitarlos.** En `F-HelpOperateDesc` los guiones largos ya
   venían del inglés original como separadores de sección. El verificador solo
   marca los que **introduce el modelo**.

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

## Ubicaciones

- Scripts: `C:\Users\david\traductor_v3\`
- CPK original: `C:\Users\david\Desktop\hgy\CriPakTools_x64\partition_data_win_us.cpk_unpacked\`
- CPK residente: `...\partition_resident_win.cpk_unpacked\game_resident\`
- Mod: `C:\Users\david\Desktop\Reloaded2\Release\Mods\CriFs.V2.Hook\CRIFsV2Hook\CPK\`
- Backups del mod: `C:\Users\david\Desktop\BACKUP_DanganronpaV3_Esp\`
- Backups de scripts: `C:\Users\david\traductor_v3\_backup_scripts_*\`

## Recordatorios

- Lanzar el juego **desde Reloaded II**, no desde Steam.
- Mantener el **ASI Loader desactivado**.
- **Backup antes de cada cambio** importante.
- Probar en el juego tras cada modificación.
