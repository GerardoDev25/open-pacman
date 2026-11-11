# AGENTS.md — PacMan (vanilla JS)

## Run & verify

- No build, no package.json, no tests, no linter, no CI. Dependencies: none.
- Run: serve `src/` with any static server (e.g. `python3 -m http.server -d src`) and open the page. Verify manually in the browser (movement, dots, ghosts, overlay screens). There is no automated check to rely on.

## Architecture (non-obvious constraints)

- Plain `<script>` tags, **no ES modules**: files communicate via globals. Script load order in `src/index.html` is load-bearing: `maze.js → game.js → render.js → main.js`. Do not add `import`/`export` unless you also switch to `type="module"` (or a bundler).
- Ownership of files: `maze.js` = map data only; `game.js` = state/rules (game loop logic lives with `main.js`: requestAnimationFrame, keyboard, overlays); `render.js` = canvas drawing.
- `game.grid` is a mutable copy of `MAZE`; `game.js` and `render.js` read `game.grid`, never `MAZE` directly (MAZE must stay pristine for restart).
- Maze is defined as 31 strings × 28 chars in `maze.js` (`#`=wall, `.`=dot, space=empty, `-`=pen door) and parsed to numbers. Geometry assumptions elsewhere: row 14 is the tunnel row (`TUNNEL_ROW`), grid is 28×31, canvas is 28×31 cells × `TILE=20` (in `render.js`) = 560×620. If you change the maze, keep those in sync.

## Tuning gotchas

- Speeds are fractions of a cell per frame (`PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1` in `game.js`), chosen so Pac-Man aligns to cell centers every 8 frames. Changing them carelessly breaks corner-turning/alignment. Frame-based, not time-based: the loop has no dt.

## Project workflow

- This repo exists to practice **spec-driven development** (see README). Skills live under `.agents/skills/` (`spec`, `spec-impl`, from `Klerith/fernando-skills` via `skills-lock.json`), each with `SKILL.md` + template; both are explicitly invoked (`disable-model-invocation: true`). Details live in their `SKILL.md` — read it before running either flow.
- Spec lifecycle: `/spec` designs a spec → saved to `specs/NN-slug.md` (sequential zero-padded numbers from `01-`, state `Draft`). **Only the human flips the state to `Approved`** — `/spec-impl` hard-stops on anything else. Implementation happens on a branch named `spec-NN-slug` (after the spec file, no extension), one plan step at a time with pauses for diff review. Spec state becomes `Implemented` after acceptance criteria pass. Don't write code while designing a spec, and implement exactly what the spec says — spec changes go into the spec, not the code by surprise.
- `specs/.spec-config.yml` (seeded by `/spec` if missing, never overwritten): `AutoCreateBranch` (default `true`) and `AutoCommitSteps` (default `false` — the agent never commits unless the user says so).
- README, UI copy, and code comments are in **Spanish** — match that.
