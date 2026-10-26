import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Nada de esto es secreto: viaja en el JavaScript de la página. Lo que protege los datos son las reglas (firestore.rules).
const REAL = {
  apiKey: "AIzaSyAc7B9aJn55G2K60AEeuYaweeTBjHVhJCo",
  authDomain: "envios-merlo.firebaseapp.com",
  projectId: "envios-merlo",
  storageBucket: "envios-merlo.firebasestorage.app",
  messagingSenderId: "880625008206",
  appId: "1:880625008206:web:87019ab8dc5a2ff183cd1f",
};

const PRUEBAS = {
  apiKey: "AIzaSyDFhqkuPvCp4UPf93UOZhACTf6bvyxdkhI",
  authDomain: "envios-merlo-pruebas.firebaseapp.com",
  projectId: "envios-merlo-pruebas",
  storageBucket: "envios-merlo-pruebas.firebasestorage.app",
  messagingSenderId: "1035722842341",
  appId: "1:1035722842341:web:c65ddcea0128d83dbaf40c",
};

// La lista es de los dominios REALES, a propósito: un dominio inesperado (localhost, el del control automático,
// uno nuevo) cae en pruebas y se ve vacío, en vez de escribir en silencio en los datos reales.
// Con el dominio propio (Actualización 4) hay que sumarlo acá; el control contra la dirección publicada lo avisa.
// enviosmerlo.github.io es una dirección solo de esta app: la sesión del operador no la comparte con otras páginas.
const DOMINIOS_REALES = ["enviosmerlo.github.io"];

const config = DOMINIOS_REALES.includes(location.hostname) ? REAL : PRUEBAS;
// scripts/verificar.py lee esta línea para saber a qué base se conectó antes de crear un pedido.
console.info(`Firebase: conectado a ${config.projectId}`);

// Auth la arma solo el panel (panel/src/auth.ts): el cliente no carga ni usa la sesión del operador.
export const app = initializeApp(config);
export const db = getFirestore(app);
