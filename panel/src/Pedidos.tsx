import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type GeoPoint } from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { db } from "../../compartido/firebase";
import { NOMBRE } from "../../compartido/marca";
import { ESTADOS, linkDelPedido, TIPOS, type Estado, type Pedido } from "../../compartido/pedido";
import { Cartel } from "./App";
import { activarAvisos, estadoAvisos, sonar } from "./avisos";
import { celularLindo, hoy, type Motoquero } from "./Motoqueros";

type ConId = Pedido & { id: string };
// Primero lo que espera una acción tuya; dentro de cada grupo, lo más nuevo arriba.
const ORDEN: Record<Estado, number> = { recibido: 0, asignado: 1, en_camino: 1, entregado: 2, cancelado: 2 };
const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;
const raiz = () => new URL("../", location.href).href; // la pantalla del cliente está un nivel arriba del panel
const mapa = (p: GeoPoint) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.latitude},${p.longitude}`)}`;
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

export default function Pedidos({ motoqueros }: { motoqueros: Motoquero[] }) {
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
  }, [esperando]);

  if (error) return <Cartel error={error} />;
  if (!pedidos) return <p className="text-suave">Cargando pedidos…</p>;
  const ordenados = [...pedidos].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);

  return (
    <section data-cargado>
      {!avisos.sonido ? (
        <div className="mb-4 rounded-2xl bg-tinta p-4 text-white">
          <button
            type="button"
            onClick={() => activarAvisos(() => setAvisos(estadoAvisos()))}
            className="w-full rounded-xl bg-acento py-3.5 text-lg font-semibold"
          >
            Activar avisos
          </button>
          <p className="mt-2 text-sm">Dejá el panel abierto: con el celular bloqueado no suena.</p>
        </div>
      ) : (
        !avisos.pantalla && <p className="mb-4 text-sm text-suave">Avisos activos. La pantalla se puede apagar sola: dejala prendida.</p>
      )}
      <ul className="space-y-3">
        {ordenados.map((p) => (
          <Tarjeta key={p.id} pedido={p} nuevo={nuevos.has(p.id) && p.estado === "recibido"} motoqueros={motoqueros} />
        ))}
        {!ordenados.length && <p className="text-suave">Todavía no hay pedidos.</p>}
      </ul>
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
  const hora = p.creado?.toDate().toLocaleString("es-AR", { timeZone: "America/Argentina/San_Luis", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

  const guardar = (campos: object) =>
    updateDoc(ref, { ...campos, actualizado: serverTimestamp() }).then(
      () => setAviso(""),
      () => setAviso("No se pudo guardar. Revisá la conexión y probá de nuevo."),
    );

  return (
    <li className={`rounded-2xl border bg-white p-4 ${nuevo ? "border-acento" : "border-linea"}`} data-id={p.id} data-estado={p.estado} data-nuevo={nuevo || undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {nuevo && <span className="mr-2 rounded-full bg-acento px-2 py-0.5 text-xs font-bold text-white uppercase">Nuevo</span>}
          {TIPOS[p.tipo]} <span className="font-normal text-suave">· {hora}</span>
        </p>
        <span className="text-sm font-semibold">{ESTADOS[p.estado]}</span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <Dato nombre="Retiro" valor={p.origen.referencia ?? "Punto en el mapa"} punto={p.origen.punto} />
        <Dato nombre="Entrega" valor={p.destino.referencia ?? "Punto en el mapa"} punto={p.destino.punto} />
        <div>
          <dt className="text-suave">Cliente</dt>
          <dd className="break-words">
            {p.nombre} ·{" "}
            <a href={`https://wa.me/${p.telefono}`} className="text-acento underline">
              {celularLindo(p.telefono)}
            </a>
          </dd>
        </div>
        {p.nota && <Dato nombre="Nota" valor={p.nota} />}
        <Dato nombre="Precio" valor={p.precio !== undefined ? pesos(p.precio) : p.precioEstimado !== null ? `${pesos(p.precioEstimado)} (estimado)` : "A confirmar"} />
        {p.motoquero && <Dato nombre="Motoquero" valor={p.motoquero.nombre} />}
        {p.motivo && <Dato nombre="Motivo" valor={p.motivo} />}
      </dl>

      {aviso && <p className="mt-3 text-sm text-acento">{aviso}</p>}

      {abierto && (p.estado === "recibido" || asignando) && (
        <Asignar pedido={p} motoqueros={motoqueros} alGuardar={(campos) => guardar({ estado: "asignado", ...campos }).then(() => setAsignando(false))} />
      )}

      {abierto && p.estado !== "recibido" && !asignando && (
        <div className="mt-4 space-y-2">
          {moto && (
            <a
              href={`https://wa.me/${moto.telefono}?text=${encodeURIComponent(mensajeParaMotoquero(p))}`}
              className="block w-full rounded-xl bg-acento py-3 text-center font-semibold text-white"
              data-whatsapp-motoquero
            >
              Mandar por WhatsApp a {moto.nombre}
            </a>
          )}
          <div className="flex gap-2">
            {p.estado === "asignado" && <Boton onClick={() => guardar({ estado: "en_camino" })}>En camino</Boton>}
            {p.estado === "en_camino" && <Boton onClick={() => guardar({ estado: "entregado" })}>Entregado</Boton>}
            <Boton onClick={() => setAsignando(true)} suave>
              Cambiar motoquero o precio
            </Boton>
          </div>
        </div>
      )}

      {abierto &&
        (cancelando ? (
          <Cancelar alCancelar={(motivo) => guardar({ estado: "cancelado", motivo })} alVolver={() => setCancelando(false)} />
        ) : (
          <button type="button" onClick={() => setCancelando(true)} className="mt-3 text-sm text-suave underline">
            Cancelar pedido
          </button>
        ))}
    </li>
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

  if (!activos.length) return <p className="mt-4 text-sm text-acento">No hay motoqueros activos hoy. Activalos en Motoqueros.</p>;
  return (
    <form onSubmit={guardar} className="mt-4 space-y-2">
      <select value={motoId} onChange={(e) => setMotoId(e.target.value)} aria-label="Quién lo lleva" className="w-full rounded-xl border border-linea bg-white px-4 py-3 text-base">
        <option value="">¿Quién lo lleva?</option>
        {activos.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          inputMode="numeric"
          aria-label="Precio en pesos"
          placeholder="Precio"
          className="min-w-0 flex-1 rounded-xl border border-linea bg-white px-4 py-3 text-base"
        />
        <button type="submit" className="rounded-xl bg-acento px-5 font-semibold text-white">
          Asignar
        </button>
      </div>
      {aviso && <p className="text-sm text-acento">{aviso}</p>}
    </form>
  );
}

function Cancelar({ alCancelar, alVolver }: { alCancelar: (motivo: string) => void; alVolver: () => void }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={200}
        aria-label="Motivo de la cancelación"
        placeholder="Motivo (lo ve el cliente)"
        className="w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
      />
      <div className="flex gap-2">
        <Boton onClick={() => motivo.trim().length >= 2 && alCancelar(motivo.trim())}>Confirmar cancelación</Boton>
        <Boton onClick={alVolver} suave>
          Volver
        </Boton>
      </div>
    </div>
  );
}

function Boton({ onClick, suave, children }: { onClick: () => void; suave?: boolean; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex-1 rounded-xl py-3 font-semibold ${suave ? "border border-linea" : "bg-tinta text-white"}`}>
      {children}
    </button>
  );
}

function Dato({ nombre, valor, punto }: { nombre: string; valor: string; punto?: GeoPoint | null }) {
  return (
    <div>
      <dt className="text-suave">{nombre}</dt>
      <dd className="break-words">
        {valor}
        {punto && (
          <>
            {" · "}
            <a href={mapa(punto)} target="_blank" rel="noreferrer" className="text-acento underline">
              Ver en el mapa
            </a>
          </>
        )}
      </dd>
    </div>
  );
}
