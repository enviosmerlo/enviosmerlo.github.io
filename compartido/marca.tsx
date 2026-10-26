// Nombre y logo de trabajo: se reemplazan en la actualización de marca, acá y en ningún otro lado.
export const NOMBRE = "Envíos Merlo";

// Sello: las sierras al atardecer y el camino de tierra que sube en curvas.
export function Sello({ className = "size-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} role="img" aria-label={NOMBRE}>
      <clipPath id="sello-borde">
        <rect width="40" height="40" rx="11" />
      </clipPath>
      <g clipPath="url(#sello-borde)">
        <rect width="40" height="40" fill="#A8472A" />
        <circle cx="28.5" cy="13" r="5.2" fill="#E9B04A" />
        <path d="M-1 26 L5.5 21.6 Q7.5 20.4 9.4 21.3 L10.6 21.9 L18.3 12.4 Q19.8 10.7 21.4 12.3 L27.4 18.6 Q28.8 19.9 30.4 19.2 L32.3 18.5 Q33.6 18 34.8 18.8 L41 23 V41 H-1Z" fill="#FBF1DE" />
        <path d="M5 41 C10 36.5 20.5 35.5 19.6 30.5 C19 27.6 16.8 26.4 19.4 22.6 L20.2 22.9 C18.6 26.4 21.6 27.8 22.2 30.6 C23.2 36 17.5 38.8 15.5 41Z" fill="#A8472A" />
      </g>
    </svg>
  );
}

// Logo completo: sello + "Envíos Merlo", con "Merlo" en itálica. `claro` para fondos oscuros (encabezado del panel).
export function Marca({ tamaño = "text-[25px]", sello = "size-11", claro = false }: { tamaño?: string; sello?: string; claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Sello className={sello} />
      <span className={`font-display leading-none font-extrabold tracking-[-0.01em] ${tamaño} ${claro ? "text-papel" : "text-tinta"}`}>
        Envíos <em className={claro ? "text-[#F2C46B]" : "text-terra-osc"}>Merlo</em>
      </span>
    </span>
  );
}
