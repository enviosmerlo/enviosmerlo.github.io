import { getAuth } from "firebase/auth";
import { app } from "../../compartido/firebase";

// Solo el panel usa sesión. La sesión queda guardada en el navegador hasta tocar "Salir".
export const auth = getAuth(app);
auth.languageCode = "es"; // el mail de "olvidé mi contraseña" sale en castellano
