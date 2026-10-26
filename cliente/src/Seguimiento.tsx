import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState, type ReactNode } from "react";
import { db } from "../../compartido/firebase";
import { Marca, NOMBRE } from "../../compartido/marca";
import { ESTADOS, ID_VALIDO, linkDelPedido, TIPOS, type Estado, type Pedido } from "../../compartido/pedido";
import { useServicio } from "../../compartido/servicio";
import { Icono, Sierras, type NombreIcono } from "../../compartido/ui";
import { ALTO, COLUMNA, FOCO, Letra, pesos, precioTexto } from "./Formulario";

const AVANCE: Estado[] = ["recibido", "asignado", "en_camino", "entregado"];
const ICONO: Record<Estado, NombreIcono> = {
  recibido: "reloj",
  asignado: "persona",
  en_camino: "moto",
  entregado: "tilde",
  cancelado: "cruz",
};

// El encabezado toma el color del estado: terracota mientras viaja, verde entregado, rojo cancelado.
type Tono = { fondo: string; rotulo: string; titulo: string; circulo: string; lejos: string; medio: string };
const TERRA: Tono = {
  fondo: "bg-terra-cl",
  rotulo: "text-[#6B3A24]",
  titulo: "text-terra-osc",
  circulo: "bg-terra",
  lejos: "#E7BFA7",
  medio: "#DDAA8E",
};
const TONO: Record<Estado, Tono> = {
  recibido: TERRA,
  asignado: TERRA,
  en_camino: TERRA,
  entregado: {
    fondo: "bg-monte-cl",
    rotulo: "text-monte-osc",
    titulo: "text-monte-osc",
    circulo: "bg-monte",
    lejos: "#C4D3B6",
    medio: "#A9BE98",
  },
  cancelado: { fondo: "bg-rojo-cl", rotulo: "text-rojo", titulo: "text-rojo", circulo: "bg-rojo", lejos: "#EFC6BC", medio: "#E5AFA2" },
};
const BOTON_LINK = `flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-linea-osc bg-papel text-[16px] font-bold ${FOCO}`;

// Pantalla que abre el link del pedido: el estado se actualiza solo cuando el operador lo cambia.
export default function Seguimiento({ id }: { id: string }) {
  const valido = ID_VALIDO.test(id);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [noEsta, setNoEsta] = useState(!valido);
  const [copiado, setCopiado] = useState(false);
  const { whatsapp } = useServicio();
  const link = linkDelPedido(id, location.href);

  useEffect(() => {
    if (!valido) return;
    return onSnapshot(
      doc(db, "pedidos", id),
      // Sin señal llega primero un "no está" del caché vacío: solo cuenta el que confirma el servidor.
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists()) {
          setPedido(snap.data() as Pedido);
          setNoEsta(false);
        } else if (!snap.metadata.fromCache) setNoEsta(true);
      },
      // Un error deja al listener muerto: se muestra lo mismo que un pedido que no existe.
      () => setNoEsta(true),
    );
  }, [id, valido]);

  if (noEsta)
    return (
      <Marco
        cabeza={
          <>
            <h1 className="font-display text-[40px] leading-none font-extrabold tracking-[-0.015em] text-balance text-terra-osc">
              No encontramos ese pedido
            </h1>
            <p className="mt-3 text-[18px]">Revisá que el link esté completo.</p>
          </>
        }
      >
        <a
          href="./"
          className={`flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-terra text-[18px] font-bold text-[#FFF8EE] ${FOCO}`}
        >
          Hacer un pedido
          <Icono nombre="siguiente" />
        </a>
      </Marco>
    );

  if (!pedido)
    return (
      <Marco
        cabeza={
          <p className="text-[18px]" role="status">
            Buscando tu pedido…
          </p>
        }
      />
    );

  const actual = AVANCE.indexOf(pedido.estado);
  const tono = TONO[pedido.estado] ?? TERRA;
  async function copiar() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
  }

  return (
    <Marco
      tono={tono}
      circulo={
        <span className={`mt-1 grid size-16 shrink-0 place-items-center rounded-full text-[#FFF8EE] ${tono.circulo}`}>
          <Icono nombre={ICONO[pedido.estado] ?? "reloj"} className="size-10" />
        </span>
      }
      cabeza={
        <>
          <p className={`text-[14px] font-bold tracking-[0.12em] uppercase ${tono.rotulo}`}>Tu pedido</p>
          <h1
            className={`mt-1 font-display text-[46px] leading-none font-extrabold tracking-[-0.015em] ${tono.titulo}`}
            data-estado={pedido.estado}
          >
            {ESTADOS[pedido.estado] ?? pedido.estado}
          </h1>
          {pedido.estado === "cancelado" && pedido.motivo && <p className="mt-3 text-[18px] leading-snug">{pedido.motivo}</p>}
          {pedido.motoquero && pedido.estado !== "cancelado" && (
            <p className="mt-3 flex items-center gap-2 text-[18px]" data-motoquero>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ocre text-[15px] font-extrabold" aria-hidden="true">
                {pedido.motoquero.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <span>
                Te lo lleva <strong className="font-extrabold">{pedido.motoquero.nombre}</strong>
              </span>
            </p>
          )}
        </>
      }
    >
      {pedido.estado !== "cancelado" && (
        <div className="relative mx-[-12px] mb-5">
          <span className="absolute top-[17px] right-[12.5%] left-[12.5%] border-t-2 border-dashed border-[#C9B79B]" aria-hidden="true" />
          <span
            className="absolute top-4 left-[12.5%] h-1 rounded bg-monte"
            style={{ width: `${Math.max(actual, 0) * 25}%` }}
            aria-hidden="true"
          />
          <ol className="relative grid grid-cols-4" aria-label="Avance del envío">
            {AVANCE.map((e, i) => {
              const hecho = i < actual || pedido.estado === "entregado";
              const ahora = i === actual && !hecho;
              return (
                <li key={e} className="flex flex-col items-center" aria-current={i === actual ? "step" : undefined}>
                  <span
                    className={`grid size-9 place-items-center rounded-full ${
                      hecho
                        ? "bg-monte text-[#FFF8EE]"
                        : ahora
                          ? "bg-terra text-[#FFF8EE] ring-4 ring-terra-cl"
                          : "border-2 border-dashed border-[#B9A78C] bg-arena text-tierra"
                    }`}
                  >
                    <Icono
                      nombre={hecho ? "tilde" : e === "entregado" ? "pin" : ICONO[e]}
                      className={hecho || ahora ? "size-5" : "size-4"}
                    />
                  </span>
                  <span
                    className={`mt-1.5 text-[14px] ${ahora ? "font-extrabold text-terra-osc" : hecho ? "font-bold" : "font-medium text-tierra"}`}
                  >
                    {ESTADOS[e]}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Aviso al servicio: le llega por WhatsApp aunque tenga el celular bloqueado. */}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, hice un pedido: ${link}`)}`}
          className={`mb-3 flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] bg-monte text-[18px] font-bold text-[#FFF8EE] ${FOCO}`}
          data-whatsapp
        >
          <Icono nombre="whatsapp" className="size-6" />
          {pedido.estado === "recibido" ? "Avisar por WhatsApp" : "Escribinos por WhatsApp"}
        </a>
      )}

      <div className="rounded-[16px] bg-papel px-4 py-3">
        <div className="relative pl-9">
          <span className="absolute top-[24px] bottom-[22px] left-[11px] border-l-2 border-dotted border-[#B9A78C]" aria-hidden="true" />
          <p className="relative text-[16px] leading-snug break-words">
            <Letra letra="A" className="absolute top-0 -left-9 size-6 text-[12.5px]" />
            <span className="text-tierra">Desde</span> · <b className="font-bold">{pedido.origen.referencia ?? "Marcado en el mapa"}</b>
          </p>
          <p className="relative mt-2.5 text-[16px] leading-snug break-words">
            <Letra letra="B" className="absolute top-0 -left-9 size-6 text-[12.5px]" />
            <span className="text-tierra">Hasta</span> · <b className="font-bold">{pedido.destino.referencia ?? "Marcado en el mapa"}</b>
          </p>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-dashed border-linea-osc pt-2.5 text-[16px]">
          <p>
            <span className="text-tierra">Qué</span> · <b className="font-bold">{TIPOS[pedido.tipo]}</b>
          </p>
          <p>
            <span className="text-tierra">Precio</span> ·{" "}
            <b className="num font-extrabold">{pedido.precio !== undefined ? pesos(pedido.precio) : precioTexto(pedido.precioEstimado)}</b>
          </p>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="font-display text-[20px] leading-tight font-bold">Guardá este link para volver</h2>
        <p className="mt-0.5 text-[14px] leading-snug text-tierra">
          Quien tenga este link puede ver tu nombre, tu teléfono y los lugares del pedido.
        </p>
        <p
          className="mt-2 rounded-[12px] border-[1.5px] border-dashed border-[#C9B79B] bg-papel px-3 py-2 text-[14.5px] leading-snug break-all select-all"
          data-link
        >
          {link}
        </p>
        <div className="mt-2 flex gap-2">
          {navigator.clipboard && (
            <button type="button" onClick={copiar} className={BOTON_LINK}>
              <Icono nombre={copiado ? "tilde" : "copiar"} />
              {copiado ? "Copiado" : "Copiar link"}
            </button>
          )}
          {"share" in navigator && (
            <button type="button" onClick={() => navigator.share({ title: NOMBRE, url: link }).catch(() => {})} className={BOTON_LINK}>
              <Icono nombre="compartir" />
              Compartir
            </button>
          )}
        </div>
      </section>

      <a
        href="./"
        className={`mx-auto mt-2 block w-max px-2 py-3 text-[16px] font-bold text-terra-osc underline underline-offset-4 ${FOCO}`}
      >
        Hacer otro pedido
      </a>
    </Marco>
  );
}

// Encabezado del color del estado, con la marca y las sierras; debajo, el resto.
function Marco({ tono = TERRA, circulo, cabeza, children }: { tono?: Tono; circulo?: ReactNode; cabeza: ReactNode; children?: ReactNode }) {
  return (
    <main className={`${COLUMNA} ${ALTO} pb-6`}>
      <div className={tono.fondo}>
        <div className="px-5 pt-4">
          <Marca tamaño="text-[19px]" sello="size-7" />
        </div>
        <div className="mt-5 flex items-start justify-between gap-3 px-5">
          <div className="min-w-0">{cabeza}</div>
          {circulo}
        </div>
        <Sierras lejos={tono.lejos} medio={tono.medio} cerca="#F3EBDD" className="mt-1 block h-11 w-full" />
      </div>
      <div className="mt-2 px-5">{children}</div>
    </main>
  );
}
