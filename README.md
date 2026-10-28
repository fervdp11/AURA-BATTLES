# AURA LEGENDS

Juego web de batallas de stickmans basado en memes, gestos virales, humillaciones y poderes de aura.
Phaser 3 + JavaScript (ES modules) + Vite. Todo el arte, la música phonk y los efectos de sonido se generan
por código; las únicas dependencias empaquetadas son Phaser y dos fuentes OFL (Anton y Rubik) servidas localmente.

## Ejecutar

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # build de producción en dist/ (estático, se puede abrir desde cualquier hosting)
npm test           # pruebas: IA vs IA, todos los movimientos, supervivencia, integridad de datos
```

## Controles (personalizables en Ajustes; también funciona con mando)

| Acción | Tecla |
| --- | --- |
| Moverse / saltar / agacharse | Flechas (doble salto en el aire) |
| Ataque rápido | Z (cadena Z-Z-Z) · ↓Z patada baja · Z en el aire |
| Ataque fuerte | X · ↓X lanzador · →X embestida · ←X barrida · X en el aire: picado |
| Especiales | C, →C, ↓C |
| Habilidades | A, S |
| Ultimate | D (100 de energía, pausa cinemática) |
| Dash / esquiva | Shift (+dirección, invulnerable unos frames; también en el aire) |
| Bloqueo / Parry | Espacio (mantener = bloquear; pulsar justo antes del golpe = parry) |
| Aura Burst | Shift + Espacio mientras recibes un combo (50 de energía) |
| Pausa | Esc / P |

## Contenido

- **Combate**: aura como vida, energía especial, temporizador, rondas, combos con escalado, cancelaciones,
  lanzadores y juggles, golpes altos/medios/bajos, agarres, parries con bloqueo anti-spam, contraataques,
  armaduras, invulnerabilidad en esquivas, *counter hits*, *stale moves* (repetir una técnica reduce su daño),
  hitstop, cámara lenta, zoom y remates cinematográficos.
- **101 movimientos**: 11 básicos, 81 técnicas meme (Six Seven, Fake Handshake, Mewing, Sigma Stare, Aura Walk,
  SIUUU, Rizz, Side Eye, NPC Mode, Uno Reverse, Bro Really Thought, Nah I'd Win, Chill Guy, No Reaction,
  Fake High Five, Invisible Dap, 360 No Look, Disrespectful Dodge, Reverse Aura, Dramatic Entrance, Phantom Dap,
  Emote Cancel, Infinite Mewing, Aura Theft, Sigma Teleport, Crowd Control, Griddy, Skibidi Spin, Tung Tung Sahur,
  Bombardiro, Aura Farming, Caught in 4K, Let Him Cook, Omae Wa Mou...) y 9 ultimates (67 Barrage, Rizz Storm,
  Ultimate Nonchalance, Final Aura Judgment, Time Stop, Coffin Dance, Sigma Rule #1, Domain Expansion, Aura Overload).
  Cada una tiene animación, efectos, reglas de impacto y una forma de esquivarla o contrarrestarla (ver Lista de movimientos).
- **IA**: percibe al rival con retardo de reacción humano, juega con las mismas entradas que el jugador, 8 estilos
  (agresivo, zoner, contraataque, tramposo, agarrador, fanfarrón, chill, equilibrado), 7 niveles (NPC Despistado →
  Aura God), errores simulados, parries temporizados con disciplina ante fintas, antiaéreos, castigos, combos,
  lectura de hábitos del jugador y reparto de turnos de ataque en 1v2/1v3.
- **113 bots** con nombre, aspecto, personalidad, frase y técnicas propias, incluidos 8 jefes.
- **Modos**: Jugar (1v1, 1v2, 1v3, jefe), Camino del Aura (8 capítulos, 40 combates), Supervivencia (oleadas y jefes),
  Duelo personalizado, Entrenamiento (muñeco configurable, datos de frames, hitboxes y tutorial guiado).
- **Progresión local**: victorias, derrotas, rachas, récords, estadísticas por dificultad, rangos (Sin Aura → Aura God),
  prestigio, 31 logros, títulos, tienda de técnicas con AP, cosméticos (colores, auras, 18 accesorios) y 15 celebraciones.
- **Audiovisual**: 7 escenarios procedurales con parallax y público reactivo, auras, partículas, rayos, estelas,
  afterimages, ondas expansivas, squash & stretch, bloom, música phonk generada en tiempo real (7 pistas) y voces
  de los memes mediante síntesis de voz del navegador.

## Arquitectura

- `src/sim/` — simulación determinista a 60 Hz sin dependencias de Phaser (se prueba en Node): luchadores
  (máquina de estados, físicas, buffer de entradas, cancelaciones), batalla (hitboxes, bloqueo por alturas, parry,
  contras, proyectiles, agarres/cinemáticas, rondas, oleadas), movimientos, estados alterados e IA.
- `src/view/` — renderizado vectorial de stickmans, escenarios, efectos, cámara y traducción de eventos a audiovisual.
- `src/core/` — entrada (teclado/mando con rebind), guardado local, audio sintetizado y construcción de combates.
- `src/scenes/` — menús, VS, combate, HUD, pausa, resultados, lista de movimientos.
- `src/data/` — bots, Camino del Aura, rangos, logros, tienda, cosméticos y consejos.
