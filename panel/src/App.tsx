import { NOMBRE } from "../../compartido/marca";

// Actualización 0: solo la base. El panel del operador llega en la actualización 2.
export default function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold tracking-widest text-acento uppercase">Panel</p>
      <h1 className="mt-3 text-4xl font-bold">{NOMBRE}</h1>
      <p className="mt-4 text-lg text-suave">Acá vas a ver y asignar los pedidos.</p>
    </main>
  );
}
