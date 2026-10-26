import type { ReactNode } from "react";
import { Marca } from "../../compartido/marca";
import { ALTO, COLUMNA, FOCO, FOCO_CAMPO, Sierras } from "../../compartido/ui";

// La columna de celular del cliente (compartido/ui.tsx), con aire abajo.
export const MARCO = `${COLUMNA} ${ALTO} pb-8`;
export const PRINCIPAL = `flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-terra text-[18px] font-bold text-[#FFF8EE] disabled:opacity-40 ${FOCO}`;
export const CAMPO = `h-[52px] w-full rounded-[14px] border-[1.5px] border-linea-osc bg-papel px-4 text-[17px] placeholder:text-[#76634F] ${FOCO_CAMPO}`;
export const ETIQUETA = "text-[16px] font-bold";

// Encabezado verde con la marca clara y las sierras. Con `children` (el login) va más alto, con su título adentro.
export function Encabezado({ salir, children }: { salir?: () => void; children?: ReactNode }) {
  return (
    <header className="bg-monte text-[#FBF1DE]">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h1 className="flex min-w-0 items-center gap-1.5">
          <Marca claro tamaño="text-[21px]" sello="size-8" />
          <span className="text-[21px] leading-none font-medium text-monte-cl">· Panel</span>
        </h1>
        {salir && (
          <button
            type="button"
            onClick={salir}
            className="-mr-2 h-11 px-2 text-[15px] font-medium text-monte-cl underline underline-offset-2 outline-offset-2 focus-visible:outline-3 focus-visible:outline-[#F2C46B]"
          >
            Salir
          </button>
        )}
      </div>
      {children}
      <Sierras lejos="#4C6946" medio="#5E7A53" cerca="#F3EBDD" className={`block w-full ${children ? "mt-3 h-11" : "mt-1 h-[26px]"}`} />
    </header>
  );
}
