# SPEC 02 — Power pellets y modo asustado

> **Estado:** Implemented
> **Depende de:** SPEC 01 (cuatro fantasmas con modos pen/exit/chase)
> **Fecha:** 2026-11-14
> **Objetivo:** Añadir 4 power pellets que activan 6 segundos de modo asustado: los fantasmas se vuelven azules, huyen más lento, y Pacman puede comerlos (cadena 200/400/800/1600), enviando sus ojos de regreso a la pen para revivir.

---

## Alcance

**In:**

- 4 power pellets (tile nuevo `4`) en las esquinas clásicas del laberinto: (1,3), (26,3), (1,23) y (26,23), en sustitución del dot que hay en cada una de esas celdas.
- Comer un pellet: +50 puntos, cuenta para ganar (decrementa `dotsRemaining`), y activa `frightTimer = 360` frames (6 s). Si ya estaba activo, el timer se reinicia a 360 y la cadena de puntos vuelve a 200.
- Durante el timer, todos los fantasmas se asustan (incluidos los que están en `pen` y `exit`; decisión del usuario): azul, velocidad `1/14` y decisión de huida (maximizar distancia Manhattan a Pacman, sin media vuelta salvo callejón).
- Comer un fantasma asustado: cadena 200/400/800/1600 (se duplica por fantasma comido dentro del mismo periodo asustado; tope 1600), popup con el número en la celda, y el fantasma pasa a modo `eyes`.
- Modo `eyes`: dibuja solo los ojos, navega por el laberinto hacia la puerta de la pen (13,11) y desciende hasta (13,13), donde revive y sale de nuevo de inmediato (ya no asustado). Un fantasma en `eyes` no colisiona ni puede volver a comerse.
- Parpadeo de aviso: en los últimos 120 frames del timer, el fantasma asustado alterna azul/blanco cada 10 frames.
- Al terminar el timer, todos los fantasmas vuelven a color, velocidad y personalidad normales (los `eyes` completan su regreso igualmente).
- La colisión con fantasma normal (no asustado, no `eyes`) sigue quitando vida como hasta ahora.

**Fuera del alcance (para futuros specs):**

- Ciclos scatter/chase por temporizador.
- Congelar el `frightTimer` mientras los ojos regresan (el timer sigue corriendo).
- Audio, fruta bonus, niveles con dificultad creciente, soporte móvil.
- Puntos extra por comer los 4 fantasmas de un mismo pellet (bonus del arcade).

---

## Modelo de datos

```js
// maze.js — nuevo carácter en MAZE_STR: 'o' = power pellet
function parseTile(ch) {
  if (ch === '#') return 1;
  if (ch === '.') return 2;
  if (ch === '-') return 3;
  if (ch === 'o') return 4; // power pellet
  return 0;
}
```

```js
// game.js — constantes nuevas
const FRIGHT_FRAMES = 360; // 6 s a 60 fps
const FRIGHT_SPEED = 1 / 14; // fantasmas asustados (restriccion 1/N)
const GHOST_POINTS = [200, 400, 800, 1600]; // cadena por fantasma comido
```

```js
// game.js — campos nuevos en el estado de createGame()
{
  frightTimer: 0,  // frames restantes de modo asustado; 0 = inactivo
  ghostChain: 0,   // indice en GHOST_POINTS del proximo fantasma comido
  popup: null,     // { x, y, text, ttl } del ultimo fantasma comido
}
// cada fantasma gana
{
  frightened: false, // true durante el timer (excepto modo 'eyes')
}
```

Convenciones heredadas de SPEC 01: coordenadas en celdas, velocidades `1/N` con `N` entero, distancias Manhattan, `game.grid` es copia mutable de `MAZE` (los pellets viven en `game.grid`; `MAZE` no se muta).

---

## Plan de implementación

Cada paso deja el juego corriendo y verificable en el navegador (`python3 -m http.server -d src`).

1. `maze.js`: añadir `'o'` a `parseTile` (tile `4`) y reemplazar el dot de las celdas (1,3), (26,3), (1,23) y (26,23) por `o`. `render.js`: dibujar los tiles `4` como discos grandes (radio ~7px) que parpadean (visibles/invisibles cada 10 frames). Verificar: se ven 4 pellets parpadeando en las esquinas y el juego arranca sin errores.
2. `game.js`: en `movePacman`, comer tile `4`: +50 puntos, `dotsRemaining--`, `frightTimer = 360`, `ghostChain = 0`, `frightened = true` en todos los fantasmas cuyo modo no sea `eyes`. Verificar: comer un pellet vuelve azules a los fantasmas visibles durante 6 s.
3. `game.js`: en `update()`, decrementar `frightTimer` y al llegar a 0 poner `frightened = false` en todos. Cambio de velocidad solo al re-alinear: cuando el fantasma está alineado a centro de celda, su `speed` pasa a `FRIGHT_SPEED` si está asustado o a su velocidad de `GHOST_SPEEDS` si no. Verificar: el periodo asustado expira solo y los fantasmas recuperan velocidad y alineado (siguen girando bien en cruces).
4. `game.js`: en `decideGhost`, si el fantasma está asustado, elegir la dirección que maximiza la distancia Manhattan a Pacman (mismo orden de desempate up/left/down/right y regla de media vuelta actual). Verificar: los azules se alejan de Pacman en los cruces.
5. `game.js`: en `update()`, la colisión distingue: modo `eyes` → nada; asustado → comerlo (score `GHOST_POINTS[ghostChain]`, `ghostChain = min(ghostChain + 1, 3)`, `popup = { x, y, text, ttl: 30 }`, modo `eyes`, `exitPath = null`, `frightened = false`); normal → perder vida como ahora. `render.js`: dibujar el popup (texto del puntaje en la celda) mientras `popup.ttl > 0`, decrementado en `update()`. Verificar: comer un fantasma asustado suma la cadena y muestra el número en su celda.
6. `game.js`: navegación en modo `eyes` — `ghostTarget` devuelve (13,11) y `isWall` permite atravesar la puerta (3) también en modo `eyes`; al alinearse en (13,11) desciende en script hasta (13,13) (como `moveExit`), y ahí revive: modo `exit` con `penExitPath()` y `frightened = false`. Verificar: el fantasma comido regresa a la pen, revive y vuelve a salir perseguiendo.
7. `render.js`: fantasma asustado azul (`#2121de`); en los últimos 120 frames del timer alterna azul/blanco cada 10 frames; modo `eyes` dibuja solo los ojos (fondo transparente). Verificación final completa con los criterios de aceptación.

---

## Criterios de aceptación

- [ ] Se ven 4 power pellets parpadeantes en (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer un pellet suma exactamente 50 puntos y decrementa `dotsRemaining` (no se gana la partida hasta comer también los pellets).
- [ ] Al comer un pellet todos los fantasmas que no están en `eyes` se vuelven azules durante 6 segundos.
- [ ] Los fantasmas asustados se mueven a 1/14 celda/frame (notablemente más lentos que Pacman) y al terminar el timer recuperan su velocidad sin perder el alineado en cruces.
- [ ] Un fantasma asustado elige en cada cruce la dirección que maximiza la distancia Manhattan a Pacman, sin dar media vuelta salvo en callejón.
- [ ] El primer fantasma comido en un periodo suma 200; el segundo 400; el tercero 800; el cuarto (y siguientes) 1600.
- [ ] Al comer otro pellet con el timer activo, el timer vuelve a 360 y la cadena vuelve a empezar en 200.
- [ ] Al comer un fantasma aparece el número (200/400/800/1600) en su celda durante ~30 frames y desaparece.
- [ ] El fantasma comido pasa a modo ojos, regresa a la pen atravesando la puerta, revive y sale de nuevo a perseguir sin estar asustado.
- [ ] Chocar con un fantasma en modo `eyes` no produce ningún efecto.
- [ ] Chocar con un fantasma normal (no asustado) sigue restando vida y reseteando posiciones.
- [ ] En los últimos 2 segundos del timer los fantasmas asustados parpadean entre azul y blanco cada 10 frames.
- [ ] Comer un pellet no asusta a los fantasmas en modo `eyes`, y un fantasma comido no puede volver a comerse dentro del mismo periodo.
- [ ] La partida no muestra errores en consola; Pacman conserva su velocidad de 1/8.

---

## Decisiones

- **Sí:** 4 esquinas clásicas del arcade (1,3), (26,3), (1,23), (26,23). Ubicación conocida y simétrica.
- **Sí:** timer por frames (360 = 6 s), no por tiempo real. El loop no tiene dt (AGENTS.md); 360 frames es exacto a la convención del proyecto.
- **Sí:** velocidad asustada `1/14`. Cumple la restricción `1/N` y es claramente más lento que Pacman (1/8) y que los fantasmas normales (1/10-1/9).
- **Sí:** huida determinista (maximizar Manhattan) en vez de dirección aleatoria del arcade. Verificable con criterios booleanos; el aleatorio no lo es.
- **Sí:** cadena 200/400/800/1600 con tope en 1600 (arcade). `ghostChain` reinicia con cada pellet.
- **Sí:** popup del puntaje en la celda (~30 frames), un solo popup a la vez (el último). Suficiente para el efecto clásico sin introducir una lista de popups.
- **Sí:** todos los fantasmas se asustan, incluidos `pen` y `exit` (decisión explícita del usuario). En la práctica los de la pen no son comestibles porque Pacman no puede entrar; los de `exit` sí pueden comérselos cerca de la puerta.
- **Sí:** ojos que regresan a la pen y reviven saliendo de inmediato (clásico). El revivido sale con `frightened = false` aunque el timer siga activo.
- **Sí:** el tile `4` vive en `game.grid` y cuenta en `dotsRemaining`; así el estado de victoria exige comer también los pellets.
- **No:** congelar el `frightTimer` mientras los ojos regresan. Simplifica el modelo; los `eyes` completan su regreso igual.
- **No:** huida aleatoria del arcade. Descartada por no verificable; la huida por Manhattan da el mismo efecto de juego.
- **No:** puntos extra por los 4 fantasmas de un pellet, fruta, scatter/chase o audio. Cada uno, si aterriza, va en su propio spec.
- **Decisión técnica:** el cambio de velocidad (normal ↔ asustada) solo se aplica cuando el fantasma está alineado a un centro de celda. Si se cambiara a mitad de tramo, la posición dejaría de ser suma de `1/N` y el fantasma podría dejar de re-alinearse (rompiendo `decideGhost`), mismo motivo que en SPEC 01 obligó a velocidades `1/N`.
- **Decisión técnica (Paso 6, aprobada por el usuario al implementar):** los ojos navegan hacia (13,11) con **BFS** (camino más corto sobre el grid, puerta transitable, desempate up/left/down/right) en lugar del greedy de `decideGhost`: el greedy con la regla de no media vuelta se queda en ciclos estables alrededor de bloques (verificado: nunca converge desde la zona inferior izquierda). El descenso (13,11)→(13,13) y la salida revivida siguen usando el script `moveExit`/`penExitPath`.

---

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cambiar la velocidad a mitad de tramo rompe el alineado a centros de celda                              | El cambio de `speed` solo se aplica en el momento de alineación (ver Decisiones).                                                      |
| Los ojos pueden quedar atrapados si su objetivo (13,11) es inalcanzable por la regla de no media vuelta | El punto (13,11) es alcanzable por el pasillo vertical central; en callejón se permite el giro de 180 ya existente, que los saca.      |
| Comer un fantasma justo en el frame en que expira el timer                                              | La colisión se evalúa con el estado del fantasma antes de la reversión del timer; si expiró, la colisión es de pérdida de vida normal. |
| Popup de puntos tapado por el dibujo del fantasma                                                       | El popup se dibuja al final de `draw()` (después de fantasmas) y el fantasma comido está en modo `eyes`, con el cuerpo transparente.   |

---

## Qué **no** está en este spec

- Ciclos scatter/chase por temporizador.
- Congelar el timer durante el regreso de los ojos.
- Audio, fruta bonus, niveles, soporte móvil.

Cada uno de esos, si aterriza, va en su propio spec.
