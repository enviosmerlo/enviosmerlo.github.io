"""Control automático de la app: recorre el cliente y el panel en celular y computadora.
Playwright sirve los archivos desde dist/, sin servidor. Saca capturas y termina con error si algo no anda.

En local hace pedidos de verdad en el proyecto de PRUEBAS: en el celular con "Usar mi ubicación" y tocando el mapa,
en la computadora solo con referencias escritas y un corte de señal. El panel (otro navegador, con el operador de prueba
de cuentas_prueba.py) los ve llegar como nuevos, asigna, cambia estados y cancela, y el cliente lo ve en vivo.
Contra la dirección publicada recorre lo mismo pero NO confirma ni entra al panel: nunca escribe en el proyecto real.

Uso:  npm run build && ../Test1_Inmo/.venv/bin/python scripts/verificar.py [carpeta-de-capturas]
Contra la dirección publicada:  URL=https://matitrova.github.io/envios/ ../Test1_Inmo/.venv/bin/python scripts/verificar.py
"""
import base64
import json
import mimetypes
import os
import secrets
import string
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import TimeoutError as TiempoAgotado, expect, sync_playwright

DIST = Path(__file__).resolve().parent.parent / "dist"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "capturas")
PUBLICADA = "URL" in os.environ
# https aunque sea local: sin contexto seguro no hay geolocalización ni portapapeles.
BASE = os.environ.get("URL", "https://envios.test/")
# Lo que la página tiene que decir en la consola (compartido/firebase.ts). Si no coincide, el control corta.
BASE_DE_DATOS = "envios-merlo" if PUBLICADA else "envios-merlo-pruebas"
# El GPS falso queda a unos 3 km del centro donde arranca el mapa: así se prueba que el mapa va a buscar el punto.
GPS = {"latitude": -32.37, "longitude": -65.0136903}
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


# Los tiles reales no se piden: la política de OSM no quiere navegadores automáticos, y un bloqueo caería en la IP de casa.
# PNG gris de 1x1: Leaflet lo estira al tamaño del tile.
TILE = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4CwAA3wDeKXlwtgAAAABJRU5ErkJggg==")


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


def marcador_a_la_vista(pg, nombre, letra):
    dentro = pg.evaluate("""(letra) => {
        const m = [...document.querySelectorAll('.leaflet-marker-icon')].find(e => e.textContent.trim() === letra);
        if (!m) return false;
        const r = m.getBoundingClientRect(), c = document.querySelector('[data-mapa]').getBoundingClientRect();
        return r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    }""", letra)
    if not dentro:
        problemas.append(f"{nombre}: el punto {letra} no quedó a la vista dentro del mapa")


def conectada_a(consola):
    return next((m.split("conectado a ")[1] for m in consola if m.startswith("Firebase: conectado a ")), None)


def confirmar(pg, nombre, consola, cap, sin_senal=False):
    base = conectada_a(consola)
    if base != "envios-merlo-pruebas":
        sys.exit(f"{nombre}: la página está conectada a {base!r} y no a envios-merlo-pruebas. Corto sin crear el pedido.")
    if sin_senal:
        pg.context.set_offline(True)
    # Se toca y se mira el botón en el mismo cuadro: con mala señal, un segundo toque no tiene que mandar otro pedido.
    deshabilitado = pg.evaluate("""async () => {
        const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirmar pedido'));
        b.click();
        await new Promise(r => requestAnimationFrame(() => r()));
        return b.disabled;
    }""")
    if not deshabilitado:
        problemas.append(f"{nombre}: Confirmar no se deshabilita mientras se manda el pedido")
    if sin_senal:
        # Sin red el pedido queda en cola: hay que avisar que no cierre la página, y mandarlo solo al volver la señal.
        expect(pg.get_by_text("Sin señal: el pedido se manda solo")).to_be_visible(timeout=15000)
        cap("5-sin-senal")
        pg.context.set_offline(False)
    expect(pg.locator("h1[data-estado=recibido]")).to_be_visible(timeout=60000 if sin_senal else 20000)
    link = pg.locator("[data-link]").inner_text().strip()
    if not link.startswith(BASE + "?pedido=") or pg.url != link:
        problemas.append(f"{nombre}: el link del pedido no es el esperado: {link} (dirección: {pg.url})")
    # El aviso al servicio: el botón manda a su WhatsApp el link del pedido.
    href = pg.locator("[data-whatsapp]").get_attribute("href") or ""
    if not href.startswith(f"https://wa.me/{SERVICIO['whatsapp']}?") or link not in parse_qs(urlparse(href).query).get("text", [""])[0]:
        problemas.append(f"{nombre}: el botón Avisar por WhatsApp no lleva al servicio con el link del pedido: {href}")
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
    marcador_a_la_vista(pg, nombre, "A")
    paso_de_mapa(pg, nombre, cap, 2)
    pg.get_by_role("button", name="Siguiente").click()
    mapa = pg.locator("[data-mapa]")
    caja = mapa.bounding_box()
    # Un toque de verdad (eventos touch), no un click de mouse: así lo recibe Leaflet en el celular.
    mapa.tap(position={"x": caja["width"] * 0.7, "y": caja["height"] * 0.35})
    expect(pg.get_by_text("Podés arrastrar el punto")).to_be_visible()
    marcador_a_la_vista(pg, nombre, "B")
    paso_de_mapa(pg, nombre, cap, 3)
    pg.get_by_role("button", name="Siguiente").click()
    pg.get_by_label("Tu nombre").fill("Control automático")
    pg.get_by_label("Tu celular").fill("2656 15 123456")
    cap("4-datos")
    comunes(pg, f"{nombre} datos")
    pg.get_by_role("button", name="Siguiente").click()
    expect(pg.get_by_text("Revisá tu pedido")).to_be_visible()
    if not PUBLICADA:  # con la tarifa de prueba (mínimo 98765) el estimado no depende de dónde cayeron los puntos
        # En el remito el precio va grande y solo, con "estimado" como rótulo al lado.
        expect(pg.get_by_text("$ 98.765", exact=True)).to_be_visible()
        expect(pg.get_by_text("estimado", exact=True)).to_be_visible()
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
    return None if PUBLICADA else confirmar(pg, nombre, consola, cap, sin_senal=True)


def no_encontrado(pg, nombre, cap):
    al_azar = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
    for id_ in ("roto", al_azar):
        pg.goto(f"{BASE}?pedido={id_}", wait_until="load")
        expect(pg.get_by_text("No encontramos ese pedido")).to_be_visible(timeout=20000)
    cap("7-no-encontrado")
    comunes(pg, f"{nombre} no encontrado")


# --- Datos de prueba por REST, siempre en pruebas (cuentas_prueba fija el proyecto y la clave).
API = "https://firestore.googleapis.com/v1/projects/envios-merlo-pruebas/databases/(default)/documents"
SERVICIO = {"bajada": 1, "porKm": 1, "minimo": 98765, "factor": 1.3, "whatsapp": "5492656000000"}


def rest(metodo, ruta, cuerpo=None):
    req = urllib.request.Request(f"{API}/{ruta}", method=metodo, data=json.dumps(cuerpo).encode() if cuerpo else None,
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {cuentas_prueba.token('operador')}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def preparar_servicio():
    # Una tarifa conocida al empezar: probar_reglas.py y corridas anteriores la dejan como sea.
    campos = {k: {"integerValue": str(v)} if isinstance(v, int) else {"doubleValue": v} if isinstance(v, float) else {"stringValue": v}
              for k, v in SERVICIO.items()}
    rest("PATCH", "config/servicio", {"fields": campos})


# --- Panel
def entrar_al_panel(pg, nombre, consola, cap, rol="operador"):
    pg.goto(BASE + "panel/", wait_until="load")
    expect(pg.get_by_label("Email")).to_be_visible()
    if PUBLICADA:
        cap("login")
        comunes(pg, f"{nombre} login")
        return
    if conectada_a(consola) != "envios-merlo-pruebas":
        sys.exit(f"{nombre}: el panel está conectado a {conectada_a(consola)!r} y no a envios-merlo-pruebas. Corto sin entrar.")
    cuenta = cuentas_prueba.cuentas()[rol]
    pg.get_by_label("Email").fill(cuenta["email"])
    pg.get_by_label("Contraseña").fill(cuenta["clave"])
    pg.get_by_role("button", name="Entrar").click()
    expect(pg.locator("[data-cargado], [data-cartel]").first).to_be_visible(timeout=20000)


def activar_avisos(pg, nombre, tocar):
    tocar(pg.get_by_role("button", name="Activar avisos"))
    expect(pg.get_by_role("button", name="Activar avisos")).to_have_count(0)


def alta_motoquero(pg, nombre, tocar, cap):
    tocar(pg.get_by_role("button", name="Motoqueros", exact=True))
    moto, local = f"Moto {secrets.token_hex(3)}", str(100000 + secrets.randbelow(900000))
    pg.get_by_label("Nombre").fill(moto)
    pg.get_by_label("Celular").fill(f"2656 15 {local}")
    tocar(pg.get_by_role("button", name="Agregar"))
    item = pg.locator(f'[data-motoquero="{moto}"]')
    expect(item.get_by_label("Activo hoy")).to_be_checked()
    # "Activo hoy" es la jornada de Argentina, no la fecha de UTC: corta a las 6 de la mañana (como hoy() en Motoqueros.tsx).
    # La casilla se tilda con la escritura local: se espera a que el servidor la tenga antes de leerla.
    hoy_ar = (datetime.now(ZoneInfo("America/Argentina/San_Luis")) - timedelta(hours=6)).date().isoformat()
    for _ in range(10):
        guardado = [d for d in rest("GET", "motoqueros?pageSize=300").get("documents", [])
                    if d["fields"]["nombre"]["stringValue"] == moto]
        if guardado:
            break
        time.sleep(1)
    if not guardado or guardado[0]["fields"]["activoEl"].get("stringValue") != hoy_ar:
        problemas.append(f"{nombre}: el motoquero no quedó activo con la fecha de hoy en Argentina ({hoy_ar})")
    cap("motoqueros")
    comunes(pg, f"{nombre} motoqueros")
    return moto, f"5492656{local}"  # el panel queda en Motoqueros: ahí le llega el pedido del cliente


def asignar_y_entregar(pp, pc, id_, moto, celular_moto, nombre, tocar, cap_p, cap_c):
    tarjeta = pp.locator(f'li[data-id="{id_}"]')
    tarjeta.get_by_label("Quién lo lleva").select_option(label=moto)
    precio = tarjeta.get_by_label("Precio en pesos")
    expect(precio).to_have_value(str(SERVICIO["minimo"]))  # arranca en el estimado
    precio.fill("3500")
    tocar(tarjeta.get_by_role("button", name="Asignar", exact=True))
    expect(tarjeta).to_have_attribute("data-estado", "asignado")
    href = tarjeta.locator("[data-whatsapp-motoquero]").get_attribute("href") or ""
    url, texto = urlparse(href), parse_qs(urlparse(href).query).get("text", [""])[0]
    for falta, ok in (("su celular", url.netloc == "wa.me" and url.path == f"/{celular_moto}"),
                      ("el link de seguimiento", f"{BASE}?pedido={id_}" in texto), ("el cliente", "Control automático" in texto),
                      ("el mapa", "https://www.google.com/maps/dir/?api=1&destination=" in texto), ("el precio", "$ 3.500" in texto)):
        if not ok:
            problemas.append(f"{nombre}: el WhatsApp al motoquero no lleva {falta}: {href[:200]}")
    cap_p("2-asignado")
    comunes(pp, f"{nombre} asignado")
    expect(pc.locator("h1[data-estado=asignado]")).to_be_visible(timeout=20000)
    expect(pc.locator("[data-motoquero]")).to_contain_text(moto)
    expect(pc.get_by_text("$ 3.500", exact=True)).to_be_visible()
    cap_c("7-asignado")
    for boton, estado in (("En camino", "en_camino"), ("Entregado", "entregado")):
        tocar(tarjeta.get_by_role("button", name=boton, exact=True))
        expect(pc.locator(f"h1[data-estado={estado}]")).to_be_visible(timeout=20000)
    cap_c("8-entregado")


def cancelar(pp, pc, id_, nombre, tocar, cap_c):
    tarjeta = pp.locator(f'li[data-id="{id_}"]')
    tocar(tarjeta.get_by_role("button", name="Cancelar pedido"))
    motivo = "Prueba de cancelación del control"
    tarjeta.get_by_label("Motivo de la cancelación").fill(motivo)
    tocar(tarjeta.get_by_role("button", name="Confirmar cancelación"))
    expect(pc.locator("h1[data-estado=cancelado]")).to_be_visible(timeout=20000)
    expect(pc.get_by_text(motivo)).to_be_visible()
    cap_c("7-cancelado")


def tarifa(pp, nombre, tocar, cap):
    tocar(pp.get_by_role("button", name="Tarifa", exact=True))
    expect(pp.get_by_label("Mínimo ($)")).to_have_value(str(SERVICIO["minimo"]))
    pp.get_by_label("Mínimo ($)").fill(f"{SERVICIO['minimo']:,}".replace(",", "."))  # con punto de miles, como se escribe
    tocar(pp.get_by_role("button", name="Guardar"))
    expect(pp.get_by_text("Guardado.")).to_be_visible()
    # Lo guardado de verdad (no lo que muestra la pantalla) tiene que ser la tarifa de prueba, con el mínimo sin el punto.
    campos = rest("GET", "config/servicio")["fields"]
    guardado = {k: int(v["integerValue"]) if "integerValue" in v else v.get("doubleValue", v.get("stringValue")) for k, v in campos.items()}
    if guardado != SERVICIO:
        problemas.append(f"{nombre}: la tarifa guardada no es la esperada: {guardado}")
    cap("3-tarifa")
    comunes(pp, f"{nombre} tarifa")


def baja_motoquero(pp, moto, tocar):
    tocar(pp.get_by_role("button", name="Motoqueros", exact=True))
    item = pp.locator(f'[data-motoquero="{moto}"]')
    tocar(item.get_by_role("button", name="Dar de baja"))
    tocar(item.get_by_role("button", name="Sí, dar de baja"))
    expect(item).to_have_count(0)


DISPOSITIVOS = {
    "movil": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                  permissions=["geolocation"], geolocation=GPS),
    "pc": dict(viewport={"width": 1440, "height": 900}),
}
RECORRIDOS = {"movil": pedido_con_mapa, "pc": pedido_con_referencias}


def contexto(nav, opciones):
    ctx = nav.new_context(**opciones, locale="es-AR", timezone_id="America/Argentina/San_Luis")
    if not PUBLICADA:
        ctx.route("https://envios.test/**", servir)
    ctx.route("https://tile.openstreetmap.org/**", tiles)
    return ctx


paginas = []
SIN_RED = ("ERR_INTERNET_DISCONNECTED", "Could not reach Cloud Firestore backend")


def abrir(ctx, nombre):
    """Página que junta sus errores y su consola; al final se revisa a qué base se conectó."""
    pg = ctx.new_page()
    errores: list[str] = []
    consola: list[str] = []
    # Los provoca el corte de red simulado de la prueba sin señal, no la app: el navegador y Firestore avisan que no hay red.
    pg.on("console", lambda m: (consola.append(m.text), m.type == "error" and not any(x in m.text for x in SIN_RED)
                                and errores.append(m.text)))
    pg.on("pageerror", lambda e: errores.append(str(e)))
    pg.on("response", lambda r: r.status >= 400 and r.url.startswith(BASE) and errores.append(f"{r.status} {r.url}"))
    paginas.append((nombre, consola, errores))
    return pg, consola, lambda n: pg.screenshot(path=str(OUT / f"{nombre}-{n}.png"))


def revisar_paginas():
    for nombre, consola, errores in paginas:
        if conectada_a(consola) != BASE_DE_DATOS:
            problemas.append(f"{nombre}: la página está conectada a {conectada_a(consola)!r} y tendría que estar en {BASE_DE_DATOS}")
        problemas.extend(f"{nombre}: {e}" for e in errores)


if not PUBLICADA and not (DIST / "index.html").is_file():
    sys.exit("Falta dist/: corré antes npm run build")
if PUBLICADA:
    # Solo lectura. Con las reglas de la Actualización 2, /config/servicio se lee (200, o 404 si todavía no se cargó);
    # con las viejas da 403. Las reglas recién subidas tardan hasta un minuto.
    for intento in range(12):
        try:
            urllib.request.urlopen("https://firestore.googleapis.com/v1/projects/envios-merlo/databases/(default)/documents/config/servicio", timeout=30)
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                break
            if intento == 11:
                sys.exit(f"envios-merlo responde {e.code} a /config/servicio: faltan las reglas nuevas (npm run reglas:real).")
            time.sleep(10)
else:
    import cuentas_prueba
    preparar_servicio()
OUT.mkdir(parents=True, exist_ok=True)
print(f"Dirección: {BASE} · base esperada: {BASE_DE_DATOS} · {'solo lectura' if PUBLICADA else 'crea pedidos de prueba'}")
with sync_playwright() as p:
    nav = p.chromium.launch()
    for disp, opciones in DISPOSITIVOS.items():
        tocar = (lambda l: l.tap()) if disp == "movil" else (lambda l: l.click())
        ctx_cliente, ctx_panel = contexto(nav, opciones), contexto(nav, opciones)
        if PUBLICADA:
            pc, cc, cap_c = abrir(ctx_cliente, f"cliente-{disp}")
            RECORRIDOS[disp](pc, f"cliente-{disp}", cc, cap_c)
            no_encontrado(pc, f"cliente-{disp}", cap_c)
            pp, cp, cap_p = abrir(ctx_panel, f"panel-{disp}")
            entrar_al_panel(pp, f"panel-{disp}", cp, cap_p)
        else:
            # El panel abre primero: el pedido tiene que llegarle en vivo y como nuevo, no en la carga inicial.
            pp, cp, cap_p = abrir(ctx_panel, f"panel-{disp}")
            entrar_al_panel(pp, f"panel-{disp}", cp, cap_p)
            activar_avisos(pp, f"panel-{disp}", tocar)
            cap_p("1-pedidos")
            comunes(pp, f"panel-{disp} pedidos")
            moto = alta_motoquero(pp, f"panel-{disp}", tocar, cap_p) if disp == "movil" else None
            sonidos = int(pp.evaluate("document.body.dataset.sonidos || '0'"))
            pc, cc, cap_c = abrir(ctx_cliente, f"cliente-{disp}")
            link = RECORRIDOS[disp](pc, f"cliente-{disp}", cc, cap_c)
            id_ = link.split("pedido=")[1]
            if moto:
                # En el celular el pedido llega con el panel en Motoqueros: tiene que sonar igual, sin volver a Pedidos.
                try:
                    pp.wait_for_function("n => Number(document.body.dataset.sonidos || 0) > n", arg=sonidos, timeout=60000)
                except TiempoAgotado:
                    problemas.append(f"panel-{disp}: llegó un pedido nuevo con el panel en Motoqueros y no sonó")
                tocar(pp.get_by_role("button", name="Pedidos", exact=True))
            expect(pp.locator(f'li[data-id="{id_}"]')).to_be_visible(timeout=60000)
            expect(pp.locator(f'li[data-id="{id_}"]')).to_have_attribute("data-nuevo", "true")
            if int(pp.evaluate("document.body.dataset.sonidos || '0'")) <= sonidos:
                problemas.append(f"panel-{disp}: llegó un pedido nuevo y no sonó")
            if not pp.title().startswith("("):
                problemas.append(f"panel-{disp}: el título no cuenta los pedidos que esperan: {pp.title()}")
            cap_p("1-nuevo")
            if moto:
                asignar_y_entregar(pp, pc, id_, *moto, f"panel-{disp}", tocar, cap_p, cap_c)
                baja_motoquero(pp, moto[0], tocar)
            else:
                cancelar(pp, pc, id_, f"panel-{disp}", tocar, cap_c)
                tarifa(pp, f"panel-{disp}", tocar, cap_p)
            final = pc.locator("h1[data-estado]").get_attribute("data-estado")
            no_encontrado(pc, f"cliente-{disp}", cap_c)
            # El link en un navegador limpio (sin el pedido guardado ni la escritura local de Firestore).
            limpio = contexto(nav, opciones)
            pl, _, cap_l = abrir(limpio, f"link-{disp}")
            pl.goto(link, wait_until="load")
            expect(pl.locator(f"h1[data-estado={final}]")).to_be_visible(timeout=20000)
            cap_l("abierto")
            limpio.close()
        ctx_cliente.close()
        ctx_panel.close()
        print(f"{disp} recorrido")
    if not PUBLICADA:
        # Logueado pero sin permiso: un cartel, no una lista vacía.
        ctx = contexto(nav, DISPOSITIVOS["pc"])
        pi, ci, cap_i = abrir(ctx, "panel-intruso")
        entrar_al_panel(pi, "panel-intruso", ci, cap_i, rol="intruso")
        expect(pi.locator("[data-cartel]")).to_contain_text("no tiene permiso")
        cap_i("cartel")
        ctx.close()
    nav.close()
revisar_paginas()

if problemas:
    print("PROBLEMAS:")
    for x in problemas:
        print("  " + x)
    sys.exit(1)
print("TODO OK")
