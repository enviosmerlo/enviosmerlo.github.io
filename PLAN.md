# Plan: app de envíos en moto para Merlo (servicio propio)

> Registro que ve Matías (se tilda cada paso con su fecha): https://claude.ai/artifact/KRhypxpkmUw2q9bVZVG1Q9
> Doc de Claude Docs: project 953799dd-fa09-488b-931a-0f0c5e488f56 · nodo de la pestaña fb5f394b-821e
> Al terminar cada paso: tildarlo en el doc (listItem `checked: true`) y sumar una fila al Registro (lo más nuevo arriba).

## Estado al 25/10/2026

- **Actualización 0 terminada. Actualización 1 publicada**, salvo dos datos que tiene que pasar Matías:
  la tarifa (`TARIFA` en `compartido/precio.ts`; hasta entonces el precio dice "a confirmar por WhatsApp") y el
  WhatsApp del servicio (`WHATSAPP` en `compartido/marca.ts`; hasta entonces el botón no aparece). Sigue la Actualización 2.
- Repo público `matitrova/envios` (la cuenta de GitHub es `matitrova`; `matitrovato` es solo el usuario de la Mac).
  Cada push a `main` publica solo con Actions (`.github/workflows/publicar.yml`), con `scripts/chequeos.ts` antes del build.
- Dirección provisoria: https://matitrova.github.io/envios/ (cliente) y https://matitrova.github.io/envios/panel/ (panel).
- Firebase (cuenta de Google de Matías, plan Spark, sin Analytics ni Gemini): `envios-merlo` (real) y
  `envios-merlo-pruebas`. Firestore Standard en `southamerica-east1` en los dos (São Paulo: desde San Luis respondió
  ~10 ms más rápido que Santiago). App web `envios-web` registrada en cada uno; la config está en `compartido/firebase.ts`,
  que elige el proyecto por dominio (solo `matitrova.github.io` va al real).
- Reglas (`firestore.rules`): el link `?pedido=<ID>` es la llave (get público, list/update/delete negados), create validado.
  Se suben con `npm run reglas:pruebas` / `npm run reglas:real` (Firebase CLI con versión fija, el proyecto escrito
  entero; sin `firebase use` ni `.firebaserc`, para que nada caiga en el real por descuido).
- Cómo se prueba (nunca contra el real):
  - `python3 scripts/probar_reglas.py`: 31 casos con escrituras de verdad en pruebas, sin sesión.
  - `npm run build && ../Test1_Inmo/.venv/bin/python scripts/verificar.py`: pedidos de verdad en pruebas, en celular
    (GPS y toque en el mapa) y computadora (solo referencias y corte de señal), y el link en un navegador limpio.
  - `URL=https://matitrova.github.io/envios/ ../Test1_Inmo/.venv/bin/python scripts/verificar.py`: la dirección real,
    solo lectura (no confirma pedidos); corta si al real le faltan las reglas.
- Pendiente anotado: App Check (reCAPTCHA) antes del piloto; el JS del cliente pesa ~193 kB comprimido (Firebase + Leaflet).


## Contexto

Elegiste hacer la app y operar vos el servicio, en vez de vendérsela a tu amigo. Lo que definiste:

- **Arranca con mandados y envíos.** Paquetes, compras y pedidos de negocios. Los pasajeros se suman
  después, con la habilitación y el seguro.
- **Precio por kilómetro.**
- **Nombre provisorio.** El definitivo se elige en la actualización de marca.
- **Todo planificado y dividido en actualizaciones.** Cada paso se tilda con su fecha a medida que se
  termina, en un doc que abrís desde el celular. Así queda el registro de todo lo que se hizo.

La meta de este plan es salir con una prueba piloto con 2 o 3 motoqueros y medir cuántos pedidos
entran por día, antes de invertir más.

## Cómo funciona

1. El cliente pide el envío desde el celular, sin descargar nada.
2. El pedido aparece en tu panel.
3. Le asignás un motoquero y le mandás el pedido por WhatsApp con un toque.
4. El cliente ve en su pantalla cómo cambia el estado: recibido, asignado, en camino, entregado.

La pantalla propia del motoquero y su ubicación en vivo quedan para después de la prueba.

**Decisiones técnicas:**

| Tema | Qué uso | Por qué |
|---|---|---|
| La app | Una página web que se instala en el celular, con Vite, React y Tailwind | El mismo armado que tus páginas; no pasa por las tiendas de apps |
| Pedidos en vivo y tu usuario | Firebase (base de datos en tiempo real y login) | Ya lo usaste en MojonApp y el plan gratis alcanza para la prueba |
| Mapa | OpenStreetMap con Leaflet | Gratis; Google Maps cobra según el uso |
| Kilómetros | Distancia en línea recta × un factor por las calles (empieza en 1,3) | No usa ningún servicio pago. Si hace falta más precisión, en una actualización se pasa al recorrido real por calle |
| Publicación | GitHub Pages, como tus páginas | Se publica sola en cada cambio; el dominio propio viene con la marca |

**Pruebas sin tocar los datos reales.** Las pruebas automáticas usan un proyecto de Firebase aparte.
En MojonApp las pruebas sobre producción dejaron la base sin cuota y casi borran datos reales.

## Las actualizaciones

Cada una termina con su control automático, capturas en celular y computadora, y los pasos tildados
con fecha en el doc de registro.

### Actualización 0: la base
- [x] Proyecto nuevo (`~/envios-merlo`, repo `matitrova/envios`) con el armado de tus páginas.
- [x] Proyecto de Firebase real y uno de pruebas. Los creo en tu Chrome con tu cuenta de Google; si
      piden algo que solo vos podés hacer, te aviso.
- [x] Publicación automática y dirección provisoria.
- [x] El doc de registro, con estas actualizaciones como listas para tildar.
- [x] El control automático de base (Playwright, celular y computadora).

### Actualización 1: el cliente pide un envío
- [x] Qué se lleva: paquete, compras, documentos o comida.
- [x] Desde dónde y hasta dónde:
  - un punto en el mapa;
  - "usar mi ubicación";
  - una referencia escrita, por ejemplo "portón verde".
- [x] Nombre, teléfono y nota.
- [ ] Precio estimado antes de confirmar: bajada + kilómetros × precio por km, con un mínimo. (Hecho y probado; falta la tarifa.)
- [x] Al confirmar queda una pantalla de seguimiento con el estado en vivo y un link para volver.
- [ ] Botón de WhatsApp al servicio como respaldo. (Hecho; falta el número.)

### Actualización 2: tu panel
- [ ] Tu usuario. La contraseña la elegís vos la primera vez; yo no la escribo.
- [ ] Pedidos en vivo con aviso sonoro.
- [ ] Asignar motoquero y botón que abre WhatsApp con el pedido armado para él.
- [ ] Cambiar estado y cancelar con motivo.
- [ ] Motoqueros: alta, baja, teléfono y si está activo hoy.
- [ ] Tarifa: bajada, precio por km, mínimo y factor por calles, editables desde el panel.

### Diseño Sierra (entre la 2 y la 3, antes de publicar el panel)
Pedido de Matías el 25/10/2026: que no parezca "hecho con IA". Eligió la dirección Sierra entre tres maquetas
(`capturas/maquetas/`, no se suben al repo), para el cliente y el panel, con los subtítulos de los tipos y sin frase bajo la marca.
- [ ] Base común: colores tierra, Alegreya y Alegreya Sans, logo provisorio y íconos propios.
- [ ] Cliente y panel rediseñados, comparados con la maqueta.
- [ ] Control automático y revisión adversarial sobre el código final, y salida al real junto con el panel.

### Pantalla del motoquero (pedido de Matías el 25/10/2026, a planificar después del diseño)
- [ ] Cuando entra un pedido, les salta a todos los motoqueros activos y lo agarra el primero que acepta.
Limitación ya conocida: que el aviso salte con el celular bloqueado necesita notificaciones push, y eso pide pasar a Blaze
(servidor propio). Que solo uno gane se puede hacer sin servidor, con una transacción de Firestore. Preguntas y plan antes de codear.

### Actualización 3: historial y caja
- [ ] Envíos por día y por motoquero.
- [ ] Total movido y tu comisión, con el porcentaje que elijas.
- [ ] Exportar a planilla.

### Actualización 4: marca y salida
- [ ] Nombre y logo definitivos, y el dominio.
- [ ] Instalable en el celular, con el ícono en la pantalla de inicio.
- [ ] Términos y política de privacidad: se guardan nombres y teléfonos de clientes.
- [ ] Flyer y página de presentación.
- [ ] Prueba piloto con 2 o 3 motoqueros, contando pedidos por día.

**Antes de salir, de tu lado:**
- consultar en la Municipalidad qué hace falta para el servicio de envíos;
- ver tu inscripción fiscal para cobrar la comisión;
- conseguir el precio real que cobran hoy por un viaje corto, para la tarifa.

## Seguridad

- Cualquiera puede crear un pedido sin cuenta, pero solo ve el suyo.
- Ver y cambiar todos los pedidos, motoqueros y la tarifa queda solo para tu usuario. Lo controlan las
  reglas de Firebase, que pruebo con una escritura de verdad con y sin sesión: un rechazo sin sesión
  no prueba que la regla exista.
- Las reglas validan los campos de cada pedido, para frenar pedidos basura.

## Cómo se verifica

- `npm run build` sin errores en cada actualización.
- Control automático en celular y computadora, contra el proyecto de pruebas:
  1. un cliente crea un pedido;
  2. aparece en el panel;
  3. se asigna;
  4. el cliente ve el cambio de estado.
  También: precio por km correcto, sin scroll horizontal y sin textos fuera de pantalla.
- Capturas que miro antes de mandártelas.
- Al terminar cada actualización: los pasos tildados con fecha en el doc de registro y la dirección
  publicada verificada por contenido.

## Queda para después de la prueba

- La ubicación en vivo del motoquero (la pantalla para aceptar pedidos se adelanta: ver arriba).
- Pasajeros, cuando haya habilitación y seguro.
- Cobro con Mercado Pago dentro de la app.
- Apps en Play Store y App Store.
