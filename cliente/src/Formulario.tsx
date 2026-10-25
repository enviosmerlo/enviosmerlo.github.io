import { addDoc, collection, GeoPoint, serverTimestamp } from "firebase/firestore";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { db } from "../../compartido/firebase";
import { NOMBRE } from "../../compartido/marca";
import { TIPOS, type Lugar, type Punto, type Tipo } from "../../compartido/pedido";
import { precioEstimado } from "../../compartido/precio";
import { normalizarTelefono } from "../../compartido/telefono";
import Mapa from "./Mapa";

const PASOS = 5;
const vacio: Lugar = { punto: null, referencia: "" };
// Las reglas piden la referencia con 2 caracteres o más; más corta no cuenta.
const referencia = (l: Lugar) => (l.referencia.trim().length >= 2 ? l.referencia.trim() : null);
const lugarListo = (l: Lugar) => l.punto !== null || referencia(l) !== null;
const paraGuardar = (l: Lugar) => ({
  punto: l.punto ? new GeoPoint(l.punto.lat, l.punto.lng) : null,
  referencia: referencia(l),
});
export const pesos = (n: number) => "$ " + n.toLocaleString("es-AR");

type Props = { ultimo: string | null; alCrear: (id: string) => void };

export default function Formulario({ ultimo, alCrear }: Props) {
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [origen, setOrigen] = useState<Lugar>(vacio);
  const [destino, setDestino] = useState<Lugar>(vacio);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nota, setNota] = useState("");
  const [revisarDatos, setRevisarDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const celular = normalizarTelefono(telefono);
  const datosListos = nombre.trim().length >= 2 && celular !== null;
  const precio = precioEstimado(origen.punto, destino.punto);

  async function confirmar() {
    setEnviando(true);
    setError("");
    try {
      const ref = await addDoc(collection(db, "pedidos"), {
        tipo,
        origen: paraGuardar(origen),
        destino: paraGuardar(destino),
        nombre: nombre.trim(),
        telefono: celular,
        nota: nota.trim(),
        precioEstimado: precio,
        estado: "recibido",
        creado: serverTimestamp(),
      });
      alCrear(ref.id);
    } catch {
      setError("No pudimos mandar el pedido. Revisá tu conexión y probá de nuevo.");
      setEnviando(false);
    }
  }

  if (paso === 1)
    return (
      <Pantalla paso={1} titulo="¿Qué hay que llevar?" arriba={<p className="text-sm font-semibold text-acento">{NOMBRE}</p>}>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                setPaso(2);
              }}
              className={`rounded-2xl border px-4 py-6 text-lg font-semibold ${tipo === t ? "border-acento bg-white" : "border-linea bg-white/60"}`}
            >
              {TIPOS[t]}
            </button>
          ))}
        </div>
        {ultimo && (
          <a href={`?pedido=${ultimo}`} className="mt-8 block text-center font-medium text-acento underline">
            Ver mi último pedido
          </a>
        )}
      </Pantalla>
    );

  if (paso === 2 || paso === 3) {
    const esOrigen = paso === 2;
    const lugar = esOrigen ? origen : destino;
    const cambiar = esOrigen ? setOrigen : setDestino;
    return (
      <PasoLugar
        key={paso}
        paso={paso}
        titulo={esOrigen ? "¿Dónde lo buscamos?" : "¿Adónde lo llevamos?"}
        letra={esOrigen ? "a" : "b"}
        lugar={lugar}
        otro={(esOrigen ? destino : origen).punto}
        cambiar={cambiar}
        atras={() => setPaso(paso - 1)}
        siguiente={() => setPaso(paso + 1)}
      />
    );
  }

  if (paso === 4)
    return (
      <Pantalla
        paso={4}
        titulo="Tus datos"
        atras={() => setPaso(3)}
        siguiente={() => (datosListos ? setPaso(5) : setRevisarDatos(true))}
      >
        <label className="block">
          <span className="font-medium">Tu nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            autoComplete="name"
            className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
          />
          {revisarDatos && nombre.trim().length < 2 && <span className="mt-1 block text-sm text-acento">Escribí tu nombre.</span>}
        </label>
        <label className="mt-5 block">
          <span className="font-medium">Tu celular</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="2656 15 123456"
            className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
          />
          {revisarDatos && !celular && (
            <span className="mt-1 block text-sm text-acento">Revisá el celular. Si no es de Merlo, escribilo con la característica.</span>
          )}
        </label>
        <label className="mt-5 block">
          <span className="font-medium">Nota (opcional)</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={tipo === "compras" ? "Qué comprar, dónde y cuánto gastar como máximo" : "Algo que tenga que saber quien lo lleva"}
            className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
          />
        </label>
      </Pantalla>
    );

  return (
    <Pantalla paso={5} titulo="Revisá tu pedido">
      <dl className="divide-y divide-linea rounded-2xl border border-linea bg-white">
        <Fila nombre="Qué" valor={tipo ? TIPOS[tipo] : ""} />
        <Fila nombre="Desde" valor={describir(origen)} />
        <Fila nombre="Hasta" valor={describir(destino)} />
        <Fila nombre="A nombre de" valor={`${nombre.trim()} · ${telefono.trim()}`} />
        {nota.trim() && <Fila nombre="Nota" valor={nota.trim()} />}
        <Fila
          nombre="Precio"
          valor={precio !== null ? `${pesos(precio)} (estimado)` : "A confirmar por WhatsApp"}
        />
      </dl>
      {error && <p className="mt-4 text-acento">{error}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => setPaso(4)}
          disabled={enviando}
          className="rounded-xl border border-linea px-5 py-4 font-semibold disabled:opacity-50"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={enviando}
          className="flex-1 rounded-xl bg-acento py-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Confirmar pedido"}
        </button>
      </div>
    </Pantalla>
  );
}

function describir(l: Lugar) {
  const ref = referencia(l);
  if (l.punto && ref) return `${ref} (marcado en el mapa)`;
  return ref ?? "Marcado en el mapa";
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-sm text-suave">{nombre}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  );
}

type PantallaProps = {
  paso: number;
  titulo: string;
  arriba?: ReactNode;
  children: ReactNode;
  atras?: () => void;
  siguiente?: () => void;
};

function Pantalla({ paso, titulo, arriba, children, atras, siguiente }: PantallaProps) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col px-6 py-6">
      {arriba}
      <p className="mt-2 text-sm text-suave">
        Paso {paso} de {PASOS}
      </p>
      <h1 className="mt-1 mb-6 text-3xl font-bold">{titulo}</h1>
      <div className="flex-1">{children}</div>
      <Botones atras={atras} siguiente={siguiente} />
    </main>
  );
}

function Botones({ atras, siguiente, listo = true }: { atras?: () => void; siguiente?: () => void; listo?: boolean }) {
  if (!atras && !siguiente) return null;
  return (
    <div className="mt-6 flex gap-3">
      {atras && (
        <button type="button" onClick={atras} className="rounded-xl border border-linea px-5 py-3.5 font-semibold">
          Atrás
        </button>
      )}
      {siguiente && (
        <button
          type="button"
          onClick={siguiente}
          disabled={!listo}
          className="flex-1 rounded-xl bg-acento py-3.5 font-semibold text-white disabled:opacity-40"
        >
          Siguiente
        </button>
      )}
    </div>
  );
}

type PasoLugarProps = {
  paso: number;
  titulo: string;
  letra: "a" | "b";
  lugar: Lugar;
  otro: Punto | null;
  cambiar: Dispatch<SetStateAction<Lugar>>;
  atras: () => void;
  siguiente: () => void;
};

// Un paso de mapa entra entero en la pantalla del celular: sobre el mapa el dedo mueve el mapa, no la página,
// así que "Siguiente" tiene que quedar siempre a la vista.
function PasoLugar({ paso, titulo, letra, lugar, otro, cambiar, atras, siguiente }: PasoLugarProps) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");

  function usarUbicacion() {
    if (!("geolocation" in navigator)) {
      setAviso("Este navegador no puede darnos tu ubicación. Tocá el mapa o escribí una referencia.");
      return;
    }
    setBuscando(true);
    setAviso("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscando(false);
        cambiar((l) => ({ ...l, punto: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
      },
      (err) => {
        setBuscando(false);
        setAviso(
          err.code === err.PERMISSION_DENIED
            ? "No diste permiso para usar tu ubicación. Tocá el mapa o escribí una referencia."
            : "No pudimos saber dónde estás. Tocá el mapa o escribí una referencia.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col">
      <div className="px-6 pt-6">
        <p className="text-sm text-suave">
          Paso {paso} de {PASOS}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{titulo}</h1>
        <input
          value={lugar.referencia}
          onChange={(e) => cambiar((l) => ({ ...l, referencia: e.target.value }))}
          maxLength={200}
          placeholder="Calle y número, o una referencia"
          aria-label="Dirección o referencia"
          className="mt-4 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
        />
        <button
          type="button"
          onClick={usarUbicacion}
          disabled={buscando}
          className="mt-2 w-full rounded-xl border border-linea bg-white py-3 font-semibold disabled:opacity-50"
        >
          {buscando ? "Buscando tu ubicación…" : "Usar mi ubicación"}
        </button>
        <p className="mt-2 text-sm text-suave" role="status">
          {aviso || (lugar.punto ? "Podés arrastrar el punto para corregirlo." : "O tocá el mapa donde es.")}
        </p>
      </div>
      <div className="mt-3 min-h-48 flex-1">
        <Mapa
          a={letra === "a" ? lugar.punto : otro}
          b={letra === "b" ? lugar.punto : otro}
          editar={letra}
          alMover={(p) => cambiar((l) => ({ ...l, punto: p }))}
        />
      </div>
      <div className="px-6 pb-6">
        <Botones atras={atras} siguiente={siguiente} listo={lugarListo(lugar)} />
      </div>
    </main>
  );
}
