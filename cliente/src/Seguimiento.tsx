import { doc, onSnapshot, type GeoPoint } from "firebase/firestore";
import { useEffect, useState, type ReactNode } from "react";
import { db } from "../../compartido/firebase";
import { NOMBRE, WHATSAPP } from "../../compartido/marca";
import { ESTADOS, ID_VALIDO, TIPOS, type Estado, type Tipo } from "../../compartido/pedido";
import { Fila, precioTexto } from "./Formulario";

type Guardado = { punto: GeoPoint | null; referencia: string | null };
type Pedido = {
  tipo: Tipo;
  origen: Guardado;
  destino: Guardado;
  precioEstimado: number | null;
  estado: Estado;
};
const AVANCE: Estado[] = ["recibido", "asignado", "en_camino", "entregado"];

// Pantalla que abre el link del pedido: el estado se actualiza solo cuando el operador lo cambia.
export default function Seguimiento({ id }: { id: string }) {
  const valido = ID_VALIDO.test(id);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [noEsta, setNoEsta] = useState(!valido);
  const [copiado, setCopiado] = useState(false);
  const link = new URL(`?pedido=${id}`, location.href).href;

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
      <Marco>
        <h1 className="text-3xl font-bold">No encontramos ese pedido</h1>
        <p className="mt-3 text-suave">Revisá que el link esté completo.</p>
        <a href="./" className="mt-8 block w-full rounded-xl bg-acento py-4 text-center text-lg font-semibold text-white">
          Hacer un pedido
        </a>
      </Marco>
    );

  if (!pedido)
    return (
      <Marco>
        <p className="text-suave" role="status">
          Buscando tu pedido…
        </p>
      </Marco>
    );

  const actual = AVANCE.indexOf(pedido.estado);
  async function copiar() {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
  }

  return (
    <Marco>
      <p className="text-sm text-suave">Tu pedido</p>
      <h1 className="mt-1 text-4xl font-bold" data-estado={pedido.estado}>
        {ESTADOS[pedido.estado] ?? pedido.estado}
      </h1>
      {pedido.estado !== "cancelado" && (
        <ol className="mt-5 flex gap-1.5" aria-label="Avance del envío">
          {AVANCE.map((e, i) => (
            <li key={e} className={`h-1.5 flex-1 rounded-full ${i <= actual ? "bg-acento" : "bg-linea"}`} title={ESTADOS[e]} />
          ))}
        </ol>
      )}

      <dl className="mt-8 divide-y divide-linea rounded-2xl border border-linea bg-white">
        <Fila nombre="Qué" valor={TIPOS[pedido.tipo]} />
        <Fila nombre="Desde" valor={pedido.origen.referencia ?? "Marcado en el mapa"} />
        <Fila nombre="Hasta" valor={pedido.destino.referencia ?? "Marcado en el mapa"} />
        <Fila nombre="Precio" valor={precioTexto(pedido.precioEstimado)} />
      </dl>

      <section className="mt-8">
        <h2 className="font-semibold">Guardá este link para volver</h2>
        <p className="mt-1 text-sm text-suave">Quien tenga este link puede ver tu nombre, tu teléfono y los lugares del pedido.</p>
        <p className="mt-2 rounded-xl border border-linea bg-white px-4 py-3 text-sm break-all select-all" data-link>
          {link}
        </p>
        <div className="mt-3 flex gap-3">
          {"share" in navigator && (
            <button
              type="button"
              onClick={() => navigator.share({ title: NOMBRE, url: link }).catch(() => {})}
              className="flex-1 rounded-xl border border-linea bg-white py-3 font-semibold"
            >
              Compartir
            </button>
          )}
          {navigator.clipboard && (
            <button type="button" onClick={copiar} className="flex-1 rounded-xl border border-linea bg-white py-3 font-semibold">
              {copiado ? "Copiado" : "Copiar link"}
            </button>
          )}
        </div>
      </section>

      {WHATSAPP && (
        <a
          href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, hice un pedido: ${link}`)}`}
          className="mt-8 block w-full rounded-xl bg-acento py-4 text-center text-lg font-semibold text-white"
        >
          Escribinos por WhatsApp
        </a>
      )}
      <a href="./" className="mt-6 block text-center font-medium text-acento underline">
        Hacer otro pedido
      </a>
    </Marco>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-svh max-w-md px-6 py-8">{children}</main>;
}
