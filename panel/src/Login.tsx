import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useState, type FormEvent } from "react";
import { NOMBRE } from "../../compartido/marca";
import { auth } from "./auth";

// Los usuarios no se crean acá: el de Matías se crea en la consola de Firebase y el alta queda cerrada.
const ERRORES: Record<string, string> = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/invalid-email": "Revisá el email.",
  "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisá la señal y probá de nuevo.",
};
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
      setAviso("Si el email es el tuyo, te llegó un mail para elegir otra contraseña.");
    } catch (err) {
      setAviso(mensaje(err));
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="text-sm font-semibold tracking-widest text-acento uppercase">Panel</p>
      <h1 className="mt-2 text-3xl font-bold">{NOMBRE}</h1>
      <form onSubmit={entrar} className="mt-8 space-y-4">
        <label className="block">
          <span className="font-medium">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
          />
        </label>
        <label className="block">
          <span className="font-medium">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="mt-1 w-full rounded-xl border border-linea bg-white px-4 py-3 text-base"
          />
        </label>
        {aviso && (
          <p className="text-acento" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" disabled={entrando} className="w-full rounded-xl bg-acento py-3.5 font-semibold text-white disabled:opacity-50">
          {entrando ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <button type="button" onClick={olvide} className="mt-6 font-medium text-acento underline">
        Olvidé mi contraseña
      </button>
    </main>
  );
}
