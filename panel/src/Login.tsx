import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { Icono } from "../../compartido/ui";
import { auth } from "./auth";
import { CAMPO, COLUMNA, Encabezado, ETIQUETA, FOCO, PRINCIPAL } from "./ui";

// Los usuarios no se crean acá: el de Matías se crea en la consola de Firebase y el alta queda cerrada.
const ERRORES: Record<string, string> = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/invalid-email": "Revisá el email.",
  "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisá la señal y probá de nuevo.",
};
// El único aviso que no es un error: va en verde, los demás en rojo.
const ENVIADO = "Si el email es el tuyo, te llegó un mail para elegir otra contraseña.";
const mensaje = (e: unknown) => ERRORES[(e as { code?: string }).code ?? ""] ?? "No se pudo entrar. Probá de nuevo.";

export default function Login() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setAviso("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), clave);
    } catch (err) {
      setAviso(mensaje(err));
      setEntrando(false);
    }
  }

  async function olvide() {
    if (!email.trim()) return setAviso("Escribí tu email y tocá de nuevo “Olvidé mi contraseña”.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      // Firebase no dice si el email existe (protección contra enumeración): el texto tampoco.
      setAviso(ENVIADO);
    } catch (err) {
      setAviso(mensaje(err));
    }
  }

  return (
    <main className={COLUMNA}>
      <Encabezado>
        <h2 className="mt-8 px-5 font-display text-[40px] leading-none font-extrabold tracking-[-0.015em]">Entrá al panel</h2>
      </Encabezado>
      <form onSubmit={entrar} className="mt-3 space-y-5 px-5">
        <label className="block">
          <span className={ETIQUETA}>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1.5 ${CAMPO}`}
          />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className={`mt-1.5 ${CAMPO}`}
          />
        </label>
        {aviso && (
          <p className={`text-[16px] leading-snug font-medium ${aviso === ENVIADO ? "text-monte-osc" : "text-rojo"}`} role="status">
            {aviso}
          </p>
        )}
        <button type="submit" disabled={entrando} className={PRINCIPAL}>
          {entrando ? "Entrando…" : "Entrar"}
          {!entrando && <Icono nombre="siguiente" />}
        </button>
      </form>
      <button
        type="button"
        onClick={olvide}
        className={`mx-auto mt-3 block h-11 px-2 text-[16px] font-bold text-terra-osc underline underline-offset-4 ${FOCO}`}
      >
        Olvidé mi contraseña
      </button>
    </main>
  );
}
