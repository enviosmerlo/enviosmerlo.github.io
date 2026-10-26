import { collection, doc, GeoPoint, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { db } from "../../compartido/firebase";
import { Marca } from "../../compartido/marca";
import { ESTADOS, ID_VALIDO, TIPOS, type Lugar, type Pedido, type Punto, type Tipo } from "../../compartido/pedido";
import { pesos, precioEstimado } from "../../compartido/precio";
import { tarifaDe, useServicio } from "../../compartido/servicio";
import { normalizarTelefono } from "../../compartido/telefono";
import { ALTO, Campo, COLUMNA, FOCO, FOCO_CAMPO, Icono, IconoTipo, Letra, Sierras, TIPO_ESTILO } from "../../compartido/ui";
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
export const precioTexto = (n: number | null) => (n !== null ? `${pesos(n)} (estimado)` : "A confirmar por WhatsApp");
const ATRAS = `flex h-[54px] items-center gap-1 rounded-[14px] border-[1.5px] border-linea-osc pr-5 pl-3 text-[17px] font-bold disabled:opacity-50 ${FOCO}`;
const PRINCIPAL = `flex h-[54px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-terra text-[18px] font-bold text-[#FFF8EE] disabled:opacity-40 ${FOCO}`;
const CAMPO = `w-full rounded-[14px] border-[1.5px] border-linea-osc bg-papel pr-3.5 pl-11 text-[17px] placeholder:text-[#76634F] ${FOCO_CAMPO}`;
const ROTULO = "text-[13px] leading-tight font-bold tracking-[0.1em] text-tierra uppercase";
const SUBTITULO: Record<Tipo, string> = {
  paquete: "Cajas, bolsos, encargos",
  compras: "Súper, farmacia, kiosco",
  documentos: "Sobres, papeles, llaves",
  comida: "Viandas y rotisería",
};

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
  const servicio = useServicio();
  const precio = precioEstimado(origen.punto, destino.punto, tarifaDe(servicio));

  async function confirmar() {
    setEnviando(true);
    setError("");
    // Sin señal, Firestore deja el pedido en cola y la promesa no termina hasta que vuelve la conexión:
    // si tarda, se avisa que no cierre la página (el pedido en cola vive solo en esta pestaña).
    const lento = setTimeout(
      () => setError("Sin señal: el pedido se manda solo cuando vuelva la conexión. No cierres esta página."),
      8000,
    );
    try {
      const ref = doc(collection(db, "pedidos"));
      await setDoc(ref, {
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
    } finally {
      clearTimeout(lento);
    }
  }

  if (paso === 1)
    return (
      <main className={`${COLUMNA} ${ALTO} flex flex-col pb-8`}>
        <div className="bg-cielo">
          <div className="px-6 pt-7">
            <Marca />
          </div>
          <div className="mt-7 px-6">
            <div className="flex items-center gap-3">
              <Barra paso={1} apagado="bg-[#E6CFA5]" className="flex-1" />
              <p className="text-[14px] font-bold text-tierra">Paso 1 de {PASOS}</p>
            </div>
            <h1 className="relative z-10 mt-3 font-display text-[42px] leading-none font-extrabold tracking-[-0.015em]">
              ¿Qué hay
              <br />
              que llevar?
            </h1>
          </div>
          <div className="relative -mt-2 h-24" aria-hidden="true">
            <svg viewBox="0 0 58 58" className="absolute top-[-6px] right-[38px] size-[58px]">
              <circle cx="29" cy="29" r="27" fill="#E9B04A" />
            </svg>
            <Sierras lejos="#C98463" medio="#6F8150" cerca="#F3EBDD" className="absolute inset-0 size-full" />
          </div>
        </div>
        <div className="relative z-10 -mt-2 mb-6 grid grid-cols-2 gap-3 px-5">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                setPaso(2);
              }}
              className={`flex h-[166px] flex-col justify-between rounded-[22px] p-4 text-left ${TIPO_ESTILO[t].fondo} ${tipo === t ? "ring-3 ring-terra" : ""} ${FOCO}`}
            >
              <IconoTipo tipo={t} className="-ml-1 size-14" />
              <span>
                <span className="block text-[21px] leading-tight font-extrabold">{TIPOS[t]}</span>
                <span className={`mt-0.5 block text-[14.5px] leading-snug ${TIPO_ESTILO[t].texto}`}>{SUBTITULO[t]}</span>
              </span>
            </button>
          ))}
        </div>
        {ultimo && <UltimoPedido id={ultimo} />}
      </main>
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
        abajo={<Botones atras={() => setPaso(3)} siguiente={() => (datosListos ? setPaso(5) : setRevisarDatos(true))} />}
      >
        <Campo etiqueta="Tu nombre" icono="persona" error={revisarDatos && nombre.trim().length < 2 ? "Escribí tu nombre." : ""}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            autoComplete="name"
            className={`h-[52px] ${CAMPO}`}
          />
        </Campo>
        <Campo
          etiqueta="Tu celular"
          icono="whatsapp"
          error={revisarDatos && !celular ? "Revisá el celular. Si no es de Merlo, escribilo con la característica." : ""}
        >
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="2656 15 123456"
            className={`h-[52px] ${CAMPO}`}
          />
        </Campo>
        <Campo etiqueta="Nota (opcional)" icono="nota">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={tipo === "compras" ? "Qué comprar, dónde y cuánto gastar como máximo" : "Algo que tenga que saber quien lo lleva"}
            className={`block resize-none py-3 leading-snug ${CAMPO}`}
          />
        </Campo>
      </Pantalla>
    );

  return (
    <Pantalla
      paso={5}
      titulo="Revisá tu pedido"
      abajo={
        <>
          <button type="button" onClick={() => setPaso(4)} disabled={enviando} className={ATRAS}>
            <Icono nombre="atras" />
            Atrás
          </button>
          <button type="button" onClick={confirmar} disabled={enviando} className={PRINCIPAL}>
            <Icono nombre="tilde" className="size-[22px]" />
            {enviando ? "Enviando…" : "Confirmar pedido"}
          </button>
        </>
      }
    >
      {/* El pedido como un remito del almacén, con el precio del otro lado del troquel. */}
      <div className="mt-1">
        <dl className="rounded-t-[18px] bg-papel px-[18px] pt-[18px] pb-4">
          <div className="flex items-center gap-3">
            {tipo && (
              <span className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${TIPO_ESTILO[tipo].fondo}`}>
                <IconoTipo tipo={tipo} className="size-9" />
              </span>
            )}
            <div>
              <dt className={ROTULO}>Qué</dt>
              <dd className="text-[20px] leading-tight font-extrabold">{tipo ? TIPOS[tipo] : ""}</dd>
            </div>
          </div>
          <div className="relative mt-[18px] border-t border-dashed border-linea-osc pt-[18px] pl-10">
            <span className="absolute top-[48px] bottom-[34px] left-[13px] border-l-2 border-dotted border-[#B9A78C]" aria-hidden="true" />
            <div className="relative">
              <dt className={ROTULO}>
                <Letra letra="A" className="absolute top-0.5 -left-10 size-7 text-[14px]" />
                Desde
              </dt>
              <dd className="text-[17px] leading-snug font-bold break-words">{describir(origen)}</dd>
            </div>
            <div className="relative mt-5">
              <dt className={ROTULO}>
                <Letra letra="B" className="absolute top-0.5 -left-10 size-7 text-[14px]" />
                Hasta
              </dt>
              <dd className="text-[17px] leading-snug font-bold break-words">{describir(destino)}</dd>
            </div>
          </div>
          <div className="mt-[18px] flex gap-3 border-t border-dashed border-linea-osc pt-[18px]">
            <Icono nombre="persona" className="size-7 text-tierra" />
            <div className="min-w-0">
              <dt className={ROTULO}>A nombre de</dt>
              <dd className="num text-[17px] leading-snug break-words">{`${nombre.trim()} · ${telefono.trim()}`}</dd>
            </div>
          </div>
          {nota.trim() && (
            <div className="mt-4 flex gap-3">
              <Icono nombre="nota" className="size-7 text-tierra" />
              <div className="min-w-0 flex-1">
                <dt className={ROTULO}>Nota</dt>
                <dd className="mt-1 rounded-[10px] bg-ocre-cl px-3 py-2 text-[17px] leading-snug break-words text-[#3E2C12] italic">
                  {nota.trim()}
                </dd>
              </div>
            </div>
          )}
        </dl>
        <div className="relative h-4 bg-papel" aria-hidden="true">
          <span className="absolute top-0 -left-2 size-4 rounded-full bg-arena" />
          <span className="absolute top-0 -right-2 size-4 rounded-full bg-arena" />
          <span className="absolute top-1/2 right-4 left-4 border-t-2 border-dashed border-linea-osc" />
        </div>
        <div className="flex items-end justify-between gap-4 bg-papel px-[18px] pt-2 pb-4">
          <div>
            <p className={ROTULO}>Precio</p>
            {precio !== null && <p className="text-[15px] text-tierra">estimado</p>}
          </div>
          {precio !== null ? (
            <p className="num font-display text-[38px] leading-none font-extrabold">{pesos(precio)}</p>
          ) : (
            <p className="text-right text-[17px] leading-snug font-bold">{precioTexto(null)}</p>
          )}
        </div>
        <svg className="block h-[9px] w-full" aria-hidden="true">
          <pattern id="troquel" width="12" height="9" patternUnits="userSpaceOnUse">
            <path d="M0 0H12L6 9Z" fill="#FFFAF2" />
          </pattern>
          <rect width="100%" height="9" fill="url(#troquel)" />
        </svg>
      </div>
      {error && (
        <p className="mt-4 text-[16px] leading-snug font-medium text-rojo" role="alert">
          {error}
        </p>
      )}
    </Pantalla>
  );
}

// Atajo al último pedido de este teléfono. Si se puede leer, muestra qué es y cómo va; si no, solo el atajo.
function UltimoPedido({ id }: { id: string }) {
  const [resumen, setResumen] = useState("");
  useEffect(() => {
    if (!ID_VALIDO.test(id)) return;
    getDoc(doc(db, "pedidos", id))
      .then((d) => {
        const p = d.data() as Pedido | undefined;
        if (p) setResumen(`${TIPOS[p.tipo] ?? ""} · ${ESTADOS[p.estado] ?? ""}`);
      })
      .catch(() => {});
  }, [id]);
  return (
    <a
      href={`?pedido=${id}`}
      className={`mx-5 mt-auto flex items-center gap-3 rounded-[18px] border border-linea bg-papel py-3 pr-4 pl-3 ${FOCO}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ocre-cl text-ocre-osc">
        <Icono nombre="reloj" className="size-[22px]" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[17px] font-bold">Ver mi último pedido</span>
        {resumen && <span className="block text-[14px] text-tierra">{resumen}</span>}
      </span>
      <Icono nombre="derecha" className="size-5 text-tierra" />
    </a>
  );
}

function describir(l: Lugar) {
  const ref = referencia(l);
  if (l.punto && ref) return `${ref} (marcado en el mapa)`;
  return ref ?? "Marcado en el mapa";
}

function Barra({ paso, apagado = "bg-linea", className = "" }: { paso: number; apagado?: string; className?: string }) {
  return (
    <div className={`grid grid-cols-5 gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: PASOS }, (_, i) => (
        <i key={i} className={`h-1.5 rounded-full ${i < paso ? "bg-terra" : apagado}`} />
      ))}
    </div>
  );
}

function Encabezado({ paso }: { paso: number }) {
  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between gap-3">
        <Marca tamaño="text-[19px]" sello="size-7" />
        <p className="text-[14px] font-bold text-tierra">
          Paso {paso} de {PASOS}
        </p>
      </div>
      <Barra paso={paso} className="mt-3" />
    </div>
  );
}

const TITULO = "font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.01em]";

function Pantalla({ paso, titulo, children, abajo }: { paso: number; titulo: string; children: ReactNode; abajo: ReactNode }) {
  return (
    <main className={`${COLUMNA} ${ALTO} flex flex-col`}>
      <Encabezado paso={paso} />
      <h1 className={`mt-4 px-5 ${TITULO}`}>{titulo}</h1>
      <div className="mt-5 flex-1 space-y-5 px-5">{children}</div>
      <div className="mt-6 flex gap-3 px-5 pb-6">{abajo}</div>
    </main>
  );
}

function Botones({ atras, siguiente, listo = true }: { atras: () => void; siguiente: () => void; listo?: boolean }) {
  return (
    <>
      <button type="button" onClick={atras} className={ATRAS}>
        <Icono nombre="atras" />
        Atrás
      </button>
      <button type="button" onClick={siguiente} disabled={!listo} className={PRINCIPAL}>
        Siguiente
        <Icono nombre="siguiente" />
      </button>
    </>
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
  // Cada pedido de GPS lleva un número: si mientras tanto el cliente tocó el mapa o cambió de paso,
  // la respuesta que llega tarde se descarta en vez de pisar el punto que eligió.
  const pedidoGps = useRef(0);
  useEffect(() => () => void pedidoGps.current++, []);

  function usarUbicacion() {
    if (!("geolocation" in navigator)) {
      setAviso("Este navegador no puede darnos tu ubicación. Tocá el mapa o escribí una referencia.");
      return;
    }
    const n = ++pedidoGps.current;
    setBuscando(true);
    setAviso("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (n !== pedidoGps.current) return;
        setBuscando(false);
        cambiar((l) => ({ ...l, punto: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
      },
      (err) => {
        if (n !== pedidoGps.current) return;
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
    <main className={`${COLUMNA} flex h-svh flex-col md:h-[calc(100svh-3rem)]`}>
      <Encabezado paso={paso} />
      <div className="px-5">
        <h1 className={`mt-4 ${TITULO}`}>{titulo}</h1>
        <div className="relative mt-3.5">
          <Icono nombre="pin" className="pointer-events-none absolute top-[15px] left-3.5 size-[22px] text-terra" />
          <input
            value={lugar.referencia}
            onChange={(e) => cambiar((l) => ({ ...l, referencia: e.target.value }))}
            maxLength={200}
            placeholder="Calle y número, o una referencia"
            aria-label="Dirección o referencia"
            className={`h-[52px] ${CAMPO}`}
          />
        </div>
        <button
          type="button"
          onClick={usarUbicacion}
          disabled={buscando}
          className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-monte-cl text-[17px] font-bold text-monte-osc disabled:opacity-60 ${FOCO}`}
        >
          <Icono nombre="mira" className="size-[21px]" />
          {buscando ? "Buscando tu ubicación…" : "Usar mi ubicación"}
        </button>
        {aviso && (
          <p className="mt-2 text-[15px] leading-snug font-medium text-rojo" role="alert">
            {aviso}
          </p>
        )}
      </div>
      <div className="relative mt-3.5 min-h-48 flex-1 border-t border-linea">
        <Mapa
          a={letra === "a" ? lugar.punto : otro}
          b={letra === "b" ? lugar.punto : otro}
          editar={letra}
          alMover={(p) => {
            pedidoGps.current++;
            setBuscando(false);
            cambiar((l) => ({ ...l, punto: p }));
          }}
        />
        {/* Sobre el mapa pero sin tapar los toques: el dedo pasa de largo hasta el mapa. */}
        <p
          role="status"
          className="pointer-events-none absolute top-3 left-3 z-[1000] mr-16 flex items-center gap-1.5 rounded-full bg-tinta py-1.5 pr-3.5 pl-2.5 text-[14px] leading-snug font-medium text-[#FBF1DE]"
        >
          <Icono nombre={lugar.punto ? "mover" : "pin"} className="size-4" />
          {lugar.punto ? "Podés arrastrar el punto para corregirlo." : "O tocá el mapa donde es."}
        </p>
      </div>
      <div className="flex gap-3 border-t border-linea bg-papel px-5 pt-3.5 pb-6">
        <Botones atras={atras} siguiente={siguiente} listo={lugarListo(lugar)} />
      </div>
    </main>
  );
}
