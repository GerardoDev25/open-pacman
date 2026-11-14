# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Approved
> **Depende de:** ninguno (primer spec del proyecto)
> **Fecha:** 2026-11-12
> **Objetivo:** Tener 4 fantasmas con la personalidad clásica del arcade (Blinky agresivo, Pinky emboscador, Inky flanqueador, Clyde tímido), salida escalonada de la pen por dots comidos y Blinky levemente más rápido.

---

## Alcance

**In:**

- Reemplazar los 2 fantasmas actuales (`hunter` + `random`) por 4 fantasmas: Blinky (`hunter`, agresivo), Pinky (`ambusher`), Inky (`flanker`) y Clyde (`shy`).
- Los 4 empiezan dentro de la pen y salen escalonados según dots comidos: Pinky al 0, Inky al 30, Clyde al 60 y Blinky al 90.
- Blinky con velocidad levemente mayor (1/9 celda/frame) que el resto (1/10).
- Personalidades clásicas de decisión en los cruces, sin dar media vuelta salvo en callejón.
- La puerta de la pen es transitable solo para el fantasma que está saliendo; nadie en persecución reentra.
- Orden de colores arcade: Blinky rojo, Pinky rosa, Inky cian, Clyde naranja.
- Al perder una vida, los fantasmas que ya habían salido reintentan salida de inmediato.

**Fuera del alcance (para futuros specs):**

- Modo asustado (power pellets, fantasmas azules comestibles).
- Ciclos scatter/chase alternados del arcade (Clyde usa su esquina como pseudo-scatter puntual).
- Niveles, audio, móvil, edición visual del laberinto.

---

## Modelo de datos

```js
// maze.js — reemplaza GHOST_STARTS (orden del array = orden de dibujo)
const GHOST_STARTS = [
  { x: 14, y: 13, kind: 'hunter' }, // Blinky — pen, fila superior derecha
  { x: 13, y: 13, kind: 'ambusher' }, // Pinky  — pen, fila superior izquierda
  { x: 13, y: 15, kind: 'flanker' }, // Inky   — pen, fila inferior izquierda
  { x: 14, y: 15, kind: 'shy' }, // Clyde  — pen, fila inferior derecha
];
```

```js
// game.js — constantes nuevas
const GHOST_SPEEDS = {
  hunter: 1 / 9,
  ambusher: 1 / 10,
  flanker: 1 / 10,
  shy: 1 / 10,
};
const GHOST_RELEASE_AT = { ambusher: 0, flanker: 30, shy: 60, hunter: 90 }; // dots comidos
```

```js
// game.js — cada fantasma en createGame() gana estos campos
{
  x, y,
  dir: 'up',
  speed,            // según kind, de GHOST_SPEEDS
  kind,             // 'hunter' | 'ambusher' | 'flanker' | 'shy'
  mode: 'pen',      // 'pen' (esperando) | 'exit' (hacia la puerta) | 'chase'
  releaseAt,        // dots comidos necesarios para salir
}
```

Convenciones: coordenadas en celdas con origen arriba-izquierda; velocidades en celdas/frame siempre como `1/N` con `N` entero (ver Decisiones); distancias de decisión con Manhattan.

---

## Plan de implementación

Cada paso deja el juego corriendo y verificable en el navegador (`python3 -m http.server -d src`).

1. `maze.js`: ampliar `GHOST_STARTS` a 4 fantasmas con los `kind` nuevos. El juego corre con 4 fantasmas (los `kind` aún no reconocidos caen al comportamiento aleatorio actual).
2. `render.js`: reordenar `GHOST_COLORS` a `[rojo, rosa, cian, naranja]` para que coincida con el orden del array de fantasmas (Blinky/Pinky/Inky/Clyde).
3. `game.js`: `GHOST_SPEEDS` por `kind` aplicado en `createGame()`; quitar la velocidad global única de fantasmas.
4. `game.js`: modo de fantasma (`pen`/`exit`/`chase`) con liberación por dots comidos, salida en script hacia la celda (13,13) y subida por la puerta hasta (13,11); ajustar `isWall` para que la puerta (3) bloquee a Pacman y a fantasmas en `chase`, pero no al fantasma en `exit`.
5. `game.js`: personalidades en `decideGhost()` — `hunter` ya existe (distancia Manhattan a Pacman); añadir `ambusher` (objetivo 4 celdas delante de Pacman según su `dir`), `flanker` (doble del vector Blinky→punto 2 delante de Pacman) y `shy` (persigue si Manhattan > 8, si no va a su esquina (1,29)). Orden de prioridad en empates: up, left, down, right.
6. `game.js`: `resetPositions()` tras muerte — todos vuelven a su celda de inicio con `mode: 'pen'`, pero si su `releaseAt` ya fue alcanzado reintentan salida de inmediato.

---

## Criterios de aceptación

- [ ] Se dibujan 4 fantasmas con colores rojo, rosa, cian y naranja.
- [ ] Al iniciar la partida los 4 están dentro de la pen y Pinky sale al instante; Inky, Clyde y Blinky siguen dentro.
- [ ] Al comer el dot 30 sale Inky; al 60 Clyde; al 90 Blinky.
- [ ] Blinky se mueve a 1/9 celda/frame (notablemente más rápido que los otros tres y siempre más lento que Pacman).
- [ ] Blinky elige en cada cruce la dirección que minimiza la distancia Manhattan a Pacman.
- [ ] Pinky dirige su recorrido hacia 4 celdas por delante de Pacman en la dirección en que mira (se nota al girar: Pinky corta el paso).
- [ ] Inky se dirige hacia el punto resultante de duplicar el vector Blinky→(2 celdas delante de Pacman), flanqueando desde el lado de Blinky.
- [ ] Clyde persigue a Pacman si está a más de 8 de distancia Manhattan y se retira hacia la celda (1,29) si está a 8 o menos.
- [ ] Ningún fantasma da media vuelta en un cruce, salvo en callejón sin salida.
- [ ] Ningún fantasma en modo `chase` reentra en la pen por la puerta.
- [ ] Tras perder una vida, los fantasmas que ya habían salido vuelven a salir de inmediato; los que no, esperan su umbral.
- [ ] La partida no muestra errores en consola y Pacman conserva su velocidad de 1/8.

---

## Decisiones

- **Sí:** personalidades clásicas del arcade (hunter/ambusher/flanker/shy). Cada uno se siente distinto y son bien documentados.
- **Sí:** salida escalonada controlada por dots comidos (0/30/60/90). Decisión explícita del usuario tras descartar "por frames" y "Blinky ya fuera".
- **Sí:** los 4 fantasmas empiezan dentro de la pen, incluido Blinky. Decisión del usuario (no arcade puro).
- **Sí:** velocidades como `1/N` (Blinky `1/9`, resto `1/10`). Con `0.11` el fantasma nunca re-alinearía a centros de celda (el alineado exige sumas exactas), rompiendo `decideGhost` en los cruces.
- **Sí:** la puerta bloquea a todo actor salvo el fantasma en modo `exit`. Evita que los fantasmas se escondan en la pen.
- **No:** modo asustado / power pellets. El laberinto actual no los tiene; va en un spec futuro.
- **No:** ciclos scatter/chase globales. Clyde usa su esquina como pseudo-scatter puntual; suficiente para diferenciarlo.
- **No:** el bug clásico de Pinky (al mirar arriba apunta 4 arriba + 4 a la izquierda). Pinky usa exactamente 4 delante.
- **No:** el fantasma `random` desaparece; los 4 tienen comportamiento determinista.

---

## Riesgos

| Riesgo                                                               | Mitigación                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 4 fantasmas vuelven el inicio muy difícil                            | Salida escalonada por dots (solo Pinky al 0; Blinky, el agresivo, sale al 90) y Blinky a 1/9 sigue escapable en línea recta. |
| Inky depende de la posición de Blinky mientras Blinky está en la pen | Se usa su celda real dentro de la pen igualmente; el objetivo solo degrada la calidad del flanqueo, no rompe nada.           |
| Cambiar velocidades rompe el alineado a centros de celda             | Restricción dura `1/N` con `N` entero, documentada en Decisiones.                                                            |

---

## Qué **no** está en este spec

- Modo asustado y power pellets (otro spec si alguna vez aterriza).
- Ciclos scatter/chase por temporizador.
- Niveles progresivos, audio o soporte móvil.

Cada uno de esos, si aterriza, va en su propio spec.
