# AURA LEGENDS

Juego web de batallas de stickmans basado en memes, gestos virales, humillaciones y poderes de aura.
Phaser 3 + JavaScript (ES modules) + Vite. Todo el arte, la música phonk y los efectos de sonido se generan por código: no hay recursos externos.

## Ejecutar

```bash
npm install
npm run dev        # servidor de desarrollo
npm run build      # build de producción en dist/
npm test           # pruebas de la simulación (IA vs IA, integridad de datos)
```

## Controles (personalizables en Ajustes)

| Acción | Tecla |
| --- | --- |
| Moverse / saltar / agacharse | Flechas (doble salto en el aire) |
| Ataque rápido / fuerte | Z / X (con dirección: ↓Z, ↓X lanzador, →X, ←X barrida) |
| Especial | C, →C, ↓C |
| Habilidades | A, S |
| Ultimate | D (100 de energía) |
| Dash / esquiva | Shift (+dirección) |
| Bloqueo / Parry | Espacio (parry: justo antes del impacto) |
| Aura Burst | Shift + Espacio durante un combo recibido |
| Pausa | Esc / P |

## Arquitectura

- `src/sim/` — simulación determinista a 60 Hz sin dependencias de Phaser: luchadores (máquina de estados, físicas, buffer de entradas, cancelaciones), batalla (hitboxes, bloqueo por alturas, parry, contras, proyectiles, agarres/cinemáticas, rondas), ~100 movimientos, estados alterados e IA.
- `src/view/` — renderizado vectorial de stickmans, escenarios procedurales, partículas y efectos, cámara dinámica.
- `src/core/` — entrada (teclado/mando), guardado local, audio sintetizado (WebAudio) y construcción de combates.
- `src/scenes/` — menús, combate, HUD, pausa, resultados.
- `src/data/` — bots (100+), Camino del Aura, rangos, logros, tienda y cosméticos.
