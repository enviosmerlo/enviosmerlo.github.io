import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useState, type FormEvent } from "react";
import { db } from "../../compartido/firebase";
import { normalizarTelefono } from "../../compartido/telefono";

export type Motoquero = { id: string; nombre: string; telefono: string; activoEl: string | null; baja: boolean };

// Fecha de hoy en Argentina (YYYY-MM-DD). "Activo hoy" guarda esta fecha y al otro día deja de coincidir sola.
export const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/San_Luis" }).format(new Date());
export const celularLindo = (t: string) => `+${t.slice(0, 2)} ${t.slice(2, 3)} ${t.slice(3, 7)} ${t.slice(7)}`;

export default function Motoqueros({ motoqueros }: { motoqueros: Motoquero[] }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [aviso, setAviso] = useState("");
  const [bajaDe, setBajaDe] = useState<string | null>(null);
  const celular = normalizarTelefono(telefono);
  const lista = motoqueros.filter((m) => !m.baja).sort((a, b) => a.nombre.localeCompare(b.nombre));

  async function alta(e: FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2 || !celular) return setAviso("Escribí el nombre y un celular válido.");
    try {
      await addDoc(collection(db, "motoqueros"), { nombre: nombre.trim(), telefono: celular, activoEl: hoy(), baja: false });
      setNombre("");
      setTelefono("");
      setAviso("");
    } catch {
      setAviso("No se pudo guardar. Probá de nuevo.");
    }
  }

  const cambiar = (m: Motoquero, campos: Partial<Motoquero>) =>
    updateDoc(doc(db, "motoqueros", m.id), campos).catch(() => setAviso("No se pudo guardar. Probá de nuevo."));

  return (
    <section>
      <ul className="space-y-2">
        {lista.map((m) => (
          <li key={m.id} className="rounded-2xl border border-linea bg-white p-4" data-motoquero={m.nombre}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold break-words">{m.nombre}</p>
                <p className="text-sm text-suave">{celularLindo(m.telefono)}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={m.activoEl === hoy()}
                  onChange={(e) => cambiar(m, { activoEl: e.target.checked ? hoy() : null })}
                  className="size-5 accent-acento"
                />
                Activo hoy
              </label>
            </div>
            {bajaDe === m.id ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => cambiar(m, { baja: true, activoEl: null })} className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">
                  Sí, dar de baja
                </button>
                <button type="button" onClick={() => setBajaDe(null)} className="rounded-xl border border-linea px-4 py-2 text-sm font-semibold">
                  No
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setBajaDe(m.id)} className="mt-2 text-sm text-suave underline">
                Dar de baja
              </button>
            )}
          </li>
        ))}
        {!lista.length && <p className="text-suave">Todavía no hay motoqueros.</p>}
      </ul>

      <form onSubmit={alta} className="mt-6 rounded-2xl border border-linea bg-white p-4">
        <h2 className="font-semibold">Nuevo motoquero</h2>
        <label className="mt-3 block">
          <span className="text-sm font-medium">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className="mt-1 w-full rounded-xl border border-linea px-4 py-3 text-base" />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium">Celular</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            maxLength={30}
            placeholder="2656 15 123456"
            className="mt-1 w-full rounded-xl border border-linea px-4 py-3 text-base"
          />
        </label>
        {aviso && <p className="mt-3 text-acento">{aviso}</p>}
        <button type="submit" className="mt-4 w-full rounded-xl bg-acento py-3 font-semibold text-white">
          Agregar
        </button>
      </form>
    </section>
  );
}
