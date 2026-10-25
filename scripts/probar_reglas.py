"""Prueba las reglas de Firestore con escrituras de verdad contra el proyecto de PRUEBAS, como tres personas:
sin sesión, con la sesión del operador de prueba y con la de un intruso (logueado, sin permiso). Ver cuentas_prueba.py.
Un rechazo cuenta solo si es 403 PERMISSION_DENIED: cualquier otro error (un pedido mal armado acá) hace fallar la prueba.

Uso:  npm run reglas:pruebas && python3 scripts/probar_reglas.py
"""
import json
import secrets
import string
import sys
import time
import urllib.error
import urllib.request

import cuentas_prueba

# Fijo a propósito: este script escribe, y nunca tiene que poder apuntar al proyecto real.
PROYECTO = "envios-merlo-pruebas"
DOCS = f"projects/{PROYECTO}/databases/(default)/documents"
API = f"https://firestore.googleapis.com/v1/{DOCS}"
fallas: list[str] = []


def pedir(metodo, url, cuerpo=None, token=None):
    cabeceras = {"Content-Type": "application/json"} | ({"Authorization": f"Bearer {token}"} if token else {})
    req = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                                 headers=cabeceras)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def nuevo_id():
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))


def s(v): return {"stringValue": v}
def nulo(): return {"nullValue": None}
def punto(lat, lng): return {"geoPointValue": {"latitude": lat, "longitude": lng}}
def mapa(**campos): return {"mapValue": {"fields": campos}}


def pedido(**cambios):
    campos = {
        "tipo": s("paquete"),
        "origen": mapa(punto=punto(-32.3425580, -65.0136903), referencia=s("portón verde")),
        "destino": mapa(punto=nulo(), referencia=s("kiosco de la plaza")),
        "nombre": s("Prueba Reglas"),
        "telefono": s("5492656123456"),
        "nota": s(""),
        "precioEstimado": nulo(),
        "estado": s("recibido"),
    }
    campos.update(cambios)
    return {k: v for k, v in campos.items() if v is not None}


def crear(campos, id_=None, hora_del_servidor=True):
    id_ = id_ or nuevo_id()
    escritura = {"update": {"name": f"{DOCS}/pedidos/{id_}", "fields": campos}, "currentDocument": {"exists": False}}
    if hora_del_servidor:
        escritura["updateTransforms"] = [{"fieldPath": "creado", "setToServerValue": "REQUEST_TIME"}]
    codigo, r = pedir("POST", f"{API}:commit", {"writes": [escritura]})
    return codigo, r, id_


def esperar(nombre, codigo, r, esperado):
    if isinstance(r, list) and r:  # runQuery responde una lista, también con el error
        r = r[0]
    if esperado == "ok" and codigo == 200:
        print(f"  ok        {nombre}")
    elif esperado == "denegado" and codigo == 403 and r.get("error", {}).get("status") == "PERMISSION_DENIED":
        print(f"  denegado  {nombre}")
    else:
        fallas.append(f"{nombre}: se esperaba {esperado} y vino {codigo} {json.dumps(r)[:200]}")
        print(f"  FALLA     {nombre}: {codigo}")


if cuentas_prueba.PROYECTO != PROYECTO:
    sys.exit("Las cuentas de prueba no son de este proyecto. Corto.")
OPERADOR, INTRUSO = cuentas_prueba.token("operador"), cuentas_prueba.token("intruso")
CONSULTA = {"structuredQuery": {"from": [{"collectionId": "pedidos"}], "orderBy": [{"field": {"fieldPath": "creado"}, "direction": "DESCENDING"}], "limit": 5}}

# Las reglas recién subidas tardan hasta un minuto: se espera algo que solo permiten las nuevas (el operador lista).
print(f"Proyecto: {PROYECTO}")
for intento in range(15):
    codigo, r = pedir("POST", f"{API}:runQuery", CONSULTA, OPERADOR)
    if codigo == 200:
        break
    time.sleep(10)
esperar("el operador lista los pedidos (reglas nuevas ya activas)", codigo, r, "ok")
if codigo != 200:
    sys.exit("Las reglas nuevas no están activas; no tiene sentido seguir.")
codigo, r, valido = crear(pedido())
esperar("crear un pedido válido (punto + referencia)", codigo, r, "ok")
if codigo != 200:
    sys.exit("Las reglas no aceptan un pedido válido; no tiene sentido seguir.")

codigo, r, _ = crear(pedido(origen=mapa(punto=nulo(), referencia=s("casa de la esquina")), nota=s("comprar pan"),
                            precioEstimado={"integerValue": "4500"}))
esperar("crear con solo referencias, nota y precio", codigo, r, "ok")

codigo, r = pedir("GET", f"{API}/pedidos/{valido}")
esperar("leer un pedido por su ID", codigo, r, "ok")
codigo, r = pedir("GET", f"{API}/pedidos/{nuevo_id()}")
if codigo != 404:
    fallas.append(f"leer un ID que no existe: se esperaba 404 y vino {codigo}")
print(f"  {'ok' if codigo == 404 else 'FALLA':<9} leer un ID que no existe da 404")

largo = "x" * 61
rechazos = {
    "campo de más": pedido(admin=s("si")),
    "falta la nota": pedido(nota=None),
    "estado distinto de recibido": pedido(estado=s("entregado")),
    "tipo que no existe": pedido(tipo=s("pasajero")),
    "nombre de 61 caracteres": pedido(nombre=s(largo)),
    "nombre de 1 caracter": pedido(nombre=s("x")),
    "nota de 301 caracteres": pedido(nota=s("x" * 301)),
    "teléfono sin normalizar": pedido(telefono=s("2656 15 123456")),
    "teléfono con letras": pedido(telefono=s("549265612345a")),
    "precio negativo": pedido(precioEstimado={"integerValue": "-1"}),
    "precio como texto": pedido(precioEstimado=s("1000")),
    "precio absurdo": pedido(precioEstimado={"integerValue": "10000001"}),
    "origen sin punto ni referencia": pedido(origen=mapa(punto=nulo(), referencia=nulo())),
    "origen con clave de más": pedido(origen=mapa(punto=nulo(), referencia=s("casa"), extra=s("x"))),
    "origen sin la clave punto": pedido(origen=mapa(referencia=s("casa"))),
    "referencia vacía": pedido(destino=mapa(punto=nulo(), referencia=s(""))),
    "referencia de 5000 caracteres": pedido(destino=mapa(punto=nulo(), referencia=s("x" * 5000))),
    "punto que no es un punto": pedido(destino=mapa(punto=s("-32,-65"), referencia=nulo())),
    "origen que no es un mapa": pedido(origen=s("Merlo")),
}
for nombre, campos in rechazos.items():
    codigo, r, _ = crear(campos)
    esperar(nombre, codigo, r, "denegado")

codigo, r, _ = crear(pedido(creado={"timestampValue": "2020-01-01T00:00:00Z"}), hora_del_servidor=False)
esperar("fecha de creación falsa", codigo, r, "denegado")
codigo, r, _ = crear(pedido(), id_="adivinable")
esperar("ID que no es de 20 caracteres al azar", codigo, r, "denegado")

# Sobre un pedido que ya existe: pisarlo es un update y nadie lo tiene.
codigo, r = pedir("PATCH", f"{API}/pedidos/{valido}", {"fields": pedido(estado=s("entregado"))})
esperar("pisar un pedido existente", codigo, r, "denegado")
codigo, r = pedir("PATCH", f"{API}/pedidos/{valido}?updateMask.fieldPaths=estado", {"fields": {"estado": s("cancelado")}})
esperar("cambiarle el estado", codigo, r, "denegado")
codigo, r = pedir("DELETE", f"{API}/pedidos/{valido}")
esperar("borrarlo", codigo, r, "denegado")
for quien, tk in (("sin sesión", None), ("intruso", INTRUSO)):
    codigo, r = pedir("GET", f"{API}/pedidos", token=tk)
    esperar(f"{quien}: listar los pedidos", codigo, r, "denegado")
    codigo, r = pedir("POST", f"{API}:runQuery", CONSULTA, tk)
    esperar(f"{quien}: consultar los pedidos", codigo, r, "denegado")
codigo, r = pedir("POST", f"{API}:runQuery", {"structuredQuery": {"from": [{"collectionId": "pedidos"}], "limit": 500}}, OPERADOR)
esperar("operador: consultar sin tope razonable (500)", codigo, r, "denegado")


# --- El operador sobre un pedido: solo estado, motoquero, precio, motivo y la hora del cambio.
def cambiar(id_, campos, token, hora=True):
    escritura = {"update": {"name": f"{DOCS}/pedidos/{id_}", "fields": campos},
                 "updateMask": {"fieldPaths": list(campos)}, "currentDocument": {"exists": True}}
    if hora:
        escritura["updateTransforms"] = [{"fieldPath": "actualizado", "setToServerValue": "REQUEST_TIME"}]
    return pedir("POST", f"{API}:commit", {"writes": [escritura]}, token)


asignar = {"estado": s("asignado"), "motoquero": mapa(id=s("moto123"), nombre=s("Juan Prueba")), "precio": {"integerValue": "3500"}}
for quien, tk in (("sin sesión", None), ("intruso", INTRUSO)):
    codigo, r = cambiar(valido, asignar, tk)
    esperar(f"{quien}: asignar un pedido", codigo, r, "denegado")
codigo, r = cambiar(valido, asignar, OPERADOR)
esperar("operador: asignar con motoquero y precio", codigo, r, "ok")
malos = {
    "cambiarle el nombre al cliente": {"nombre": s("Otro")},
    "estado que no existe": {"estado": s("volando")},
    "motoquero con su celular": {"motoquero": mapa(id=s("moto123"), nombre=s("Juan"), telefono=s("5492656111111"))},
    "precio negativo": {"precio": {"integerValue": "-5"}},
    "precio con decimales": {"precio": {"doubleValue": 3500.5}},
    "cancelar sin motivo": {"estado": s("cancelado")},
    "motivo de 1 caracter": {"estado": s("cancelado"), "motivo": s("x")},
    "dejarlo asignado sin precio": {"estado": s("asignado"), "precio": None},
}
for nombre, campos in malos.items():
    campos = {k: v for k, v in campos.items() if v is not None} or {"estado": s("recibido")}
    mascara = list(campos) + (["precio"] if nombre.endswith("sin precio") else [])
    escritura = {"update": {"name": f"{DOCS}/pedidos/{valido}", "fields": campos}, "updateMask": {"fieldPaths": mascara},
                 "updateTransforms": [{"fieldPath": "actualizado", "setToServerValue": "REQUEST_TIME"}], "currentDocument": {"exists": True}}
    codigo, r = pedir("POST", f"{API}:commit", {"writes": [escritura]}, OPERADOR)
    esperar(f"operador: {nombre}", codigo, r, "denegado")
codigo, r = cambiar(valido, {"estado": s("en_camino"), "actualizado": {"timestampValue": "2020-01-01T00:00:00Z"}}, OPERADOR, hora=False)
esperar("operador: hora del cambio falsa", codigo, r, "denegado")
for estado in ("en_camino", "entregado"):
    codigo, r = cambiar(valido, {"estado": s(estado)}, OPERADOR)
    esperar(f"operador: pasar a {estado}", codigo, r, "ok")
codigo, r = cambiar(valido, {"estado": s("cancelado"), "motivo": s("El cliente no respondía")}, OPERADOR)
esperar("operador: cancelar con motivo", codigo, r, "ok")
codigo, r = pedir("DELETE", f"{API}/pedidos/{valido}", token=OPERADOR)
esperar("operador: borrar un pedido", codigo, r, "denegado")


# --- Motoqueros: solo el operador los ve y los carga; no se borran (la baja queda para el historial).
def moto(**cambios):
    campos = {"nombre": s("Moto Prueba"), "telefono": s("5492656222222"), "activoEl": s("2026-10-25"), "baja": {"booleanValue": False}}
    campos.update(cambios)
    return {"fields": campos}


for quien, tk in (("sin sesión", None), ("intruso", INTRUSO)):
    codigo, r = pedir("POST", f"{API}/motoqueros", moto(), tk)
    esperar(f"{quien}: dar de alta un motoquero", codigo, r, "denegado")
    codigo, r = pedir("GET", f"{API}/motoqueros", token=tk)
    esperar(f"{quien}: ver los motoqueros", codigo, r, "denegado")
codigo, r = pedir("POST", f"{API}/motoqueros", moto(), OPERADOR)
esperar("operador: dar de alta un motoquero", codigo, r, "ok")
id_moto = r.get("name", "/").rsplit("/", 1)[1]
codigo, r = pedir("GET", f"{API}/motoqueros", token=OPERADOR)
esperar("operador: ver los motoqueros", codigo, r, "ok")
for nombre, campos in {"celular sin normalizar": moto(telefono=s("2656 15 222222")),
                        "campo de más": moto(dni=s("123")), "fecha que no es fecha": moto(activoEl=s("hoy")),
                        "baja que no es sí/no": moto(baja=s("si"))}.items():
    codigo, r = pedir("POST", f"{API}/motoqueros", campos, OPERADOR)
    esperar(f"operador: motoquero con {nombre}", codigo, r, "denegado")
codigo, r = pedir("PATCH", f"{API}/motoqueros/{id_moto}", moto(baja={"booleanValue": True}, activoEl=nulo()), OPERADOR)
esperar("operador: dar de baja un motoquero", codigo, r, "ok")
codigo, r = pedir("DELETE", f"{API}/motoqueros/{id_moto}", token=OPERADOR)
esperar("operador: borrar un motoquero", codigo, r, "denegado")


# --- Tarifa y WhatsApp del servicio: los lee cualquiera, los escribe solo el operador.
def servicio(**cambios):
    campos = {"bajada": {"integerValue": "1000"}, "porKm": {"integerValue": "500"}, "minimo": {"integerValue": "2000"},
              "factor": {"doubleValue": 1.3}, "whatsapp": s("5492656000000")}
    campos.update(cambios)
    return {"fields": campos}


for quien, tk in (("sin sesión", None), ("intruso", INTRUSO)):
    codigo, r = pedir("PATCH", f"{API}/config/servicio", servicio(), tk)
    esperar(f"{quien}: cambiar la tarifa", codigo, r, "denegado")
codigo, r = pedir("PATCH", f"{API}/config/servicio", servicio(), OPERADOR)
esperar("operador: cargar tarifa y WhatsApp", codigo, r, "ok")
codigo, r = pedir("GET", f"{API}/config/servicio")
esperar("sin sesión: leer tarifa y WhatsApp", codigo, r, "ok")
codigo, r = pedir("PATCH", f"{API}/config/servicio", servicio(bajada=nulo(), porKm=nulo(), minimo=nulo(), whatsapp=nulo()), OPERADOR)
esperar("operador: tarifa y WhatsApp sin cargar (null)", codigo, r, "ok")
for nombre, campos in {"WhatsApp sin normalizar": servicio(whatsapp=s("2656 000000")), "factor 10": servicio(factor={"integerValue": "10"}),
                        "bajada negativa": servicio(bajada={"integerValue": "-1"}), "campo de más": servicio(extra=s("x"))}.items():
    codigo, r = pedir("PATCH", f"{API}/config/servicio", campos, OPERADOR)
    esperar(f"operador: servicio con {nombre}", codigo, r, "denegado")
codigo, r = pedir("PATCH", f"{API}/config/otra", {"fields": {"x": s("y")}}, OPERADOR)
esperar("operador: escribir otro documento de config", codigo, r, "denegado")

if fallas:
    print("FALLAS:")
    for f in fallas:
        print("  " + f)
    sys.exit(1)
print("REGLAS OK")
