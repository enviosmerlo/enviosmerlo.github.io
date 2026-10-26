import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type GeoPoint } from "firebase/firestore";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { db } from "../../compartido/firebase";
import { NOMBRE } from "../../compartido/marca";
import { ESTADOS, linkDelPedido, TIPOS, type Estado, type Pedido } from "../../compartido/pedido";
import { Icono, IconoTipo, type NombreIcono } from "../../compartido/ui";
import { Cartel } from "./App";
import { activarAvisos, estadoAvisos, sonar } from "./avisos";
import { celularLindo, hoy, type Motoquero } from "./Motoqueros";
import { FOCO, FOCO_CAMPO, PRINCIPAL } from "./ui";

type ConId = Pedido & { id: string };
// Primero lo que espera una acción tuya; dentro de cada grupo, lo más nuevo arriba.
const ORDEN: Record<Estado, number> = { recibido: 0, asignado: 1, en_camino: 1, entregado: 2, cancelado: 2 };
const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
const raiz = () => new URL("../", location.href).href; // la pantalla del cliente está un nivel arriba del panel
const mapa = (p: GeoPoint) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.latitude},${p.longitude}`)}`;
// Cada estado con color + ícono + texto: nunca solo el color.
const ESTILO: Record<Estado, { chip: string; icono: NombreIcono }> = {
  recibido: { chip: "bg-ocre-cl text-ocre-osc", icono: "reloj" },
  asignado: { chip: "bg-piedra-cl text-piedra", icono: "persona" },
  en_camino: { chip: "bg-terra-cl text-terra-osc", icono: "moto" },
  entregado: { chip: "bg-monte-cl text-monte-osc", icono: "tilde" },
  cancelado: { chip: "bg-rojo-cl text-rojo", icono: "cruz" },
};
const LINK = `flex min-h-6 w-max max-w-full items-center gap-1 font-bold text-terra-osc underline underline-offset-2 ${FOCO}`;
// Sin relleno a los costados (como en la maqueta): así "Cambiar motoquero o precio" entra en una línea.
const SUAVE = "flex-1 border-[1.5px] border-linea-osc bg-papel px-2";
const CAJA_CAMPO = `h-11 w-full rounded-[11px] border-[1.5px] border-linea-osc bg-papel text-[16px] placeholder:text-[#76634F] ${FOCO_CAMPO}`;
const lugar = (l: Pedido["origen"]) => [l.referencia ?? "Punto en el mapa", l.punto && mapa(l.punto)].filter(Boolean).join("\n");

// Lo que le llega al motoquero por WhatsApp: todo lo que necesita para salir sin preguntar.
function mensajeParaMotoquero(p: ConId) {
  return [
    `Envío de ${NOMBRE}: ${TIPOS[p.tipo]}`,
    `Retiro: ${lugar(p.origen)}`,
    `Entrega: ${lugar(p.destino)}`,
    `Cliente: ${p.nombre} · https://wa.me/${p.telefono}`,
    p.nota && `Nota: ${p.nota}`,
    p.precio !== undefined && `Precio: ${pesos(p.precio)}`,
    `Seguimiento: ${linkDelPedido(p.id, raiz())}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function Pedidos({ motoqueros, alContar }: { motoqueros: Motoquero[]; alContar: (n: number) => void }) {
  const [pedidos, setPedidos] = useState<ConId[] | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ code?: string } | null>(null);
  const [avisos, setAvisos] = useState(estadoAvisos);

  useEffect(() => {
    let primeraCarga = true;
    return onSnapshot(
      query(collection(db, "pedidos"), orderBy("creado", "desc"), limit(50)),
      (snap) => {
        // Lo que entra después de la carga inicial es un pedido nuevo: suena.
        const llegados = primeraCarga ? [] : snap.docChanges().filter((c) => c.type === "added").map((c) => c.doc.id);
        primeraCarga = false;
        if (llegados.length) {
          setNuevos((n) => new Set([...n, ...llegados]));
          sonar();
        }
        setPedidos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Pedido) })));
      },
      setError,
    );
  }, []);

  // El sonido y la pantalla prendida se pierden al bloquear o salir de la pestaña: al volver se revisa.
  useEffect(() => {
    const revisar = () => setAvisos(estadoAvisos());
    document.addEventListener("visibilitychange", revisar);
    return () => document.removeEventListener("visibilitychange", revisar);
  }, []);

  const esperando = pedidos?.filter((p) => p.estado === "recibido").length ?? 0;
  useEffect(() => {
    document.title = `${esperando ? `(${esperando}) ` : ""}Panel · ${NOMBRE}`;
    alContar(esperando);
  }, [esperando, alContar]);

  if (error) return <Cartel error={error} />;
  if (!pedidos) return <p className="mt-4 text-[16px] text-tierra">Cargando pedidos…</p>;
  const ordenados = [...pedidos].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);

  return (
    <section data-cargado>
      {!avisos.sonido ? (
        <div className="mt-3 rounded-[18px] border-2 border-ocre bg-ocre-cl p-3">
          <button type="button" onClick={() => activarAvisos(() => setAvisos(estadoAvisos()))} className={PRINCIPAL}>
            <Icono nombre="campana" className="size-[22px]" />
            Activar avisos
          </button>
          <p className="mt-2 px-1 text-[15px] leading-snug text-[#5C4513]">Dejá el panel abierto: con el celular bloqueado no suena.</p>
        </div>
      ) : (
        <p className="mt-2.5 flex items-start gap-1.5 text-[13.5px] leading-snug text-tierra">
          <Icono nombre="campana" className="mt-px size-4 text-monte" />
          {avisos.pantalla ? "Avisos activos." : "Avisos activos. La pantalla se puede apagar sola: dejala prendida."}
        </p>
      )}
      {ordenados.length ? (
        <ul className="mt-2 space-y-2">
          {ordenados.map((p) => (
            <Tarjeta key={p.id} pedido={p} nuevo={nuevos.has(p.id) && p.estado === "recibido"} motoqueros={motoqueros} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center text-[16px] text-tierra">Todavía no hay pedidos.</p>
      )}
    </section>
  );
}

function Tarjeta({ pedido: p, nuevo, motoqueros }: { pedido: ConId; nuevo: boolean; motoqueros: Motoquero[] }) {
  const [asignando, setAsignando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState("");
  const ref = doc(db, "pedidos", p.id);
  const abierto = p.estado !== "entregado" && p.estado !== "cancelado";
  const moto = motoqueros.find((m) => m.id === p.motoquero?.id);
  const hora = p.creado?.toDate().toLocaleString("es-AR", { timeZone: "America/Argentina/San_Luis", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const origen = p.origen.referencia ?? "Punto en el mapa";
  const destino = p.destino.referencia ?? "Punto en el mapa";

  const guardar = (campos: object) =>
    updateDoc(ref, { ...campos, actualizado: serverTimestamp() }).then(
      () => setAviso(""),
      () => setAviso("No se pudo guardar. Revisá la conexión y probá de nuevo."),
    );

  // Lo que espera una acción tuya (o lo que estás cambiando) va completo; lo demás, compacto.
  const completo = abierto && (p.estado === "recibido" || asignando);
  const ver = (punto: GeoPoint | null) =>
    punto && (
      <a href={mapa(punto)} target="_blank" rel="noreferrer" className={`mt-0.5 ${LINK}`}>
        <Icono nombre="mapa" className="size-4" />
        Ver en el mapa
      </a>
    );
  const datos = (
    <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5 text-[15px] leading-snug">
      <dt className="flex gap-2 text-tierra">
        <Letra letra="A" />
        Retiro
      </dt>
      <dd className="min-w-0 font-bold break-words">
        {origen}
        {ver(p.origen.punto)}
      </dd>
      <dt className="flex gap-2 text-tierra">
        <Letra letra="B" />
        Entrega
      </dt>
      <dd className="min-w-0 font-bold break-words">
        {destino}
        {ver(p.destino.punto)}
      </dd>
      <dt className="flex gap-2 text-tierra">
        <Icono nombre="persona" className="mt-px size-5" />
        Cliente
      </dt>
      <dd className="min-w-0 font-bold break-words">
        {p.nombre}
        <a href={`https://wa.me/${p.telefono}`} className={`num mt-0.5 ${LINK}`}>
          <Icono nombre="whatsapp" className="size-4" />
          {celularLindo(p.telefono)}
        </a>
      </dd>
      {p.nota && (
        <>
          <dt className="flex gap-2 text-tierra">
            <Icono nombre="nota" className="mt-px size-5" />
            Nota
          </dt>
          <dd className="min-w-0 break-words italic">{p.nota}</dd>
        </>
      )}
    </dl>
  );
  const error = aviso && (
    <p className="mt-2 text-[15px] leading-snug font-medium text-rojo" role="alert">
      {aviso}
    </p>
  );
  const cancelar =
    abierto &&
    (cancelando ? (
      <Cancelar alCancelar={(motivo) => guardar({ estado: "cancelado", motivo })} alVolver={() => setCancelando(false)} />
    ) : (
      <button
        type="button"
        onClick={() => setCancelando(true)}
        className={`-mb-1 h-11 text-[14px] text-tierra underline underline-offset-2 ${FOCO}`}
      >
        Cancelar pedido
      </button>
    ));
  const atributos = { "data-id": p.id, "data-estado": p.estado, "data-nuevo": nuevo || undefined };

  if (completo)
    return (
      <li className={`overflow-hidden rounded-[18px] bg-papel ${nuevo ? "border-2 border-ocre" : "border border-linea"}`} {...atributos}>
        {nuevo && (
          <div className="flex items-center justify-between gap-2 bg-ocre-cl px-3.5 py-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-ocre px-2.5 py-0.5 text-[12.5px] font-extrabold tracking-[0.1em] text-tinta uppercase">
              <Icono nombre="campana" className="size-3.5" />
              Nuevo
            </span>
            <span className="flex items-center gap-1 text-[14px] font-bold text-ocre-osc">
              <Icono nombre="reloj" className="size-4" />
              {ESTADOS[p.estado]}
            </span>
          </div>
        )}
        <div className="px-3.5 pt-2.5 pb-1">
          <Cabeza pedido={p} hora={hora} grande chip={!nuevo} />
          <div className="mt-2.5">{datos}</div>
          {error}
          <Asignar
            pedido={p}
            motoqueros={motoqueros}
            alGuardar={(campos) => guardar({ estado: "asignado", ...campos }).then(() => setAsignando(false))}
          />
          {cancelar}
        </div>
      </li>
    );

  return (
    <li className={`rounded-[18px] border border-linea px-3.5 pt-2.5 ${abierto ? "bg-papel pb-3" : "pb-1.5"}`} {...atributos}>
      <Cabeza pedido={p} hora={hora} chip />
      {/* El resumen se toca para ver todo: dirección, mapa, cliente y nota. */}
      <details className="group">
        <summary
          className={`-mx-1 mt-0.5 flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-[10px] px-1 py-1.5 text-[15px] leading-snug [&::-webkit-details-marker]:hidden ${FOCO}`}
        >
          <span className="min-w-0 flex-1 break-words">
            {p.motoquero && (
              <>
                <span className="text-tierra">Lleva</span> <b className="font-bold">{p.motoquero.nombre}</b> ·{" "}
              </>
            )}
            {p.precio !== undefined && <span className="num">{pesos(p.precio)} · </span>}
            <span className="text-tierra">
              {origen} → {destino}
            </span>
          </span>
          <Icono nombre="abajo" className="mt-px size-5 text-tierra group-open:rotate-180" />
        </summary>
        <div className="pt-1 pb-1.5">
          {datos}
          {cancelar}
        </div>
      </details>
      {p.motivo && (
        <p className="text-[15px] leading-snug break-words">
          <span className="text-tierra">Motivo:</span> {p.motivo}
        </p>
      )}
      {error}

      {abierto && (
        <>
          {moto && (
            <a
              href={`https://wa.me/${moto.telefono}?text=${encodeURIComponent(mensajeParaMotoquero(p))}`}
              className={
                p.estado === "asignado"
                  ? `mt-1 flex min-h-11 items-center justify-center gap-2 rounded-[11px] bg-monte px-3 text-center text-[16px] leading-tight font-bold text-[#FFF8EE] ${FOCO}`
                  : `mb-1 text-[15px] ${LINK}`
              }
              data-whatsapp-motoquero
            >
              <Icono nombre="whatsapp" className={p.estado === "asignado" ? "size-5" : "size-4"} />
              Mandar por WhatsApp a {moto.nombre}
            </a>
          )}
          <div className="mt-2 flex gap-2">
            {p.estado === "asignado" && (
              <Boton onClick={() => guardar({ estado: "en_camino" })} clase="bg-terra px-4 text-[#FFF8EE]" icono="moto">
                En camino
              </Boton>
            )}
            {p.estado === "en_camino" && (
              <Boton onClick={() => guardar({ estado: "entregado" })} clase="bg-monte px-4 text-[#FFF8EE]" icono="tilde">
                Entregado
              </Boton>
            )}
            <Boton onClick={() => setAsignando(true)} clase={SUAVE}>
              Cambiar motoquero o precio
            </Boton>
          </div>
        </>
      )}
    </li>
  );
}

// Tipo con su ícono y la hora; el chip del estado a la derecha (el pedido nuevo lo lleva en la banda).
function Cabeza({ pedido: p, hora, grande, chip }: { pedido: ConId; hora?: string; grande?: boolean; chip?: boolean }) {
  const e = ESTILO[p.estado];
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2">
        <IconoTipo tipo={p.tipo} className={grande ? "size-7" : "size-6"} />
        <span className={`font-extrabold ${grande ? "text-[19px]" : "text-[17px]"}`}>{TIPOS[p.tipo]}</span>
        <span className={`num text-tierra ${grande ? "text-[16px]" : "text-[15px]"}`}>· {hora}</span>
      </p>
      {chip && (
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[13.5px] font-bold ${e.chip}`}>
          <Icono nombre={e.icono} className="size-4" />
          {ESTADOS[p.estado]}
        </span>
      )}
    </div>
  );
}

function Letra({ letra }: { letra: "A" | "B" }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-[#FFF8EE] ${letra === "A" ? "bg-terra" : "bg-monte"}`}
    >
      {letra}
    </span>
  );
}

function Asignar({ pedido, motoqueros, alGuardar }: { pedido: ConId; motoqueros: Motoquero[]; alGuardar: (c: object) => Promise<unknown> }) {
  const activos = motoqueros.filter((m) => !m.baja && m.activoEl === hoy());
  const [motoId, setMotoId] = useState(pedido.motoquero?.id ?? "");
  const [precio, setPrecio] = useState(String(pedido.precio ?? pedido.precioEstimado ?? ""));
  const [aviso, setAviso] = useState("");

  function guardar(e: FormEvent) {
    e.preventDefault();
    const moto = activos.find((m) => m.id === motoId);
    const pesos = Number(precio.replace(/\D/g, ""));
    if (!moto) return setAviso("Elegí quién lo lleva.");
    if (!precio.trim() || !Number.isInteger(pesos)) return setAviso("Poné el precio en pesos.");
    alGuardar({ motoquero: { id: moto.id, nombre: moto.nombre }, precio: pesos });
  }

  return (
    <div className="mt-2.5 rounded-[14px] bg-arena p-2.5">
      <p className="flex items-baseline justify-between gap-3 px-1">
        <span className="text-[14px] font-bold text-tierra">Precio estimado</span>
        {pedido.precioEstimado !== null ? (
          <span className="num font-display text-[22px] leading-tight font-extrabold">{pesos(pedido.precioEstimado)}</span>
        ) : (
          <span className="text-[16px] font-bold">A confirmar</span>
        )}
      </p>
      {!activos.length ? (
        <p className="mt-1 flex gap-1.5 px-1 pb-0.5 text-[15px] leading-snug font-bold text-ocre-osc">
          <Icono nombre="persona" className="mt-px size-[18px]" />
          No hay motoqueros activos hoy. Activalos en Motoqueros.
        </p>
      ) : (
        <form onSubmit={guardar}>
          <span className="relative mt-1.5 block">
            <select value={motoId} onChange={(e) => setMotoId(e.target.value)} aria-label="Quién lo lleva" className={`appearance-none pr-10 pl-3 ${CAJA_CAMPO}`}>
              <option value="">¿Quién lo lleva?</option>
              {activos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            <Icono nombre="abajo" className="pointer-events-none absolute top-3 right-3 size-5 text-tierra" />
          </span>
          <div className="mt-2 flex gap-2">
            <span className="relative min-w-0 flex-1">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[17px] text-tierra">
                $
              </span>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                inputMode="numeric"
                aria-label="Precio en pesos"
                placeholder="Precio"
                className={`num pr-3 pl-7 text-[17px] ${CAJA_CAMPO}`}
              />
            </span>
            <button type="submit" className={`h-11 rounded-[11px] bg-terra px-6 text-[17px] font-bold text-[#FFF8EE] ${FOCO}`}>
              Asignar
            </button>
          </div>
          {aviso && (
            <p className="mt-1.5 px-1 text-[15px] leading-snug font-medium text-rojo" role="alert">
              {aviso}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function Cancelar({ alCancelar, alVolver }: { alCancelar: (motivo: string) => void; alVolver: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="mt-2 mb-2 rounded-[14px] bg-rojo-cl p-2.5">
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        aria-label="Motivo de la cancelación"
        placeholder="Motivo (lo ve el cliente)"
        className={`px-3 ${CAJA_CAMPO}`}
      />
      <div className="mt-2 flex gap-2">
        <Boton onClick={() => motivo.trim().length >= 2 && alCancelar(motivo.trim())} clase="flex-1 bg-rojo px-3 text-[#FFF8EE]" icono="cruz">
          Confirmar cancelación
        </Boton>
        <Boton onClick={alVolver} clase="border-[1.5px] border-linea-osc bg-papel px-5">
          Volver
        </Boton>
      </div>
    </div>
  );
}

function Boton({ onClick, clase, icono, children }: { onClick: () => void; clase: string; icono?: NombreIcono; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] text-[15px] leading-tight font-bold ${FOCO} ${clase}`}
    >
      {icono && <Icono nombre={icono} className="size-4" />}
      {children}
    </button>
  );
}
