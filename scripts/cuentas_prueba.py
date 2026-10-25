"""Cuentas de prueba del panel, SOLO en envios-merlo-pruebas: un operador de prueba y un intruso (logueado sin permiso).
La primera vez las crea con datos al azar y las guarda en .env.pruebas (ignorado por git); después solo las lee.

Uso:  python3 scripts/cuentas_prueba.py   (imprime los uid; el del operador va en firestore.rules)
"""
import base64
import json
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Fijos a propósito: con la clave del real, estas cuentas se crearían en el proyecto real.
PROYECTO = "envios-merlo-pruebas"
CLAVE = "AIzaSyDFhqkuPvCp4UPf93UOZhACTf6bvyxdkhI"
ARCHIVO = Path(__file__).resolve().parent.parent / ".env.pruebas"


def _auth(metodo, cuerpo):
    req = urllib.request.Request(f"https://identitytoolkit.googleapis.com/v1/accounts:{metodo}?key={CLAVE}",
                                 data=json.dumps(cuerpo).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            datos = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Auth {metodo}: {e.code} {e.read().decode()[:200]}")
    # Se corta si el token no es de pruebas, antes de usarlo para nada.
    pedazo = datos["idToken"].split(".")[1]
    aud = json.loads(base64.urlsafe_b64decode(pedazo + "=" * (-len(pedazo) % 4)))["aud"]
    if aud != PROYECTO:
        sys.exit(f"El token es de {aud!r}, no de {PROYECTO}. Corto.")
    return datos


def cuentas():
    """{"operador": {...}, "intruso": {...}} con email, clave y uid."""
    if ARCHIVO.exists():
        return json.loads(ARCHIVO.read_text())
    datos = {}
    for rol in ("operador", "intruso"):
        email = f"{rol}-prueba-{secrets.token_hex(4)}@example.com"
        clave = secrets.token_urlsafe(18)
        r = _auth("signUp", {"email": email, "password": clave, "returnSecureToken": True})
        datos[rol] = {"email": email, "clave": clave, "uid": r["localId"]}
    ARCHIVO.write_text(json.dumps(datos, indent=2))
    return datos


def token(rol):
    """ID token de la cuenta de prueba, para llamar a Firestore como ella."""
    c = cuentas()[rol]
    return _auth("signInWithPassword", {"email": c["email"], "password": c["clave"], "returnSecureToken": True})["idToken"]


if __name__ == "__main__":
    for rol, c in cuentas().items():
        print(f"{rol}: uid {c['uid']}")
