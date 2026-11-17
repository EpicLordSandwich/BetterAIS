"""OG AIS – extrakcia farieb z referenčného screenshotu.

Použitie:
    python docs/sample-og-colors.py

Skript predpokladá `docs/og-uis-reference.png` (1170×2532). Súradnice sú
normalizované na zobrazenú šírku 881 px, takže fungujú aj po zmene rozlíšenia.
"""
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
IMAGE = ROOT / "og-uis-reference.png"

im = Image.open(IMAGE).convert("RGB")
W, H = im.size
sx, sy = W / 881.0, H / 2001.0


def pixel(x: float, y: float):
    return im.getpixel((int(x * sx), int(y * sy)))


def dominant(x0: float, y0: float, x1: float, y1: float, n: int = 8):
    region = im.crop((int(x0 * sx), int(y0 * sy), int(x1 * sx), int(y1 * sy)))
    return Counter(region.getdata()).most_common(n)


POINTS = {
    "header": (500, 250),
    "menu_band": (500, 345),
    "breadcrumb_bg": (500, 390),
    "page_bg": (700, 800),
    "warn_bg": (500, 470),
    "info_bg": (400, 590),
    "red_icon": (55, 470),
    "blue_icon": (55, 590),
    "footer_bg": (500, 1950),
}

if __name__ == "__main__":
    for name, (x, y) in POINTS.items():
        rgb = pixel(x, y)
        print(f"{name:14s} {rgb}  #{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}")
    print("\nDominantné farby warning boxu:")
    for color, count in dominant(30, 430, 870, 520):
        print(f"  {color}  {count}")
    print("\nDominantné farby info boxu:")
    for color, count in dominant(30, 565, 870, 635):
        print(f"  {color}  {count}")
