// Precio estimado: bajada + km × precio por km, con un mínimo. Los km son la línea recta × un factor por las calles.
// Es estimado: lo confirma el operador.

// La carga el operador en el panel (/config/servicio, ver compartido/servicio.ts).
export type Tarifa = { bajada: number; porKm: number; minimo: number; factor: number };
type Punto = { lat: number; lng: number };

// Distancia en línea recta (haversine), en km.
export function kmEnLinea(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// null = "a confirmar": falta la tarifa o alguno de los dos puntos en el mapa.
// ponytail: redondea al peso; el redondeo comercial se define con la tarifa.
export function precioEstimado(a: Punto | null, b: Punto | null, tarifa: Tarifa | null): number | null {
  if (!tarifa || !a || !b) return null;
  const km = kmEnLinea(a, b) * tarifa.factor;
  return Math.round(Math.max(tarifa.minimo, tarifa.bajada + km * tarifa.porKm));
}
