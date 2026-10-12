#!/usr/bin/env python3
"""Build accessible public-facing image assets and visual PDFs from original 124 AVIF pages."""
from pathlib import Path
import tempfile
import img2pdf
import pillow_avif  # registers AVIF codec with Pillow
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
BOOK = ROOT / "mateo"
PAGES = [BOOK / "pages" / f"{n:03}.avif" for n in range(1, 125)]
assert len(PAGES) == 124 and all(p.is_file() for p in PAGES), "Expected 124 source pages"

def font(size: int, bold=False):
    options = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
               "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"]
    for p in options:
        if Path(p).is_file():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

with Image.open(PAGES[0]) as im:
    im.convert("RGB").save(BOOK / "portada.jpg", "JPEG", quality=91, optimize=True, progressive=True)

out = Image.new("RGB", (1200, 630), "#101827")
d = ImageDraw.Draw(out)
for y in range(630):
    p = y / 630
    d.line((0,y,1200,y), fill=(int(15+18*p),int(23+12*p),int(39+11*p)))
d.rounded_rectangle((46,48,770,579), 26, fill="#1c2839", outline="#3e4d63", width=2)
d.text((84,88), "THE INTELLIGENCE AHEAD  /  LIBRO GRATIS", font=font(20,True), fill="#f9d66b")
d.text((80,174), "MATEO Y EL", font=font(75,True), fill="#fff8ea")
d.text((80,269), "ALGORITMO", font=font(75,True), fill="#ff7858")
d.text((85,399), "Las reglas invisibles se pueden entender.", font=font(22), fill="#dee4ec")
d.text((85,438), "124 paginas ilustradas para pensar con criterio.", font=font(21), fill="#dee4ec")
d.rounded_rectangle((80,496,303,556), 28, fill="#f9d66b")
d.text((109,514), "LEER GRATIS  >", font=font(20,True), fill="#101827")
with Image.open(PAGES[0]) as cover:
    cover=cover.convert("RGB")
    cover.thumbnail((347,523), Image.Resampling.LANCZOS)
    pos=((1200+772-cover.width)//2, (630-cover.height)//2)
    d.rounded_rectangle((pos[0]-9,pos[1]-9,pos[0]+cover.width+9,pos[1]+cover.height+9), 12, fill="#f3e7d2")
    out.paste(cover,pos)
out.save(BOOK / "og-mateo.jpg", "JPEG", quality=91, optimize=True, progressive=True)
with tempfile.TemporaryDirectory() as td:
    files=[]
    for i,p in enumerate(PAGES,1):
        with Image.open(p) as im:
            rgb=im.convert("RGB")
            path=Path(td) / f"{i:03}.jpg"
            rgb.save(path, "JPEG", quality=83, subsampling=0, optimize=True)
            files.append(str(path))
    (BOOK / "mateo-y-el-algoritmo.pdf").write_bytes(img2pdf.convert(files, title="Mateo y el Algoritmo", author="Alejandro Baratas", subject="Libro visual sobre algoritmos y pensamiento critico"))
    (BOOK / "muestra.pdf").write_bytes(img2pdf.convert(files[:12], title="Mateo y el Algoritmo - muestra de 12 paginas", author="Alejandro Baratas"))
assert len(PdfReader(BOOK / "mateo-y-el-algoritmo.pdf").pages)==124
assert len(PdfReader(BOOK / "muestra.pdf").pages)==12
assert (BOOK / "og-mateo.jpg").stat().st_size > 10000
assert (BOOK / "mateo-y-el-algoritmo.pdf").stat().st_size < 90_000_000
print("OK: cover, 1200x630 social image, complete 124-page PDF and 12-page sample.")
