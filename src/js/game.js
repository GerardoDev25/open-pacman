// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
// Velocidades por kind, siempre 1/N con N entero para re-alinear a centros
// de celda (ver Decisiones de SPEC 01). Blinky levemente mas rapido.
const GHOST_SPEEDS = {
  hunter: 1 / 9,    // Blinky
  ambusher: 1 / 10, // Pinky
  flanker: 1 / 10,  // Inky
  shy: 1 / 10,      // Clyde
};
// Dots comidos que necesita cada fantasma para salir de la pen.
const GHOST_RELEASE_AT = { ambusher: 0, flanker: 30, shy: 60, hunter: 90 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    dotsEaten: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEEDS[ g.kind ],
      kind: g.kind,
      mode: 'pen', // 'pen' (esperando) | 'exit' (hacia la puerta) | 'chase'
      releaseAt: GHOST_RELEASE_AT[ g.kind ],
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta (3) tambien, salvo que este
//           en modo 'exit' (es el unico que puede atravesarla).
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return actor === 'pacman' || actor.mode !== 'exit';
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
      game.dotsEaten++;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Orden de prioridad en los empates de decision: up, left, down, right.
const DIR_ORDER = [ 'up', 'left', 'down', 'right' ];

// Celda objetivo de cada personalidad (distancias Manhattan).
//   hunter:   Pacman.
//   ambusher: 4 celdas delante de Pacman segun su dir (sin el bug clasico).
//   flanker:  doble del vector Blinky->(2 delante de Pacman), flanquea desde
//             el lado de Blinky. Usa la celda real de Blinky aunque este en pen.
//   shy:      persigue a Pacman si Manhattan > 8; si no, huye a su esquina (1,29).
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  switch ( g.kind ) {
    case 'ambusher':
      return { x: px + 4 * d.x, y: py + 4 * d.y };
    case 'flanker': {
      const blinky = game.ghosts.find( ( o ) => o.kind === 'hunter' );
      const aheadX = px + 2 * d.x;
      const aheadY = py + 2 * d.y;
      return {
        x: Math.round( blinky.x ) + 2 * ( aheadX - Math.round( blinky.x ) ),
        y: Math.round( blinky.y ) + 2 * ( aheadY - Math.round( blinky.y ) ),
      };
    }
    case 'shy':
      if ( Math.abs( g.x - px ) + Math.abs( g.y - py ) > 8 ) {
        return { x: px, y: py };
      }
      return { x: 1, y: 29 };
    default: // 'hunter'
      return { x: px, y: py };
  }
}

function decideGhost( game, g ) {
  const grid = game.grid;

  // Opciones en orden de prioridad (up, left, down, right), sin media vuelta.
  const options = DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  const target = ghostTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    // '<' estricto mantiene la primera opcion en empate: orden up,left,down,right.
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Script de salida de la pen: desde su celda de inicio, subir a la fila 13,
// centrarse bajo la puerta (13,13) y subir por la puerta hasta (13,11).
function penExitPath( g ) {
  const path = [];
  if ( Math.round( g.y ) !== 13 ) path.push( { x: g.x, y: 13 } );
  if ( Math.round( g.x ) !== 13 ) path.push( { x: 13, y: 13 } );
  path.push( { x: 13, y: 11 } );
  return path;
}

// Avance en script hacia el waypoint actual (un eje por vez). Los waypoints
// son celdas enteras y la velocidad es 1/N, asi que el fantasma se re-alinea
// exactamente al llegar (con snap por error de punto flotante).
function moveExit( g ) {
  const w = g.exitPath[ 0 ];
  const EPS = 1e-3;

  if ( Math.abs( g.x - w.x ) > EPS ) {
    const step = Math.min( g.speed, Math.abs( g.x - w.x ) );
    g.dir = w.x > g.x ? 'right' : 'left';
    g.x += ( w.x > g.x ? 1 : -1 ) * step;
  } else {
    g.x = w.x;
    if ( Math.abs( g.y - w.y ) > EPS ) {
      const step = Math.min( g.speed, Math.abs( g.y - w.y ) );
      g.dir = w.y > g.y ? 'down' : 'up';
      g.y += ( w.y > g.y ? 1 : -1 ) * step;
    } else {
      g.y = w.y;
      g.exitPath.shift();
      if ( !g.exitPath.length ) {
        // Salio de la pen: pasa a perseguir.
        g.mode = 'chase';
        g.dir = 'left';
      }
    }
  }
}

function moveGhost( game, g ) {
  if ( g.mode === 'pen' ) return; // esperando su turno de salida
  if ( g.mode === 'exit' ) {
    moveExit( g );
    return;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.mode = 'pen';
    g.exitPath = null;
    // Si su umbral de salida ya fue alcanzado, el chequeo de liberacion en
    // update() los re-emite de inmediato en el proximo frame.
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  // Liberacion por dots comidos: un fantasma en 'pen' sale al alcanzar
  // su umbral (Pinky 0, Inky 30, Clyde 60, Blinky 90).
  for ( const g of game.ghosts ) {
    if ( g.mode === 'pen' && game.dotsEaten >= g.releaseAt ) {
      g.mode = 'exit';
      g.exitPath = penExitPath( g );
    }
  }

  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
