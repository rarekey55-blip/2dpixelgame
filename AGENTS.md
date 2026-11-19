# AGENTS.md

## Project
Pixel Dash — a browser 2D pixel-art arena game. Vanilla JS/HTML/CSS, no build step, no dependencies, no external assets.

## Layout
- `index.html` — page shell, 320x180 canvas, control hint
- `style.css` — page chrome; scales the canvas with `image-rendering: pixelated`
- `game.js` — the entire game (font, sound, background, input, simulation, rendering, loop)

## Conventions
- Internal resolution is fixed at 320x180 (`W`, `H`). All drawing uses `ctx.fillRect` with integer coords for pixel art.
- Text uses the built-in 3x5 `GLYPHS` table via `text()` / `textShadow()`. Add glyphs to `GLYPHS` rather than pulling in a font.
- Sprites are drawn procedurally in `draw*` functions; there are no image files by design.
- Sound is WebAudio blips through `Sound.blip()`; keep it gesture-gated (`Sound.unlock()`).
- The simulation is fixed-step (1/60) with an accumulator; rendering is separate in `render()`.
- `update()` freezes everything while `game.state === 'pause'` — preserve that when adding features.

## Testing
There is no test framework in the repo. To verify changes, drive `game.js` headlessly:
- Node + `vm` with a stubbed `document`/canvas to exercise real state transitions (`game`, `player`, `bullets`, `enemies` are global).
- Chromium + `puppeteer-core` against a local `python3 -m http.server` to check rendering and catch page errors. Sample exact canvas pixels with `ctx.getImageData` to assert sprite colors.
