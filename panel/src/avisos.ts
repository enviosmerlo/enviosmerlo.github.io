// Aviso de pedido nuevo: sonido, vibración (solo Android) y pantalla siempre prendida.
// Los navegadores no dejan sonar sin un toque previo, y en iPhone la pantalla bloqueada o la pestaña en segundo
// plano cortan el audio: por eso el botón "Activar avisos" vuelve a aparecer cuando algo de esto se pierde.
// Sin servidor no hay aviso con el celular bloqueado; para eso está el botón de WhatsApp del cliente.

let audio: AudioContext | null = null;
let pantalla: WakeLockSentinel | null = null;

function bip(cuando = 0) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.frequency.value = 880;
  vol.gain.setValueAtTime(0.4, audio.currentTime + cuando);
  vol.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + cuando + 0.25);
  osc.connect(vol).connect(audio.destination);
  osc.start(audio.currentTime + cuando);
  osc.stop(audio.currentTime + cuando + 0.25);
}

// Se llama dentro del toque, y el audio va antes que nada que pueda esperar o fallar.
export function activarAvisos(alCambiar: () => void) {
  // iPhone: sin esto, la llave de silencio calla el sonido (iOS 17+).
  const sesion = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (sesion) sesion.type = "playback";
  if (!audio) {
    audio = new AudioContext();
    audio.addEventListener("statechange", alCambiar);
  }
  audio.resume().then(alCambiar, alCambiar);
  bip();
  navigator.wakeLock
    ?.request("screen")
    .then((w) => {
      pantalla = w;
      w.addEventListener("release", alCambiar);
    })
    .catch(() => {}) // batería baja o navegador sin soporte: la pantalla se puede apagar, el resto anda
    .finally(alCambiar);
}

export const estadoAvisos = () => ({
  sonido: audio?.state === "running",
  pantalla: !!pantalla && !pantalla.released,
});

let sonidos = 0;
export function sonar() {
  bip();
  bip(0.35);
  navigator.vibrate?.([200, 100, 200]);
  // Para el control automático, que no puede escuchar: cuántas veces sonó.
  document.body.dataset.sonidos = String(++sonidos);
}
