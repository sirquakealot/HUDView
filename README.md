# hudview

**A visual HUD editor for Quake Live, right in your browser.**

Drop in your `.menu` files and see your HUD the way the game draws it. Drag things where you want them, tweak every property, pick the game modes each element shows up in, then save. hudview writes back only the lines you changed. Your comments, formatting and ordering stay exactly as they were.

No install, no build step, no upload. Everything runs locally, and your HUD files never leave your machine.

**▶ [Open hudview](https://sirquakealot.github.io/HUDView/)**

---

## Why

Editing a Quake Live HUD usually goes like this: change a number, launch the game, `loadhud`, squint, alt-tab, repeat. hudview gives you the preview right next to the file, so you can see what you're changing while you change it.

## Features

### 🎯 An accurate preview
- A **16:9 preview** with the real in-game icons, flags, powerups, weapon icons and HUD graphics
- **Text placement measured against real game screenshots**, including the engine's baseline quirks for health, armor and ammo
- `widescreen` modes (left / center / right / stretched) handled per block, with the 640-unit center band shown as a guide
- Colors, `addColorRange`, `textstyle` shadows, borders and fills rendered the way the engine tints them
- You can load a **screenshot of your own** as the background and line your HUD up against it

### 🖱️ Direct manipulation
- **Drag** to move and use the handles to resize
- **Snap guides** to other elements' edges and centers, the screen center and the widescreen band
- Arrow keys **nudge by 1 unit**
- Box select, Ctrl+click for multi-select, **align and distribute**, and match width or height
- Pan with Space or the middle mouse button, and zoom with Ctrl+scroll

### 🛠️ Edit every property
- A typed editor for everything: color pickers with alpha, `addColorRange` lists, `ownerdrawflag` chips, `textstyle`, `align`, fonts, images with autocomplete, and more
- Copy and paste properties or positions between elements
- **Insert common HUD objects** in one click (health, armor, ammo, scores, timer, flags, powerups, chat and more)
- **Copy elements between HUDs**: open two `.menu` files and move items across while they keep their on-screen position

### 🎮 Game mode control
- Toggle each element on or off for **FFA, Duel, Race, TDM, CA, CTF, 1F, Harvester, FT, Dom, A&D and Red Rover**
- hudview works out the right `ownerdrawflag` / `cvarTest` / `showCvar` / `hideCvar` lines for you and shows exactly what will be written

### 🧪 Live simulation
- Switch the gametype, your team, health, armor, ammo, weapon, scores and players alive, and watch the HUD react
- Game state toggles: warmup, leading, carrying the flag, chat visible, and flag status
- hudview **picks up every cvar your HUD actually checks**, so you can flip them and see what appears

### 🗂️ Layers
- Every block and element in draw order, with **filter, "visible only" and "changed only"**
- An **eye toggle** hides elements in the editor only, so you can get at whatever is underneath
- **"Stacked here"** lists everything under your cursor, so covered elements are always one click away

### 💾 Saving that respects your file
- **Line-level saving**: only the lines you changed are rewritten, and comments, indentation and order stay untouched
- A **diff preview** of every file before you save
- Several changed files download together as `hud.zip`
- Files are read and written as Latin-1, the same as the game

### ✅ Built-in checks
hudview flags things that fail silently in game: missing rects, elements far off-screen, zero-size fills, conditions that can never be true, item and block modes that never overlap, more than 10 color ranges, missing images and more.

### ↩️ Safety net
- Full **undo / redo**
- Your session is saved in the browser, so an accidental reload won't eat your work

## Getting started

**Online:** open the [hosted version](https://sirquakealot.github.io/HUDView/) and drag your `.menu` files onto the page.

**Offline:** clone the repo and double-click `index.html`. That's all it takes.

```
git clone https://github.com/sirquakealot/HUDView.git
```

Your HUD files are in `baseq3/ui/` (for example `hud.menu`). Many HUDs are split across several files, so drop them in together to see the full picture.

## Shortcuts

| Key | Action |
|---|---|
| Drag | Move / resize |
| `↑ ↓ ← →` | Nudge by 1 |
| `Ctrl` + click | Add to selection |
| `Ctrl` + `A` | Select all visible |
| `Ctrl` + `D` | Duplicate |
| `Ctrl` + `C` / `V` | Copy / paste properties |
| `Del` | Delete |
| `Ctrl` + `Z` / `Y` | Undo / redo |
| `Ctrl` + `S` | Save |
| `Space` + drag | Pan |
| `Ctrl` + scroll | Zoom |
| `F` | Fit to window |
| `Alt` while dragging | Turn off snapping |
| `Esc` | Clear selection |

## Project layout

```
index.html          UI and styles
core.js             parser, property catalog, save logic, checks (no DOM)
app.js              preview, panels, mouse and keyboard
assets/game/        HUD graphics and their index
assets/backgrounds/ preview backgrounds
```

Plain HTML, CSS and JavaScript, with no frameworks and no dependencies.

## Disclaimer

hudview is a fan-made tool. It isn't affiliated with or endorsed by id Software, Bethesda or ZeniMax. Quake and Quake Live are trademarks of their respective owners, and all game graphics belong to them.
