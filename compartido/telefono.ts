// Pasa un celular argentino escrito como sea ("2656 15 123456", "02656-123456", "+54 9 2656 123456", "123456")
// al formato de WhatsApp: 549 + los 10 dígitos del número nacional (código de área sin 0 + número sin 15).
// null si no se puede saber el número.
export const AREA_MERLO = "2656";

export function normalizarTelefono(texto: string): string | null {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // El 15 va después del código de área, que tiene 2, 3 o 4 dígitos.
  // ponytail: se prueba de corto a largo; alcanza para los códigos reales, que no esconden un "15" adentro.
  if (d.length === 12) {
    const k = [2, 3, 4].find((k) => d.slice(k, k + 2) === "15");
    if (k !== undefined) d = d.slice(0, k) + d.slice(k + 2);
  }
  // Solo el número local de Merlo (6 dígitos, con o sin 15 adelante).
  if (d.length === 8 && d.startsWith("15")) d = d.slice(2);
  if (d.length === 6) d = AREA_MERLO + d;
  return d.length === 10 ? "549" + d : null;
}
