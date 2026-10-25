"""Control automático de la app: recorre el cliente y el panel en celular y computadora.
Playwright sirve los archivos desde dist/, sin servidor. Saca capturas y termina con error si algo no anda.

En local hace pedidos de verdad en el proyecto de PRUEBAS: en el celular con "Usar mi ubicación" y tocando el mapa,
en la computadora solo con referencias escritas. Después abre el link del pedido en un navegador limpio.
Contra la dirección publicada recorre lo mismo pero NO confirma: nunca crea pedidos en el proyecto real.

Uso:  npm run build && ../Test1_Inmo/.venv/bin/python scripts/verificar.py [carpeta-de-capturas]
Contra la dirección publicada:  URL=https://matitrova.github.io/envios/ ../Test1_Inmo/.venv/bin/python scripts/verificar.py
"""
import mimetypes
import os
import secrets
import string
import struct
import sys
import zlib
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import expect, sync_playwright

DIST = Path(__file__).resolve().parent.parent / "dist"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "capturas")
PUBLICADA = "URL" in os.environ
# https aunque sea local: sin contexto seguro no hay geolocalización ni portapapeles.
BASE = os.environ.get("URL", "https://envios.test/")
# Lo que la página tiene que decir en la consola (compartido/firebase.ts). Si no coincide, el control corta.
BASE_DE_DATOS = "envios-merlo" if PUBLICADA else "envios-merlo-pruebas"
MERLO = {"latitude": -32.342558, "longitude": -65.0136903}
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


def png_gris():
    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))
    filas = b"".join(b"\x00" + b"\xdd" * 256 for _ in range(256))
    return (b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", 256, 256, 8, 0, 0, 0, 0))
            + bloque(b"IDAT", zlib.compress(filas)) + bloque(b"IEND", b""))


# Los tiles reales no se piden: la política de OSM no quiere navegadores automáticos, y un bloqueo caería en la IP de casa.
TILE = png_gris()


def tiles(route):
    route.fulfill(status=200, body=TILE, content_type="image/png")


def textos_afuera(pg, nombre):
    # El ancho es el del dispositivo y no innerWidth: emulando un celular, si algo se sale el navegador
    # agranda innerWidth hasta que entre, y comparar contra eso daba siempre bien.
    salidos = pg.evaluate(
        """(ancho) => [...document.querySelectorAll('main h1, main h2, main h3, main p, main li, main a, main label, main button, main dd')]
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


def paso_de_mapa(pg, nombre, cap, n):
    # En el celular el dedo sobre el mapa mueve el mapa y no la página: "Siguiente" tiene que verse sin scroll.
    caja = pg.get_by_role("button", name="Siguiente").bounding_box()
    if caja["y"] + caja["height"] > pg.viewport_size["height"]:
        problemas.append(f"{nombre}: en el paso {n} el botón Siguiente queda fuera de la pantalla")
    # OSM pide la atribución visible y sin nada encima.
    atribucion = pg.evaluate("""() => {
        const a = document.querySelector('.leaflet-control-attribution a[href$="/copyright"]');
        if (!a) return 'falta';
        const r = a.getBoundingClientRect();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return e && (e === a || a.contains(e)) ? 'ok' : 'tapada';
    }""")
    if atribucion != "ok":
        problemas.append(f"{nombre}: en el paso {n} la atribución de OpenStreetMap está {atribucion}")
    cap(f"{n}-mapa")
    comunes(pg, f"{nombre} paso {n}")


def conectada_a(consola):
    return next((m.split("conectado a ")[1] for m in consola if m.startswith("Firebase: conectado a ")), None)


def confirmar(pg, nombre, consola, cap):
    base = conectada_a(consola)
    if base != "envios-merlo-pruebas":
        sys.exit(f"{nombre}: la página está conectada a {base!r} y no a envios-merlo-pruebas. Corto sin crear el pedido.")
    # Se toca y se mira el botón en el mismo cuadro: con mala señal, un segundo toque no tiene que mandar otro pedido.
    deshabilitado = pg.evaluate("""async () => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirmar pedido'));
        b.click();
        await new Promise(r => requestAnimationFrame(() => r()));
        return b.disabled;
    }""")
    if not deshabilitado:
        problemas.append(f"{nombre}: Confirmar no se deshabilita mientras se manda el pedido")
    expect(pg.locator("h1[data-estado=recibido]")).to_be_visible(timeout=20000)
    link = pg.locator("[data-link]").inner_text().strip()
    if not link.startswith(BASE + "?pedido=") or pg.url != link:
        problemas.append(f"{nombre}: el link del pedido no es el esperado: {link} (dirección: {pg.url})")
    cap("6-seguimiento")
    comunes(pg, f"{nombre} seguimiento")
    return link


def pedido_con_mapa(pg, nombre, consola, cap):
    pg.goto(BASE, wait_until="load")
    cap("1-inicio")
    comunes(pg, f"{nombre} inicio")
    pg.get_by_role("button", name="Paquete").click()
    pg.get_by_role("button", name="Usar mi ubicación").click()
    expect(pg.get_by_text("Podés arrastrar el punto")).to_be_visible()
    paso_de_mapa(pg, nombre, cap, 2)
    pg.get_by_role("button", name="Siguiente").click()
    mapa = pg.locator("[data-mapa]")
    caja = mapa.bounding_box()
    mapa.click(position={"x": caja["width"] * 0.7, "y": caja["height"] * 0.35})
    expect(pg.get_by_text("Podés arrastrar el punto")).to_be_visible()
    paso_de_mapa(pg, nombre, cap, 3)
    pg.get_by_role("button", name="Siguiente").click()
    pg.get_by_label("Tu nombre").fill("Control automático")
    pg.get_by_label("Tu celular").fill("2656 15 123456")
    cap("4-datos")
    comunes(pg, f"{nombre} datos")
    pg.get_by_role("button", name="Siguiente").click()
    expect(pg.get_by_text("Revisá tu pedido")).to_be_visible()
    cap("5-revisar")
    comunes(pg, f"{nombre} revisar")
    return None if PUBLICADA else confirmar(pg, nombre, consola, cap)


def pedido_con_referencias(pg, nombre, consola, cap):
    pg.goto(BASE, wait_until="load")
    pg.get_by_role("button", name="Compras").click()
    pg.get_by_label("Dirección o referencia").fill("Supermercado frente a la plaza")
    paso_de_mapa(pg, nombre, cap, 2)
    pg.get_by_role("button", name="Siguiente").click()
    pg.get_by_label("Dirección o referencia").fill("Casa con portón verde, calle de prueba")
    paso_de_mapa(pg, nombre, cap, 3)
    pg.get_by_role("button", name="Siguiente").click()
    pg.get_by_role("button", name="Siguiente").click()
    expect(pg.get_by_text("Escribí tu nombre.")).to_be_visible()  # sin datos no deja seguir
    pg.get_by_label("Tu nombre").fill("Control automático")
    pg.get_by_label("Tu celular").fill("+54 9 2656 123456")
    pg.get_by_label("Nota (opcional)").fill("Pan y leche. Prueba del control automático.")
    cap("4-datos")
    pg.get_by_role("button", name="Siguiente").click()
    expect(pg.get_by_text("A confirmar por WhatsApp")).to_be_visible()
    cap("5-revisar")
    comunes(pg, f"{nombre} revisar")
    return None if PUBLICADA else confirmar(pg, nombre, consola, cap)


def no_encontrado(pg, nombre, cap):
    al_azar = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    for id_ in ("roto", al_azar):
        pg.goto(f"{BASE}?pedido={id_}", wait_until="load")
        expect(pg.get_by_text("No encontramos ese pedido")).to_be_visible(timeout=20000)
    cap("7-no-encontrado")
    comunes(pg, f"{nombre} no encontrado")


def panel(pg, nombre, consola, cap):
    pg.goto(BASE + "panel/", wait_until="load")
    cap("1-inicio")
    if not pg.locator("h1").count():
        problemas.append(f"{nombre}: el panel no tiene título")
    comunes(pg, nombre)


DISPOSITIVOS = {
    "movil": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                  permissions=["geolocation"], geolocation=MERLO),
    "pc": dict(viewport={"width": 1440, "height": 900}),
}
RECORRIDOS = {"movil": pedido_con_mapa, "pc": pedido_con_referencias}


def contexto(nav, opciones):
    ctx = nav.new_context(**opciones, locale="es-AR", timezone_id="America/Argentina/San_Luis")
    if not PUBLICADA:
        ctx.route("https://envios.test/**", servir)
    ctx.route("https://tile.openstreetmap.org/**", tiles)
    return ctx


def recorrer(ctx, nombre, funcion):
    pg = ctx.new_page()
    errores: list[str] = []
    consola: list[str] = []
    pg.on("console", lambda m: (consola.append(m.text), m.type == "error" and errores.append(m.text)))
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("response", lambda r: r.status >= 400 and r.url.startswith(BASE) and errores.append(f"{r.status} {r.url}"))
    resultado = funcion(pg, nombre, consola, lambda n: pg.screenshot(path=str(OUT / f"{nombre}-{n}.png")))
    base = conectada_a(consola)
    if "panel" not in nombre and base != BASE_DE_DATOS:
        problemas.append(f"{nombre}: la página está conectada a {base!r} y tendría que estar en {BASE_DE_DATOS}")
    problemas.extend(f"{nombre}: {e}" for e in errores)
    pg.close()
    print(f"{nombre} recorrida")
    return resultado


if not PUBLICADA and not (DIST / "index.html").is_file():
    sys.exit("Falta dist/: corré antes npm run build")
if PUBLICADA:
    # Solo lectura: con las reglas subidas, un pedido que no existe da 404; si da 403, al real le faltan las reglas.
    import urllib.error, urllib.request
    try:
        urllib.request.urlopen("https://firestore.googleapis.com/v1/projects/envios-merlo/databases/(default)/documents/pedidos/"
                               + "".join(secrets.choice(string.ascii_letters) for _ in range(20)), timeout=30)
        problemas.append("el real devolvió un pedido inventado")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            sys.exit(f"envios-merlo responde {e.code} a un pedido que no existe: faltan las reglas (npm run reglas:real).")
OUT.mkdir(parents=True, exist_ok=True)
print(f"Dirección: {BASE} · base esperada: {BASE_DE_DATOS} · {'solo lectura' if PUBLICADA else 'crea pedidos de prueba'}")
with sync_playwright() as p:
    nav = p.chromium.launch()
    for disp, opciones in DISPOSITIVOS.items():
        ctx = contexto(nav, opciones)
        link = recorrer(ctx, f"cliente-{disp}", RECORRIDOS[disp])
        recorrer(ctx, f"cliente-{disp}", lambda pg, n, c, cap: no_encontrado(pg, n, cap))
        recorrer(ctx, f"panel-{disp}", panel)
        ctx.close()
        if link:
            # El link en un navegador limpio (sin el pedido guardado ni la escritura local de Firestore):
            # prueba que ?pedido= anda y que el pedido quedó en el servidor.
            limpio = contexto(nav, opciones)
            recorrer(limpio, f"link-{disp}", lambda pg, n, c, cap: (
                pg.goto(link, wait_until="load"),
                expect(pg.locator("h1[data-estado=recibido]")).to_be_visible(timeout=20000),
                cap("abierto")))
            limpio.close()
    nav.close()

if problemas:
    print("PROBLEMAS:")
    for x in problemas:
        print("  " + x)
    sys.exit(1)
print("TODO OK")
