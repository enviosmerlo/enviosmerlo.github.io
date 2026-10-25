import type { GeoPoint, Timestamp } from "firebase/firestore";

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

// Un pedido como queda en Firestore: lo que cargó el cliente más lo que agrega el operador al asignarlo.
type LugarGuardado = { punto: GeoPoint | null; referencia: string | null };
export type Pedido = {
  tipo: Tipo;
  origen: LugarGuardado;
  destino: LugarGuardado;
  nombre: string;
  telefono: string;
  nota: string;
  precioEstimado: number | null;
  estado: Estado;
  creado: Timestamp | null;
  motoquero?: { id: string; nombre: string };
  precio?: number;
  motivo?: string;
};

// Link de seguimiento de un pedido, desde cualquier pantalla: la del cliente está en la raíz y el panel en panel/.
export const linkDelPedido = (id: string, raiz: string) => new URL(`?pedido=${id}`, raiz).href;
