import { useState } from "react";
import Formulario from "./Formulario";
import Seguimiento from "./Seguimiento";

const CLAVE = "ultimoPedido";

// El último pedido se recuerda en el teléfono para el atajo "Ver mi último pedido". Si el navegador no deja
// guardar (modo privado, datos borrados), solo se pierde ese atajo: el link sigue funcionando.
function leerUltimo() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

// Con ?pedido=<id> se ve el seguimiento; sin eso, el formulario.
export default function App() {
  const [id, setId] = useState(() => new URLSearchParams(location.search).get("pedido"));

  function alCrear(nuevo: string) {
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // ver leerUltimo
    }
    // La dirección pasa a ser el link del pedido: recargar o guardarla en favoritos vuelve al seguimiento.
    history.replaceState(null, "", `?pedido=${nuevo}`);
    setId(nuevo);
  }

  return id !== null ? <Seguimiento id={id} /> : <Formulario ultimo={leerUltimo()} alCrear={alCrear} />;
}
