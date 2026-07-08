# Signal Core

A minimal, Galaga-style browser arcade shooter. Brutalist design: **Klein blue
background, white-only elements, thin borders, monospace UI.** No libraries, no
images beyond the app icons, no build step — just HTML, CSS, and vanilla JS on a
`<canvas>`.

## Play

Open `signal-core/index.html` in a browser, or serve the folder:

```bash
cd signal-core
python3 -m http.server 4173
# then visit http://localhost:4173
```

### Controls

**Desktop**
- Move: `A` / `D` or `←` / `→`
- Fire: `Space` (tap fast to fire faster; hold for steady autofire)
- Restart: `R`

**Mobile / touch**
- Drag anywhere to move (the ship tracks your finger)
- Hold to fire
- Tap to start / restart

## Gameplay

Faithful Galaga-style mechanics rendered in the minimalist white-on-Klein-blue style:

- **Fly-in entrances** — enemies swoop in along curved paths and settle into a
  breathing, swaying formation at the top.
- **Enemy tiers** — boss `◈` (2 HP), goei `✦`, zako `✧`, with distinct scoring.
- **Diving attacks** — enemies peel off in banking arcs, fire, then loop back and
  rejoin their formation slot.
- **Capture + dual fighter** — a boss can grab your ship with a tractor beam; shoot
  the captor to rescue it and fly two ships side-by-side with double fire.
- **Challenging stages** — every 4th stage from 3 is a no-fire bonus round; hit as
  many as you can for a `PERFECT` bonus.
- **Endless & escalating** — infinite stages, soft-capped so late play stays fair.
- Lives-only (no base), scrolling starfield, persistent high score, and a
  Galaga-style player death explosion.

## Mobile / iOS

The page is installable as a PWA. On iPhone: open it in Safari, then
**Share → Add to Home Screen** to launch full-screen in portrait. Includes
viewport/zoom lock, safe-area padding for the notch/home indicator, and a screen
wake lock during play.

## Structure

```
signal-core/
  index.html      # canvas + PWA meta tags
  style.css       # Klein-blue layout, mobile/touch hardening
  game.js         # full game engine
  manifest.json   # PWA manifest
  icon-*.png      # app icons
```
