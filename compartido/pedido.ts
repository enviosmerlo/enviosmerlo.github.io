// Forma de un pedido en Firestore (colección "pedidos"). Las reglas exigen exactamente estas claves.
export const TIPOS = {
  paquete: "Paquete",
  compras: "Compras",
  documentos: "Documentos",
  comida: "Comida",
} as const;
export type Tipo = keyof typeof TIPOS;

// En orden: así avanza un envío. Cancelado va aparte (lo pone el operador en la Actualización 2).
export const ESTADOS = {
  recibido: "Recibido",
  asignado: "Asignado",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
} as const;
export type Estado = keyof typeof ESTADOS;

export type Punto = { lat: number; lng: number };
export type Lugar = { punto: Punto | null; referencia: string };

// Los IDs automáticos de Firestore: 20 caracteres de A-Z, a-z y 0-9. Lo mismo exigen las reglas.
export const ID_VALIDO = /^[A-Za-z0-9]{20}$/;
