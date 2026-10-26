import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../compartido/firebase";
import { FOCO, Icono } from "../../compartido/ui";
import { auth } from "./auth";
import Login from "./Login";
import Motoqueros, { type Motoquero } from "./Motoqueros";
import Pedidos from "./Pedidos";
import Servicio from "./Servicio";
import { Encabezado, MARCO } from "./ui";

const VISTAS = { pedidos: "Pedidos", motoqueros: "Motoqueros", tarifa: "Tarifa" } as const;
type Vista = keyof typeof VISTAS;

export default function App() {
  const [usuario, setUsuario] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUsuario), []);
  if (usuario === undefined) return null; // un instante, mientras Firebase recupera la sesión guardada
  return usuario ? <Panel /> : <Login />;
}

// Un listener que falla queda muerto: en vez de una lista vacía que nunca suena, un cartel que se ve.
export function Cartel({ error }: { error: { code?: string } }) {
  return (
    <p className="mt-3 flex gap-2.5 rounded-[18px] border-[1.5px] border-rojo bg-rojo-cl p-4 text-[17px] leading-snug font-bold text-rojo" role="alert" data-cartel>
      <Icono nombre="cruz" className="mt-0.5 size-5" />
      {error.code === "permission-denied"
        ? "Esta cuenta no tiene permiso para usar el panel."
        : "Se cortó la conexión con los pedidos. Recargá la página."}
    </p>
  );
}

function Panel() {
  const [vista, setVista] = useState<Vista>("pedidos");
  const [motoqueros, setMotoqueros] = useState<Motoquero[]>([]);
  const [error, setError] = useState<{ code?: string } | null>(null);
  const [esperando, setEsperando] = useState(0); // lo cuenta Pedidos, para el número de la pestaña

  useEffect(
    () =>
      onSnapshot(
        collection(db, "motoqueros"),
        (snap) => setMotoqueros(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Motoquero, "id">) }))),
        setError,
      ),
    [],
  );

  return (
    <main className={MARCO}>
      <Encabezado salir={() => signOut(auth)} />
      <div className="px-4">
        <nav className="flex gap-1 rounded-[14px] bg-[#E8DDCB] p-1">
          {(Object.keys(VISTAS) as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[11px] text-[16px] ${
                vista === v ? "bg-papel font-extrabold shadow-[0_1px_2px_rgba(43,33,24,.18)]" : "font-bold text-[#5A4A3B]"
              } ${FOCO}`}
            >
              {VISTAS[v]}
              {/* El número va aparte del nombre: la pestaña se llama "Pedidos" para el lector de pantalla y el título lo cuenta. */}
              {v === "pedidos" && esperando > 0 && (
                <span aria-hidden="true" className="grid h-5 min-w-5 place-items-center rounded-full bg-terra px-1.5 text-[12.5px] font-extrabold text-[#FFF8EE]">
                  {esperando}
                </span>
              )}
            </button>
          ))}
        </nav>
        {error ? (
          <Cartel error={error} />
        ) : (
          <>
            {/* Pedidos queda montado en las otras pestañas: el aviso, el número y el título siguen andando. */}
            <div hidden={vista !== "pedidos"}>
              <Pedidos motoqueros={motoqueros} alContar={setEsperando} />
            </div>
            {vista === "motoqueros" && <Motoqueros motoqueros={motoqueros} />}
            {vista === "tarifa" && <Servicio />}
          </>
        )}
      </div>
    </main>
  );
}
