import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useState, type FormEvent, type ReactNode } from "react";
import { db } from "../../compartido/firebase";
import { normalizarTelefono } from "../../compartido/telefono";
import { Icono, type NombreIcono } from "../../compartido/ui";
import { CAMPO, ETIQUETA, FOCO, PRINCIPAL } from "./ui";

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
    <section className="mt-3">
      <ul className="space-y-2">
        {lista.map((m) => {
          const activo = m.activoEl === hoy();
          return (
            <li key={m.id} className="rounded-[18px] border border-linea bg-papel px-3.5 pt-3 pb-1.5" data-motoquero={m.nombre}>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-[17px] font-extrabold ${activo ? "bg-ocre text-tinta" : "bg-linea text-tierra"}`}
                >
                  {m.nombre.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] leading-tight font-extrabold break-words">{m.nombre}</p>
                  <p className="num text-[15px] text-tierra">{celularLindo(m.telefono)}</p>
                </div>
                <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-linea-osc pr-3.5 pl-3 text-[15px] font-bold has-checked:border-monte has-checked:bg-monte-cl has-checked:text-monte-osc">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => cambiar(m, { activoEl: e.target.checked ? hoy() : null })}
                    className={`size-5 accent-monte ${FOCO}`}
                  />
                  Activo hoy
                </label>
              </div>
              {bajaDe === m.id ? (
                <div className="mt-2.5 mb-1.5 flex gap-2">
                  <button type="button" onClick={() => cambiar(m, { baja: true, activoEl: null })} className={`flex-1 bg-rojo text-[#FFF8EE] ${BOTON}`}>
                    Sí, dar de baja
                  </button>
                  <button type="button" onClick={() => setBajaDe(null)} className={`border-[1.5px] border-linea-osc bg-papel px-6 ${BOTON}`}>
                    No
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setBajaDe(m.id)} className={`ml-13 h-11 text-[14px] text-tierra underline underline-offset-2 ${FOCO}`}>
                  Dar de baja
                </button>
              )}
            </li>
          );
        })}
        {!lista.length && <p className="py-4 text-center text-[16px] text-tierra">Todavía no hay motoqueros.</p>}
      </ul>

      <form onSubmit={alta} className="mt-4 rounded-[18px] border border-linea bg-papel p-4">
        <h2 className="font-display text-[22px] leading-tight font-extrabold">Nuevo motoquero</h2>
        <div className="mt-3 space-y-4">
          <Campo etiqueta="Nombre" icono="persona">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className={`pl-11 ${CAMPO}`} />
          </Campo>
          <Campo etiqueta="Celular" icono="whatsapp">
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="tel"
              maxLength={30}
              placeholder="2656 15 123456"
              className={`num pl-11 ${CAMPO}`}
            />
          </Campo>
        </div>
        {aviso && (
          <p className="mt-3 text-[15px] leading-snug font-medium text-rojo" role="alert">
            {aviso}
          </p>
        )}
        <button type="submit" className={`mt-4 ${PRINCIPAL}`}>
          Agregar
        </button>
      </form>
    </section>
  );
}

const BOTON = `min-h-11 rounded-[11px] text-[15px] font-bold ${FOCO}`;

// Etiqueta en negrita y campo papel con el ícono adentro, como los datos del cliente.
export function Campo({ etiqueta, icono, children }: { etiqueta: string; icono: NombreIcono; children: ReactNode }) {
  return (
    <label className="block">
      <span className={ETIQUETA}>{etiqueta}</span>
      <span className="relative mt-1.5 block">
        <Icono nombre={icono} className="pointer-events-none absolute top-[15px] left-3.5 size-[22px] text-tierra" />
        {children}
      </span>
    </label>
  );
}
