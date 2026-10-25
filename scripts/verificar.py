"""Control automático de la app: recorre el cliente y el panel en celular y computadora.
Playwright sirve los archivos desde dist/, sin servidor. Saca capturas y termina con error si algo no anda.

Uso:  npm run build && ../Test1_Inmo/.venv/bin/python scripts/verificar.py [carpeta-de-capturas]
"""
import mimetypes
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

DIST = Path(__file__).resolve().parent.parent / "dist"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "capturas")
BASE = "http://envios.test/"
problemas: list[str] = []


def servir(route):
    ruta = unquote(urlparse(route.request.url).path).lstrip("/")
    f = DIST / ruta
    if f.is_dir():
        f = f / "index.html"
    if f.is_file():
        route.fulfill(status=200, body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or "application/octet-stream")
    else:
        route.fulfill(status=404, body=b"no existe")


def textos_afuera(pg, nombre):
    # El ancho es el del dispositivo y no innerWidth: emulando un celular, si algo se sale el navegador
    # agranda innerWidth hasta que entre, y comparar contra eso daba siempre bien.
    salidos = pg.evaluate(
        """(ancho) => [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main label, main button')]
        .filter(e => e.getClientRects().length && getComputedStyle(e).opacity !== '0')
        .filter(e => { const r = e.getBoundingClientRect(); return r.right > ancho + 1 || r.left < -1 })
        .map(e => e.tagName + ': ' + e.textContent.trim().slice(0, 40))""",
        pg.viewport_size["width"],
    )
    problemas.extend(f"{nombre}: se sale de la pantalla -> {x}" for x in salidos)


def comunes(pg, nombre):
    robots = pg.locator("meta[name=robots]")
    if not robots.count() or "noindex" not in (robots.get_attribute("content") or ""):
        problemas.append(f"{nombre}: falta el noindex (hasta la salida no tiene que aparecer en Google)")
    ancho = [pg.evaluate("document.documentElement.scrollWidth"), pg.viewport_size["width"]]
    if ancho[0] > ancho[1]:
        problemas.append(f"{nombre}: scroll horizontal ({ancho[0]} > {ancho[1]})")
    textos_afuera(pg, nombre)


def cliente(pg, nombre, cap):
    pg.goto(BASE, wait_until="networkidle")
    cap("1-inicio")
    if not pg.locator("h1").count():
        problemas.append(f"{nombre}: la pantalla del cliente no tiene título")
    comunes(pg, nombre)


def panel(pg, nombre, cap):
    pg.goto(BASE + "panel/", wait_until="networkidle")
    cap("1-inicio")
    if not pg.locator("h1").count():
        problemas.append(f"{nombre}: el panel no tiene título")
    comunes(pg, nombre)


PANTALLAS = {"cliente": cliente, "panel": panel}
DISPOSITIVOS = {
    "movil": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
    "pc": dict(viewport={"width": 1440, "height": 900}),
}

if not (DIST / "index.html").is_file():
    sys.exit("Falta dist/: corré antes npm run build")
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    nav = p.chromium.launch()
    for disp, opciones in DISPOSITIVOS.items():
        ctx = nav.new_context(**opciones, locale="es-AR", timezone_id="America/Argentina/San_Luis")
        ctx.route("http://envios.test/**", servir)
        for pantalla, recorrer in PANTALLAS.items():
            nombre = f"{pantalla}-{disp}"
            pg = ctx.new_page()
            errores: list[str] = []
            pg.on("console", lambda m: m.type == "error" and errores.append(m.text))
            pg.on("pageerror", lambda e: errores.append(str(e)))
            pg.on("response", lambda r: r.status >= 400 and r.url.startswith(BASE) and errores.append(f"{r.status} {r.url}"))
            recorrer(pg, nombre, lambda n: pg.screenshot(path=str(OUT / f"{nombre}-{n}.png")))
            problemas.extend(f"{nombre}: {e}" for e in errores)
            print(f"{nombre} recorrida")
            pg.close()
        ctx.close()
    nav.close()

if problemas:
    print("PROBLEMAS:")
    for x in problemas:
        print("  " + x)
    sys.exit(1)
print("TODO OK")
