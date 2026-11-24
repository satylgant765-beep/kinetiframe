# Temirlan Animation Studio (web / PWA)

A mobile-first 2D animation editor that runs in the browser and installs on Android as an app (PWA).
It is a separate web project inside this repository and does not touch the Android (Kotlin) app.

## Features (v1)

- Drawing canvas with touch, pen and mouse input; smooth brush and a real eraser that cuts strokes
- Shapes (rectangle, rounded, circle, triangle, star, heart, arrow, line) and five cartoon characters
  (cat, robot, kid, monster, bird) with colours and moods
- Select, move, rotate and scale with handles, or with two fingers; duplicate, flip, reorder, delete
- Timeline with frame thumbnails: add, duplicate, delete and reorder frames, onion skin, loop, frame rate
- Layers: add, rename, reorder, hide, lock, opacity, delete
- Play / pause
- Undo / redo, autosave, saved projects list in the browser, project file download and import
- Video export (MP4 where the browser supports it, otherwise WebM), PNG export of a frame
- Works offline after the first visit; can be installed to the home screen

## Run locally

No build step and no dependencies. Serve the `web/` folder with any static server, for example:

```sh
python3 -m http.server 8765 --directory web
```

Then open <http://localhost:8765/>.

## Tests

```sh
node --test web/tests/model.test.mjs          # model and geometry unit tests
node web/tests/e2e.cjs http://localhost:8765/  # end-to-end test in Chromium (needs Playwright)
```

## Code layout

| Folder | Contents |
| --- | --- |
| `js/core` | Project model, scene objects and geometry, store with undo/redo, player |
| `js/render` | Canvas rendering of frames, shapes and characters |
| `js/ui` | Components: stage, toolbar, timeline, layers, properties, insert sheet, context bar, project menu, export dialog |
| `js/services` | Browser storage (IndexedDB) and video export (MediaRecorder) |
| `sw.js`, `manifest.webmanifest` | Offline support and install metadata |

When you change any file, bump `VERSION` in `sw.js` so installed apps pick up the update.
