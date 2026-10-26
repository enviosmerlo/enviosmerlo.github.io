import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Punto } from "../../compartido/pedido";

// Tiles de OpenStreetMap: gratis y sin garantía. Su política pide la atribución siempre visible y no precargar zonas.
// ponytail: una sola constante, para cambiar de proveedor sin tocar nada más si OSM corta el acceso.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const MERLO: Punto = { lat: -32.342558, lng: -65.0136903 }; // centro de Villa de Merlo, nodo OSM 198403646

// Marcadores dibujados (A terracota, B verde) en vez del pin de Leaflet, que con Vite pierde sus imágenes.
// La letra va como texto (no dentro del dibujo): el control automático busca el marcador por su letra.
// El dibujo no va posicionado: Leaflet les da z-index 200 a los svg del mapa y taparía la letra.
const PIN = "M22 1.5C10.7 1.5 1.5 10.4 1.5 21.6 1.5 36.3 22 56 22 56S42.5 36.3 42.5 21.6C42.5 10.4 33.3 1.5 22 1.5z";
function icono(letra: string, activo: boolean) {
  const e = activo ? 1 : 0.8; // el punto que no se está editando va más chico
  const [ancho, alto] = [44 * e, 60 * e];
  return L.divIcon({
    className: "",
    html: `<div class="relative font-sans" style="width:${ancho}px;height:${alto}px"><svg viewBox="0 0 44 60" class="block size-full" aria-hidden="true"><ellipse cx="22" cy="56.5" rx="9" ry="3.2" fill="#2B2118" fill-opacity=".22"/><path d="${PIN}" fill="${letra === "A" ? "#A8472A" : "#3D5638"}" stroke="#FFFAF2" stroke-width="3"/></svg><span class="absolute inset-x-0 text-center leading-none font-extrabold text-papel" style="top:${11 * e}px;font-size:${20 * e}px">${letra}</span></div>`,
    iconSize: [ancho, alto],
    iconAnchor: [ancho / 2, 56 * e],
  });
}

// Leaflet trae su CSS sin capa y le gana a Tailwind: por eso los "!". Zoom con los colores de la app y debajo del aviso.
const CONTROLES = [
  "[&_.leaflet-top.leaflet-right]:top-10!",
  "[&_.leaflet-bar]:overflow-hidden [&_.leaflet-bar]:rounded-xl! [&_.leaflet-bar]:border-linea! [&_.leaflet-bar]:border!",
  "[&_.leaflet-bar_a]:size-11! [&_.leaflet-bar_a]:bg-papel! [&_.leaflet-bar_a]:leading-11! [&_.leaflet-bar_a]:text-tinta! [&_.leaflet-bar_a]:border-linea! [&_.leaflet-bar]:shadow-none!",
  // La atribución de OSM, siempre visible, como una etiqueta papel en la esquina (como en la maqueta).
  "[&_.leaflet-control-attribution]:rounded-tl-lg [&_.leaflet-control-attribution]:bg-papel/90! [&_.leaflet-control-attribution]:px-2! [&_.leaflet-control-attribution]:py-0.5! [&_.leaflet-control-attribution]:font-sans [&_.leaflet-control-attribution]:text-tierra! [&_.leaflet-control-attribution_a]:text-tierra!",
].join(" ");

type Props = { a: Punto | null; b: Punto | null; editar: "a" | "b"; alMover: (p: Punto) => void };

// El cliente toca el mapa o arrastra su marcador para elegir el punto que está editando.
export default function Mapa({ a, b, editar, alMover }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map>(null);
  const marcadores = useRef<{ a?: L.Marker; b?: L.Marker }>({});
  const mover = useRef(alMover);
  mover.current = alMover;

  useEffect(() => {
    const m = L.map(caja.current!, { center: MERLO, zoom: 15, zoomControl: false });
    L.control.zoom({ position: "topright" }).addTo(m);
    m.attributionControl.setPrefix(false); // sin "Leaflet" ni bandera: queda solo la de OpenStreetMap, que es la obligatoria
    // Un tono cálido solo sobre los tiles: la atribución y los marcadores quedan como están.
    L.tileLayer(TILES, { attribution: ATRIBUCION, maxZoom: 19, className: "sepia-[.3] saturate-[.85]" }).addTo(m);
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

  return <div ref={caja} className={`size-full bg-[#EEE6D6]! ${CONTROLES}`} data-mapa />;
}
