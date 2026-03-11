# Particle Carousel

A **single-file, dependency-free** demo of a particle-based logo carousel with canvas morphing transitions. Each logo is a real SVG rendered into a cloud of coloured particles. Designed to deploy instantly on **Cloudflare Pages** (or any static host).

Inspired by [Codrops/ParticleEffectsButtons](https://tympanus.net/Development/ParticleEffectsButtons/).

## Features

- **Real image sampling** — logos are inline SVGs rendered to a canvas; every non-transparent pixel becomes a coloured particle that retains the original pixel colour.
- **Spring-physics morphing** — particles spring toward their new targets with damping and subtle random drift for a floating-in-space feel.
- **Logo carousel** — Spotify → Apple Music → TikTok → YouTube (extend the `DEFAULT_LOGOS` array with any SVG, PNG, GIF, or JPEG).
- **Click · Swipe · Arrow-key** navigation between slides.
- **Drag-and-drop / file picker** — drop or load any image to instantly sample it into particles.
- **One file** — all HTML, CSS, and JS live in `index.html`; easy to read and extend.
- **No dependencies** — pure vanilla JavaScript + Canvas 2D API.
- **Responsive** — adapts to any screen size.

## Files

| File | Purpose |
|---|---|
| `index.html` | **Everything** — self-contained demo (HTML + CSS + JS inline) |
| `style.css` | Standalone CSS module (used by the modular build in `particlecarousel.js`) |
| `particlecarousel.js` | Standalone JS module (alternative modular approach) |
| `assets/` | Drop your own PNG/GIF/SVG logos here for the modular build |

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

Edit the `DEFAULT_LOGOS` array near the top of the `<script>` block in `index.html`:

```js
const DEFAULT_LOGOS = [
  {
    label: 'My Logo',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <!-- your SVG markup here -->
    </svg>`,
  },
  // …or use a remote URL (server must send Access-Control-Allow-Origin: *)
  // { label: 'Remote', url: 'https://example.com/logo.png' },
];
```

## Using Your Own Images at Runtime

Drag and drop **any PNG, JPEG, GIF, or SVG** onto the canvas, or click **📁 Load images** to open a file picker. The engine samples the image pixels into a particle cloud and morphs into it instantly.

## Tuning Physics

At the top of the `<script>` block:

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

## License

MIT
