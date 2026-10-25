import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Tarifa } from "./precio";

// Tarifa y WhatsApp del servicio, que carga el operador en el panel. null = todavía sin cargar.
export type Servicio = { bajada: number | null; porKm: number | null; minimo: number | null; factor: number; whatsapp: string | null };
export const SIN_CARGAR: Servicio = { bajada: null, porKm: null, minimo: null, factor: 1.3, whatsapp: null };
export const servicioRef = doc(db, "config", "servicio");

export function tarifaDe(s: Servicio): Tarifa | null {
  const { bajada, porKm, minimo, factor } = s;
  return bajada !== null && porKm !== null && minimo !== null ? { bajada, porKm, minimo, factor } : null;
}

// El cliente lo lee una vez al abrir. Si no está o falla la lectura, sigue "a confirmar" y sin botón de WhatsApp.
export function useServicio() {
  const [servicio, setServicio] = useState(SIN_CARGAR);
  useEffect(() => {
    getDoc(servicioRef)
      .then((d) => d.exists() && setServicio(d.data() as Servicio))
      .catch(() => {});
  }, []);
  return servicio;
}
