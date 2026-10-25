import { NOMBRE } from "../../compartido/marca";

// Actualización 0: solo la base. El pedido de envío llega en la actualización 1.
export default function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <p className="text-sm font-semibold tracking-widest text-acento uppercase">En construcción</p>
      <h1 className="mt-3 text-4xl font-bold">{NOMBRE}</h1>
      <p className="mt-4 text-lg text-suave">Mandados y envíos en moto por Merlo. Muy pronto vas a poder pedir desde acá.</p>
    </main>
  );
}
