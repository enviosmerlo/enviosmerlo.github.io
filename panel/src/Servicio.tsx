import { onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState, type FormEvent } from "react";
import { precioEstimado } from "../../compartido/precio";
import { servicioRef, SIN_CARGAR, tarifaDe, type Servicio as Datos } from "../../compartido/servicio";
import { normalizarTelefono } from "../../compartido/telefono";
import { celularLindo } from "./Motoqueros";

// Lo que el cliente usa para el precio estimado y el botón "Avisar por WhatsApp". Vacío = "a confirmar" / sin botón.
const CAMPOS = [
  ["bajada", "Bajada ($)"],
  ["porKm", "Precio por km ($)"],
  ["minimo", "Mínimo ($)"],
] as const;
const PLAZA = { lat: -32.342558, lng: -65.0136903 };
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
  if (!form) return <p className="text-suave">Cargando…</p>;

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
      setAviso("Guardado. Los clientes ya lo ven.");
    } catch {
      setAviso("No se pudo guardar. Revisá los números y probá de nuevo.");
    }
  }

  const campo = (k: string, etiqueta: string, props: object = { inputMode: "numeric" }) => (
    <label key={k} className="block">
      <span className="text-sm font-medium">{etiqueta}</span>
      <input
        value={form[k]}
        onChange={(e) => {
          setForm({ ...form, [k]: e.target.value });
          setAviso("");
        }}
        aria-label={etiqueta}
        {...props}
        className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
      />
    </label>
  );

  return (
    <form onSubmit={guardar} className="space-y-4 rounded-2xl border border-linea bg-white p-4">
      {CAMPOS.map(([k, etiqueta]) => campo(k, etiqueta))}
      {campo("factor", "Factor por calles", { inputMode: "decimal" })}
      <p className="text-sm text-suave">
        {ejemplo !== null
          ? `Ejemplo: 2 km en línea recta = $ ${ejemplo.toLocaleString("es-AR")}.`
          : "Sin bajada, precio por km y mínimo, el cliente ve “a confirmar por WhatsApp”."}
      </p>
      {campo("whatsapp", "WhatsApp del servicio", { inputMode: "tel", placeholder: "2656 15 123456" })}
      {aviso && (
        <p className="text-acento" role="status">
          {aviso}
        </p>
      )}
      <button type="submit" className="w-full rounded-xl bg-acento py-3.5 font-semibold text-white">
        Guardar
      </button>
    </form>
  );
}

const texto = (n: number | null) => (n === null ? "" : String(n));
