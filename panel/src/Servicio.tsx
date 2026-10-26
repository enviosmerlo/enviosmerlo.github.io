import { onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { precioEstimado } from "../../compartido/precio";
import { servicioRef, SIN_CARGAR, tarifaDe, type Servicio as Datos } from "../../compartido/servicio";
import { normalizarTelefono } from "../../compartido/telefono";
import { Icono } from "../../compartido/ui";
import { Campo, celularLindo } from "./Motoqueros";
import { CAMPO, ETIQUETA, PRINCIPAL } from "./ui";

// Lo que el cliente usa para el precio estimado y el botón "Avisar por WhatsApp". Vacío = "a confirmar" / sin botón.
const CAMPOS = [
  ["bajada", "Bajada ($)"],
  ["porKm", "Precio por km ($)"],
  ["minimo", "Mínimo ($)"],
] as const;
const PLAZA = { lat: -32.342558, lng: -65.0136903 };
const GUARDADO = "Guardado. Los clientes ya lo ven."; // el único aviso que no es un error
const A_2_KM = { lat: PLAZA.lat + 2 / 111.195, lng: PLAZA.lng }; // 2 km en línea recta, para el ejemplo

export default function Servicio() {
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(
    () =>
      onSnapshot(servicioRef, (d) => {
        const s = d.exists() ? (d.data() as Datos) : SIN_CARGAR;
        setForm((f) => f ?? { bajada: texto(s.bajada), porKm: texto(s.porKm), minimo: texto(s.minimo), factor: String(s.factor).replace(".", ","), whatsapp: s.whatsapp ? celularLindo(s.whatsapp) : "" });
      }),
    [],
  );
  if (!form) return <p className="mt-4 text-[16px] text-tierra">Cargando…</p>;

  const pesos = (k: string) => (form[k].trim() ? Number(form[k].replace(/\D/g, "")) : null);
  const factor = Number(form.factor.replace(",", "."));
  const whatsapp = form.whatsapp.trim() ? normalizarTelefono(form.whatsapp) : null;
  const datos: Datos = { bajada: pesos("bajada"), porKm: pesos("porKm"), minimo: pesos("minimo"), factor, whatsapp };
  const tarifa = tarifaDe(datos);
  const ejemplo = tarifa && precioEstimado(PLAZA, A_2_KM, tarifa);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!(factor >= 1 && factor <= 3)) return setAviso("El factor por calles va entre 1 y 3 (por ejemplo 1,3).");
    if (form!.whatsapp.trim() && !whatsapp) return setAviso("Revisá el WhatsApp: escribilo con característica.");
    try {
      await setDoc(servicioRef, datos);
      setAviso(GUARDADO);
    } catch {
      setAviso("No se pudo guardar. Revisá los números y probá de nuevo.");
    }
  }

  const cambio = (k: string) => (e: { target: { value: string } }) => {
    setForm({ ...form, [k]: e.target.value });
    setAviso("");
  };
  const campo = (k: string, etiqueta: string, props: object = { inputMode: "numeric" }) => (
    <label key={k} className="block">
      <span className={`${ETIQUETA} leading-tight`}>{etiqueta}</span>
      <input value={form[k]} onChange={cambio(k)} aria-label={etiqueta} {...props} className={`num mt-1.5 ${CAMPO}`} />
    </label>
  );

  return (
    <form onSubmit={guardar} className="mt-3 rounded-[18px] border border-linea bg-papel p-4">
      <h2 className="font-display text-[22px] leading-tight font-extrabold">Precio estimado</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
        {CAMPOS.map(([k, etiqueta]) => campo(k, etiqueta))}
        {campo("factor", "Factor por calles", { inputMode: "decimal" })}
      </div>
      <p className="mt-4 rounded-[14px] bg-arena px-3.5 py-2.5 text-[15px] leading-snug">
        {ejemplo !== null
          ? `Ejemplo: 2 km en línea recta = $ ${ejemplo.toLocaleString("es-AR")}.`
          : "Sin bajada, precio por km y mínimo, el cliente ve “a confirmar por WhatsApp”."}
      </p>
      <div className="mt-4 border-t border-dashed border-linea-osc pt-4">
        <Campo etiqueta="WhatsApp del servicio" icono="whatsapp">
          <input
            value={form.whatsapp}
            onChange={cambio("whatsapp")}
            aria-label="WhatsApp del servicio"
            inputMode="tel"
            placeholder="2656 15 123456"
            className={`num pl-11 ${CAMPO}`}
          />
        </Campo>
      </div>
      {aviso && (
        <p className={`mt-4 flex gap-1.5 text-[16px] leading-snug font-medium ${aviso === GUARDADO ? "text-monte-osc" : "text-rojo"}`} role="status">
          {aviso === GUARDADO && <Icono nombre="tilde" className="mt-0.5 size-5" />}
          {aviso}
        </p>
      )}
      <button type="submit" className={`mt-4 ${PRINCIPAL}`}>
        Guardar
      </button>
    </form>
  );
}

const texto = (n: number | null) => (n === null ? "" : String(n));
