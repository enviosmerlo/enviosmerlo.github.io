import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Punto } from "../../compartido/pedido";

// Tiles de OpenStreetMap: gratis y sin garantía. Su política pide la atribución siempre visible y no precargar zonas.
// ponytail: una sola constante, para cambiar de proveedor sin tocar nada más si OSM corta el acceso.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const MERLO: Punto = { lat: -32.342558, lng: -65.0136903 }; // centro de Villa de Merlo, nodo OSM 198403646

// Marcadores dibujados (A y B) en vez del pin de Leaflet, que con Vite pierde sus imágenes.
function icono(letra: string, activo: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="flex size-9 items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-md ${activo ? "bg-acento" : "bg-tinta"}">${letra}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

type Props = { a: Punto | null; b: Punto | null; editar: "a" | "b"; alMover: (p: Punto) => void };

// El cliente toca el mapa o arrastra su marcador para elegir el punto que está editando.
export default function Mapa({ a, b, editar, alMover }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map>(null);
  const marcadores = useRef<{ a?: L.Marker; b?: L.Marker }>({});
  const mover = useRef(alMover);
  mover.current = alMover;

  useEffect(() => {
    const m = L.map(caja.current!, { center: MERLO, zoom: 15 });
    L.tileLayer(TILES, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(m);
    m.on("click", (e) => mover.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    // El mapa vive dentro de un flex: cuando cambia de tamaño (teclado, rotación) Leaflet tiene que enterarse.
    const observador = new ResizeObserver(() => m.invalidateSize());
    observador.observe(caja.current!);
    mapa.current = m;
    return () => {
      observador.disconnect();
      m.remove();
      mapa.current = null;
      marcadores.current = {};
    };
  }, []);

  useEffect(() => {
    const m = mapa.current!;
    for (const letra of ["a", "b"] as const) {
      const punto = letra === "a" ? a : b;
      let marcador = marcadores.current[letra];
      if (!punto) {
        marcador?.remove();
        delete marcadores.current[letra];
        continue;
      }
      if (!marcador) {
        marcador = L.marker(punto, { draggable: letra === editar, icon: icono(letra.toUpperCase(), letra === editar) }).addTo(m);
        marcador.on("dragend", () => {
          const p = marcador!.getLatLng();
          mover.current({ lat: p.lat, lng: p.lng });
        });
        marcadores.current[letra] = marcador;
      } else {
        marcador.setLatLng(punto);
      }
    }
  }, [a, b, editar]);

  // Si el punto queda fuera de la vista (al abrir el paso, o al llegar de "usar mi ubicación"), se centra en él.
  // Tocar o arrastrar dentro de la vista no mueve el mapa.
  const enfoque = editar === "a" ? a : b;
  useEffect(() => {
    const m = mapa.current!;
    const p = enfoque ?? (editar === "a" ? b : a);
    if (p && !m.getBounds().pad(-0.1).contains(p)) m.setView(p, Math.max(m.getZoom(), 15));
  }, [enfoque?.lat, enfoque?.lng]);

  return <div ref={caja} className="size-full" data-mapa />;
}
