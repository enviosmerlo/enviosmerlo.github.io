import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../compartido/firebase";
import { NOMBRE } from "../../compartido/marca";
import { auth } from "./auth";
import Login from "./Login";
import Motoqueros, { type Motoquero } from "./Motoqueros";
import Pedidos from "./Pedidos";
import Servicio from "./Servicio";

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
    <p className="rounded-2xl border border-acento bg-white p-4 font-medium text-acento" role="alert" data-cartel>
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
    <main className="mx-auto min-h-svh max-w-2xl px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-lg font-bold">
          {NOMBRE} <span className="font-normal text-suave">· Panel</span>
        </h1>
        <button type="button" onClick={() => signOut(auth)} className="text-sm font-medium text-suave underline">
          Salir
        </button>
      </header>
      <nav className="mb-4 flex gap-2">
        {(Object.keys(VISTAS) as Vista[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            aria-pressed={vista === v}
            className={`flex-1 rounded-xl py-2.5 font-semibold ${vista === v ? "bg-tinta text-white" : "border border-linea bg-white"}`}
          >
            {VISTAS[v]}
          </button>
        ))}
      </nav>
      {error ? (
        <Cartel error={error} />
      ) : vista === "pedidos" ? (
        <Pedidos motoqueros={motoqueros} />
      ) : vista === "motoqueros" ? (
        <Motoqueros motoqueros={motoqueros} />
      ) : (
        <Servicio />
      )}
    </main>
  );
}
