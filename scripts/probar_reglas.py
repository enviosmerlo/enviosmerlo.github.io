"""Prueba las reglas de Firestore con escrituras de verdad, sin sesión, contra el proyecto de PRUEBAS.
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

# Fijo a propósito: este script escribe, y nunca tiene que poder apuntar al proyecto real.
PROYECTO = "envios-merlo-pruebas"
DOCS = f"projects/{PROYECTO}/databases/(default)/documents"
API = f"https://firestore.googleapis.com/v1/{DOCS}"
fallas: list[str] = []


def pedir(metodo, url, cuerpo=None):
    req = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                                 headers={"Content-Type": "application/json"})
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


# Las reglas recién subidas tardan hasta un minuto: se reintenta el pedido válido antes de probar rechazos.
print(f"Proyecto: {PROYECTO}")
for intento in range(10):
    codigo, r, valido = crear(pedido())
    if codigo == 200:
        break
    time.sleep(10)
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
codigo, r = pedir("GET", f"{API}/pedidos")
esperar("listar los pedidos", codigo, r, "denegado")
codigo, r = pedir("POST", f"{API}:runQuery", {"structuredQuery": {"from": [{"collectionId": "pedidos"}], "limit": 5}})
esperar("consultar los pedidos", codigo, r, "denegado")

if fallas:
    print("FALLAS:")
    for f in fallas:
        print("  " + f)
    sys.exit(1)
print("REGLAS OK")
