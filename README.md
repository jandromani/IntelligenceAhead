# The Intelligence Ahead

**The Intelligence Ahead** is an independent editorial publication by Alejandro BGN about AI, robotics, embodied intelligence, society, memory and the systems that come next.

## Production
https://intelligence-ahead.vercel.app/

## Published issues
- **Nº005 · The Memory Ahead — El fin de olvidar**
- **Nº004 · The Human Ahead — Lo que no se automatiza**
- **Nº003 · The Embodied Data Ahead**
- **Nº002 · 0 → 1.000.000.000 — La economía del billón de robots**
- **Nº001 · 2027: cuando la IA deja de ser un chatbot**

## Editorial distribution system
- 5 published issues / 50 editorial pages
- immersive reader for every issue
- 10 clean page-level URLs per issue
- 5 dedicated 1200×630 issue social cards
- 50 dedicated 1200×630 page social cards
- Open Graph + Twitter large cards + canonical metadata
- JSON-LD article metadata
- sitemap indexing all editorial routes
- RSS feed for issue-level publishing

Commits to `master` deploy automatically to Vercel.

## Libro visual · Mateo y el Algoritmo

- [Landing pública](https://intelligence-ahead.vercel.app/mateo): portada, gancho editorial, muestra e información.
- [Lector interactivo](https://intelligence-ahead.vercel.app/mateo/leer): 124 páginas originales en AVIF y permalink `?p=84`.
- [Press kit](https://intelligence-ahead.vercel.app/mateo/prensa): materiales, propuestas y contacto.
- [Libro completo PDF](https://intelligence-ahead.vercel.app/mateo/mateo-y-el-algoritmo.pdf): generado desde las páginas originales.
- [Imagen social 1200x630](https://intelligence-ahead.vercel.app/mateo/og-mateo.jpg): generada desde la portada real.

Los JPEG y PDF se generan en CI por `scripts/build-mateo-assets.py`. La generación está habilitada inicialmente para `feat/mateo-public-launch-20261013`. Los 124 AVIF son fuente primaria; no insertar imágenes de la revista por error ni inventar avales institucionales.
