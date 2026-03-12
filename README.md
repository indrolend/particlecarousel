# Particle Carousel

A particle-based logo carousel with canvas morphing transitions. Each logo is a real GIF from the `assets/` folder rendered into a cloud of coloured particles. Designed to deploy instantly on **Cloudflare Pages** (or any static host).

Inspired by [Codrops/ParticleEffectsButtons](https://tympanus.net/Development/ParticleEffectsButtons/).

## Features

- **Real GIF sampling** — logo GIFs from `assets/` are rendered to a canvas; every non-transparent pixel becomes a coloured particle that retains the original pixel colour.
- **Spring-physics morphing** — particles spring toward their new targets with damping and subtle random drift for a floating-in-space feel.
- **Logo carousel** — Spotify → Apple Music → TikTok → YouTube → Instagram → Bandcamp (extend the `DEFAULT_LOGOS` array in `particlecarousel.demo.js` with any GIF, PNG, or SVG in `assets/`).
- **Click · Swipe · Arrow-key** navigation between slides.
- **Drag-and-drop / file picker** — drop or load any image to instantly sample it into particles.
- **Modular** — engine in `particlecarousel.engine.js`, demo wiring in `particlecarousel.demo.js`; easy to embed in an SPA.
- **No bundler** — pure vanilla JavaScript + Canvas 2D API; works from `file://` without a server.
- **Responsive** — adapts to any screen size.

## Files

| File | Purpose |
|---|---|
| `index.html` | Demo page — HTML markup + CSS |
| `particlecarousel.engine.js` | **Canonical engine** — `ParticleCarouselEngine` class (particle physics, GIF playback, navigation) |
| `particlecarousel.demo.js` | Demo harness — default logos, UI wiring (buttons, keyboard, swipe, drag-and-drop, file picker) |
| `assets/` | GIF logo files + vendored `gifler.min.js` |

> **Quick start:** just open `index.html` in a browser — no server needed.

## Quick Start

```bash
git clone https://github.com/indrolend/particlecarousel
cd particlecarousel
open index.html          # macOS
# or:  python -m http.server 8080
```

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/) → **Create a project**.
3. Connect your GitHub repo.
4. Leave **Build command** empty and set **Output directory** to `/` (root).
5. Click **Save and Deploy**.

Your carousel will be live at `https://<project>.pages.dev`.

## Adding Your Own Logos

Drop a GIF/PNG/SVG into the `assets/` folder and add a matching entry to `DEFAULT_LOGOS` in `particlecarousel.demo.js`:

```js
const DEFAULT_LOGOS = [
  { label: 'Spotify',     src: 'assets/Spotifylogospin.gif'    },
  { label: 'Apple Music', src: 'assets/Applemusiclogospin.gif' },
  // Add your own:
  { label: 'My Brand',    src: 'assets/mybrand.gif'            },
];
```

The engine samples every non-transparent pixel of each image into a coloured particle, so the particle cloud will faithfully reflect the colours and shape of the GIF frame captured at load time.

## Using Your Own Images at Runtime

Drag and drop **any PNG, JPEG, GIF, or SVG** onto the canvas, or click **📁 Load images** to open a file picker. The engine samples the image pixels into a particle cloud and morphs into it instantly.

## Tuning Physics

At the top of `particlecarousel.engine.js`:

```js
const SPRING     = 0.055;  // pull strength toward target (higher = snappier)
const DAMPING    = 0.82;   // friction per frame (lower = bouncier)
const DRIFT      = 0.30;   // random drift while floating
const PART_SIZE  = 3.2;    // particle radius in px
```

## JavaScript API

```js
ParticleCarousel.next();          // advance to next slide
ParticleCarousel.prev();          // go to previous slide
ParticleCarousel.goTo(2);         // jump to zero-based index

// Programmatically add a slide from an HTMLImageElement
const img = new Image();
img.src = 'mylogo.png';
img.onload = () => ParticleCarousel.loadImage(img, 'My Logo');
```

For SPA usage, instantiate the engine directly:

```js
const engine = new ParticleCarouselEngine({
  particleCanvas: document.getElementById('canvas'),
  gifCanvas:      document.getElementById('gif-canvas'),
  labelEl:        document.getElementById('label'),   // optional
  dotsEl:         document.getElementById('dots'),    // optional
  countEl:        document.getElementById('img-count'), // optional
});

// slides must be pre-loaded HTMLImageElements
engine.setSlides([
  { label: 'Spotify', img: spotifyImgEl, gifSrc: 'assets/Spotifylogospin.gif' },
]);

engine.next();       // advance
engine.prev();       // go back
engine.goTo(2);      // jump to index
engine.destroy();    // clean up RAF + gifler + resize listener (SPA unmount)
```

## License

MIT
