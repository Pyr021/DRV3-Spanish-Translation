# Herramientas de traducción

Scripts (Node.js) usados para producir la traducción al español: extracción y
reempaquetado de los formatos propios de Danganronpa V3 (`.spc`, `.stx`,
`.srd`), pipeline de traducción asistida con IA, verificación de integridad,
ajuste de saltos de línea, etc.

Se publican como **referencia y documentación técnica** del proceso, no como
una herramienta de uso general lista para instalar. Si quieres reutilizarlos,
ten en cuenta lo siguiente.

## Variable de entorno necesaria

Los scripts que llaman a la IA (traducción/retraducción/ortografía) usan la
API de DeepSeek y leen la clave desde una variable de entorno, **nunca
hardcodeada**:

```powershell
$env:DEEPSEEK_API_KEY = "sk-tu-clave-aqui"
```

```cmd
set DEEPSEEK_API_KEY=sk-tu-clave-aqui
```

## Rutas absolutas

Muchos scripts (sobre todo los de la raíz, más antiguos) tienen rutas
absolutas codificadas del estilo `C:\Users\david\Desktop\...`, porque son
herramientas de trabajo personal, no una librería de uso general. Si quieres
ejecutarlos, tendrás que ajustar esas rutas a tu propia máquina. El
`pipeline_v4/` es la versión más reciente y mejor estructurada del proceso.

## Estructura

- Scripts de la raíz: herramientas puntuales (extracción/reempaquetado de
  `.spc`/`.stx`/`.srd`, verificación, depuración de formatos).
- [`pipeline_v4/`](pipeline_v4/): pipeline de traducción más reciente
  (ortografía automática, verificación, prompts, tests).
- [`glosario.txt`](glosario.txt) / [`personajes.txt`](personajes.txt):
  glosario de términos y ficha de personajes usados para mantener
  consistencia en la traducción.
- [`README_PIPELINE.md`](README_PIPELINE.md): documentación del pipeline
  completo de traducción (extraer → traducir → fusionar → reempaquetar).
- [`textos_ingles/`](textos_ingles/) / [`textos_traducidos/`](textos_traducidos/):
  ejemplos mínimos de entrada/salida.
