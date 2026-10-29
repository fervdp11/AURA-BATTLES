# AURA LEGENDS · Online

Combates 1 contra 1 por internet con **servidor autoritativo**. El servidor está en `server/server.js`
(Node + WebSocket) y ejecuta la misma simulación que el juego (`src/sim`), sin Phaser.

> **Importante:** GitHub Pages solo sirve archivos estáticos y no puede ejecutar el servidor. Para jugar
> online hay que arrancar el servidor en algún sitio (tu ordenador, una red local o un servicio en la nube)
> y que los dos jugadores apunten a él. Mientras no haya ningún servidor configurado, el menú ONLINE lo
> indica claramente.

## Jugar en local o en una red local

```bash
npm install
```

```bash
npm start
```

`npm start` compila el juego y arranca el servidor en `http://localhost:8080`. Ese servidor sirve el juego
y el WebSocket (`/ws`) desde la misma dirección, así que no hace falta configurar nada:

1. Jugador 1: abre `http://<tu-ip>:8080`, entra en **ONLINE → CREAR SALA** y comparte el código o el enlace.
2. Jugador 2: abre el enlace (`…/?sala=CÓDIGO`) o entra en **ONLINE → UNIRSE CON CÓDIGO**.
3. Cada uno elige personaje y pulsa **LISTO**. El combate empieza a la vez para los dos.

Para desarrollar con Vite: `npm run server` en una terminal y `npm run dev` en otra (Vite reenvía `/ws` al
servidor del puerto 8080).

## Desplegar en internet

El `Dockerfile` construye el cliente, pasa las pruebas y arranca el servidor en el puerto `8080`
(variable `PORT`). La comprobación de salud está en `/health`.

- **Render**: *New + → Blueprint* sobre este repositorio (usa `render.yaml`).
- **Fly.io**: `fly launch --copy-config --no-deploy` y después `fly deploy` (usa `fly.toml`).
- **Cualquier VPS con Docker**: `docker build -t aura-legends .` y `docker run -p 8080:8080 aura-legends`.

Si el juego se sirve desde otro sitio (por ejemplo GitHub Pages), indica el servidor de una de estas formas:

- En el juego: **ONLINE → SERVIDOR** y escribe `wss://tu-servidor/ws`.
- En el enlace: `?server=wss://tu-servidor/ws` (el enlace de invitación lo incluye automáticamente).
- Al compilar: `VITE_ONLINE_URL=wss://tu-servidor/ws npm run build`.

Variables del servidor: `PORT` (8080), `MATCH_TIMER` (99 s), `MATCH_ROUNDS` (2), `RECONNECT_MS` (20000).

## Cómo funciona la red

- **Tick fijo de 60 Hz** en servidor y clientes. Cada entrada viaja con su tick y un número de secuencia,
  codificada en un entero de 24 bits, y se reenvía de forma redundante (últimas 10) para tolerar pérdidas.
- **Predicción local**: tu personaje responde al instante; el del rival usa su última entrada conocida
  (el servidor la reenvía en cuanto llega) o la prevista.
- **Reconciliación (rollback)**: cuando llega la entrada definitiva y no coincide con la prevista, el
  cliente restaura el último estado confirmado y resimula hasta el presente (menos de 1 ms). Las
  correcciones se suavizan visualmente en unos fotogramas.
- **Compensación de lag en el servidor**: guarda un historial de estados; una entrada que llega con hasta
  12 ticks de retraso se aplica en su tick real rebobinando y resimulando. Más tarde, se rechaza.
- **Validación**: el servidor rechaza entradas del futuro lejano, con bits inválidos o fuera de plazo,
  limita la frecuencia y el tamaño de los mensajes y sanea perfil, loadout y remate (la escala del
  personaje, que afecta a las hitboxes, la fija siempre el servidor). Golpes, daño, aura, habilidades,
  resultado y recompensas los calcula únicamente el servidor.
- **Sincronía**: cada 30 ticks el servidor envía el hash de su estado; si un cliente no coincide, pide una
  resincronización y reconstruye la partida a partir de todas las entradas definitivas. La simulación usa
  matemática propia determinista (sin `Math.sin`/`Math.pow` del navegador) para que Chrome, Firefox y
  Safari calculen exactamente lo mismo.
- **Reloj**: el cliente se adelanta al servidor lo justo (RTT/2 + jitter + margen) y corrige saltando o
  esperando ticks; si el equipo va lento, recupera simulando varios ticks por fotograma.
- **Desconexiones**: si un jugador se desconecta, la partida se pausa y tiene 20 s para volver (se reconecta
  solo con su token de sesión y recupera la partida completa). Si no vuelve, pierde por abandono.
  ESC dentro del combate permite abandonar (cuenta como derrota).
- **Recompensas**: el servidor las calcula y las envía con un identificador de partida; el cliente las aplica
  una sola vez. El cliente nunca envía valores de economía.
- **Ping**: el HUD muestra el ping, el jitter y un aviso de red lenta.

## Pruebas

```bash
npm test
```

Incluye `tests/online.test.js`: servidor real + dos clientes WebSocket independientes con partidas
completas, red simulada (120 ms de latencia, 40 ms de jitter y 8 % de pérdida), reconexión a mitad del
combate, abandono y rechazo de entradas imposibles; y `tests/netstate.test.js`, que comprueba que el estado
se puede copiar y restaurar a mitad de cualquier técnica sin alterar la simulación.

En el navegador se puede simular red mala con `?netsim=120,30,5` (latencia, jitter, % de pérdida).

## Limitaciones conocidas

- No hay cuentas de usuario: el progreso se guarda en el navegador de cada jugador. El servidor no puede
  comprobar qué técnicas o cosméticos ha comprado cada uno; solo valida que sean técnicas reales en su
  hueco correcto. Las recompensas online sí las decide el servidor.
- El servidor guarda las salas en memoria: si se reinicia, las partidas en curso se pierden.
