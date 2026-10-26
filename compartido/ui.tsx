import type { CSSProperties, ReactNode } from "react";
import type { Estado, Tipo } from "./pedido";

// Medidas comunes del cliente y el panel.
export const FOCO = "outline-offset-2 focus-visible:outline-3 focus-visible:outline-terra-osc";
// En los campos el foco es un borde terracota pegado, sin el aro separado de los botones.
export const FOCO_CAMPO = "outline-offset-0 focus-visible:border-terra-osc focus-visible:outline-2 focus-visible:outline-terra-osc";
// En la computadora, una columna de celular centrada sobre el fondo arena, con el borde de un teléfono.
export const COLUMNA =
  "mx-auto w-full max-w-[430px] md:my-6 md:overflow-hidden md:rounded-[32px] md:shadow-[0_0_0_1px_rgba(43,33,24,.14),0_10px_22px_-14px_rgba(43,33,24,.45)]";
export const ALTO = "min-h-svh md:min-h-[calc(100svh-3rem)]";

// Íconos propios del diseño Sierra, dibujados a mano (sin librerías). Los de interfaz son de 24 y de una línea;
// los de los tipos de envío son de 48, con trazo más grueso y un relleno de color en `--tono`.
const INTERFAZ = {
  pin: (<g className="ico"><path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.4" /></g>),
  mira: (<><g className="ico"><circle cx="12" cy="12" r="6.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></g><circle cx="12" cy="12" r="2.2" fill="currentColor" /></>),
  atras: (<g className="ico"><path d="M14.5 5.5 8 12l6.5 6.5" /></g>),
  siguiente: (<g className="ico"><path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5" /></g>),
  tilde: (<g className="ico" style={{ strokeWidth: 2.4 }}><path d="M5.5 12.5 10 17l8.5-9.5" /></g>),
  reloj: (<g className="ico"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>),
  persona: (<g className="ico"><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.8 3.6-5.6 7-5.6s6.2 1.8 7 5.6" /></g>),
  moto: (<g className="ico"><circle cx="5.5" cy="17.3" r="2.7" /><circle cx="18.6" cy="17.3" r="2.7" /><rect x="2.4" y="6.6" width="6.4" height="5.6" rx="1" /><path d="M8.2 17.3h4.6l2.6-5.4" /><path d="M8.8 12.2h7M5.6 12.2v2.4" /><path d="M14.6 5.6h2.6M15.9 5.6l2.7 11.7" /></g>),
  whatsapp: (<><g className="ico"><path d="M4.2 20l1.3-4A8.3 8.3 0 1 1 8.6 19z" /></g><path d="M9.6 8.2c.4-.3 1-.3 1.2.2l.7 1.5c.2.4 0 .8-.3 1l-.4.4c.5 1 1.3 1.8 2.3 2.3l.4-.4c.3-.3.7-.4 1-.3l1.5.7c.5.2.5.8.2 1.2-.6.8-1.6 1.1-2.6.7-2.2-.8-3.9-2.5-4.7-4.7-.4-1 0-2 .7-2.6z" fill="currentColor" /></>),
  copiar: (<g className="ico"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M15.5 8.5V6.2c0-.9-.8-1.7-1.7-1.7H6.2c-.9 0-1.7.8-1.7 1.7v7.6c0 .9.8 1.7 1.7 1.7h2.3" /></g>),
  compartir: (<g className="ico"><path d="M12 14.5V4M7.8 8.2 12 4l4.2 4.2" /><path d="M6.5 11.5H6c-.8 0-1.5.7-1.5 1.5v5.5c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5V13c0-.8-.7-1.5-1.5-1.5h-.5" /></g>),
  campana: (<g className="ico"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.8a2.3 2.3 0 0 0 4 0" /></g>),
  abajo: (<g className="ico"><path d="M6.5 9.5 12 15l5.5-5.5" /></g>),
  derecha: (<g className="ico"><path d="M9.5 5.5 16 12l-6.5 6.5" /></g>),
  mapa: (<g className="ico"><path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></g>),
  nota: (<g className="ico"><path d="M5.5 4.5h9l4 4v11h-13z" /><path d="M14.5 4.5v4h4M8.5 12.5h7M8.5 16h4.5" /></g>),
  mover: (<g className="ico"><path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></g>),
  cruz: (<g className="ico" style={{ strokeWidth: 2.2 }}><path d="M7 7l10 10M17 7 7 17" /></g>),
};
export type NombreIcono = keyof typeof INTERFAZ;
// Cada estado con su ícono, en el seguimiento y en el panel.
export const ICONO_ESTADO: Record<Estado, NombreIcono> = { recibido: "reloj", asignado: "persona", en_camino: "moto", entregado: "tilde", cancelado: "cruz" };

export function Icono({ nombre, className = "size-5" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden="true">
      {INTERFAZ[nombre]}
    </svg>
  );
}

// Etiqueta en negrita y campo con el ícono adentro; con `error`, el borde y el aviso en rojo.
export function Campo({ etiqueta, icono, error, children }: { etiqueta: string; icono: NombreIcono; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[16px] font-bold">{etiqueta}</span>
      <span className={`relative mt-1.5 block ${error ? "[&>input]:border-rojo" : ""}`}>
        <Icono nombre={icono} className="pointer-events-none absolute top-[15px] left-3.5 size-[22px] text-tierra" />
        {children}
      </span>
      {error && <span className="mt-1.5 block text-[15px] leading-snug font-medium text-rojo">{error}</span>}
    </label>
  );
}

// Las letras de retiro (A, terracota) y entrega (B, verde), como en el mapa.
export function Letra({ letra, className }: { letra: "A" | "B"; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center rounded-full font-extrabold text-[#FFF8EE] ${letra === "A" ? "bg-terra" : "bg-monte"} ${className}`}
    >
      {letra}
    </span>
  );
}

// Cada tipo de envío con su color (fondo, trazo y relleno del ícono). Comida es una empanada con su repulgue.
const EMPANADA = "M7 35Q4.1 31.5 8 29.2Q6.5 24.9 11 24.1Q11 19.5 15.5 20.3Q17.1 16 21 18.3Q24 14.8 27 18.3Q30.9 16 32.5 20.3Q37 19.5 37 24.1Q41.5 24.9 40 29.2Q43.9 31.5 41 35C37 37.6 11 37.6 7 35Z";
export const TIPO_ESTILO: Record<Tipo, { fondo: string; trazo: string; texto: string; tono: string; dibujo: ReactNode }> = {
  paquete: {
    fondo: "bg-terra-cl", trazo: "text-terra-osc", texto: "text-[#5E3A26]", tono: "#E9B79C",
    dibujo: (<><path className="tono" d="M7.5 13.5 24 21.5v21L7.5 33.5z" transform="translate(2.5 1.5)" /><g className="ico-g"><path d="M24 5.5 40.5 13.5v20L24 42.5 7.5 33.5v-20z" /><path d="M7.5 13.5 24 21.5l16.5-8M24 21.5v21" /><path d="M15.8 9.5 32.2 17.5v7" /></g></>),
  },
  compras: {
    fondo: "bg-monte-cl", trazo: "text-monte-osc", texto: "text-[#3B4A33]", tono: "#B9CDA6",
    dibujo: (<><path className="tono" d="M10 19.5h28l-2.5 23h-23z" transform="translate(2.5 1.5)" /><g className="ico-g"><path d="M10 19.5h28l-2.5 23h-23z" /><path d="M15.5 19.5 25.2 6.4a2.6 2.6 0 0 1 4.2 3.1L21.8 19.5" /><path d="M23.3 11.6l2.2 1.6M20.6 15.2l2.2 1.6" /><path d="M30 19.5c-.8-5 1.6-9 6.8-10.3.5 4.6-1.7 8.6-5.2 10.3M30.8 19 34 12.6" /><path d="M17.5 28h13" /></g></>),
  },
  documentos: {
    fondo: "bg-piedra-cl", trazo: "text-piedra", texto: "text-piedra", tono: "#B6C7CD",
    dibujo: (<><path className="tono" d="M12.5 5.5h16l8 8v29h-24z" transform="translate(2.5 1.5)" /><g className="ico-g"><path d="M12.5 5.5h16l8 8v29h-24z" /><path d="M28.5 5.5v8h8M18 22h12.5M18 28h12.5" /><path d="M18 35.5c1.5-2.6 3-2.6 3.6 0s2.2 2.6 3.6 0 2.2-2.6 3.6 0" /></g></>),
  },
  comida: {
    fondo: "bg-ocre-cl", trazo: "text-ocre-osc", texto: "text-[#5C4513]", tono: "#EBC573",
    dibujo: (<><path className="tono" d={EMPANADA} transform="translate(2.5 1.5)" /><g className="ico-g"><path d={EMPANADA} /><path d="M12 34.4a12 12 0 0 1 24 0" /><path d="M19.5 11.5c-1.6-1.6 1.6-2.6 0-4.6M28.5 11.5c-1.6-1.6 1.6-2.6 0-4.6" /></g></>),
  },
};

export function IconoTipo({ tipo, className = "size-14" }: { tipo: Tipo; className?: string }) {
  const e = TIPO_ESTILO[tipo];
  return (
    <svg viewBox="0 0 48 48" className={`shrink-0 ${e.trazo} ${className}`} style={{ "--tono": e.tono } as CSSProperties} aria-hidden="true">
      {e.dibujo}
    </svg>
  );
}

// Las sierras del encabezado, en tres planos: el de adelante se funde con el fondo de abajo.
export function Sierras({ lejos, medio, cerca, className = "h-24 w-full" }: { lejos: string; medio: string; cerca: string; className?: string }) {
  return (
    <svg viewBox="0 0 390 96" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M0 44 L26 33 Q31 31 36 32.5 L52 36 L86 19 Q92 16 98 19 L114 27 L146 8 Q152 4.6 158 8 L190 27 Q195 30 200 28 L232 15 Q238 12.6 244 15.6 L268 28 Q273 30.6 278 29 L312 18 Q318 16 323 19 L352 33 Q357 35 362 33.6 L390 26 V96 H0Z" fill={lejos} />
      <path d="M0 64 C30 60 46 46 72 46 C98 46 110 58 136 57 C164 56 182 40 214 40 C246 40 262 56 292 55 C320 54 340 44 390 48 V96 H0Z" fill={medio} />
      <path d="M0 86 C60 76 120 80 190 78 C260 76 320 70 390 74 V96 H0Z" fill={cerca} />
    </svg>
  );
}
