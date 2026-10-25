// Chequeos de las cuentas que no se ven en pantalla: precio y teléfono. Corre antes de cada build (npm run build).
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { kmEnLinea, precioEstimado } from "../compartido/precio.ts";
import { normalizarTelefono } from "../compartido/telefono.ts";

// Plaza de Merlo → 1 km al norte (1° de latitud ≈ 111,19 km con radio 6371).
const plaza = { lat: -32.342558, lng: -65.0136903 };
const norte = { lat: plaza.lat + 1 / 111.195, lng: plaza.lng };
assert.ok(Math.abs(kmEnLinea(plaza, norte) - 1) < 0.001);
assert.equal(kmEnLinea(plaza, plaza), 0);

const tarifa = { bajada: 1000, porKm: 500, minimo: 2000 };
assert.equal(precioEstimado(plaza, norte, tarifa), 2000); // 1000 + 1,3 km × 500 = 1650 → el mínimo
const lejos = { lat: plaza.lat + 10 / 111.195, lng: plaza.lng };
assert.equal(precioEstimado(plaza, lejos, tarifa), 7500); // 1000 + 13 km × 500
assert.equal(precioEstimado(null, lejos, tarifa), null);
assert.equal(precioEstimado(plaza, lejos, null), null);

// Lo que sale de normalizarTelefono tiene que pasar la misma regex que exigen las reglas de Firestore.
const regla = /telefono\.matches\('([^']+)'\)/.exec(readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"));
assert.ok(regla, "no encontré la regex del teléfono en firestore.rules");
const pasaLaRegla = new RegExp(`^${regla[1]}$`);
const casos: Record<string, string | null> = {
  "2656 15 123456": "5492656123456",
  "02656-123456": "5492656123456",
  "+54 9 2656 123456": "5492656123456",
  "54 2656 15 123456": "5492656123456",
  "123456": "5492656123456",
  "15 123456": "5492656123456",
  "11 2345-6789": "5491123456789",
  "011 15 2345-6789": "5491123456789",
  "(0351) 15 123-4567": "5493511234567",
  "1234": null,
  "15 5555 1234": null,
  "": null,
  "2656 1234567": null,
};
for (const [entrada, esperado] of Object.entries(casos)) {
  const salida = normalizarTelefono(entrada);
  assert.equal(salida, esperado, `normalizarTelefono(${JSON.stringify(entrada)})`);
  if (salida) assert.match(salida, pasaLaRegla, `${salida} no pasa la regla de Firestore`);
}

console.log("chequeos ok");
