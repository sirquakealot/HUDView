# hudview

**A visual HUD editor for Quake Live, in your browser.**

Drop in your `.menu` files, see your HUD the way the game draws it, drag things where you want
them, then save. hudview rewrites only the lines you changed and leaves your comments,
indentation and ordering alone.

No install, no build step, no upload. Everything runs locally and your files never leave your
machine.

**[Open hudview](https://sirquakealot.github.io/HUDView/)**

---


## What it does

The preview is a 16:9 canvas with the real game icons, flags and HUD graphics, with text
placement measured against game screenshots, and you can load a screenshot of your own as the
background. Drag, resize and nudge elements with snap guides to other elements and the
widescreen band, and edit every property in a typed editor with color pickers, `addColorRange`
lists and `ownerdrawflag` chips. Toggle an element per gametype and hudview writes the
`ownerdrawflag`, `cvarTest`, `showCvar` and `hideCvar` lines for you. Change gametype, team,
health, ammo, scores or any cvar your HUD checks and watch the HUD react. Saving rewrites only
the lines you touched, with a diff preview, a layer list, undo and redo, and checks for the
things that fail silently in game.

## Getting started

Open the [hosted version](https://sirquakealot.github.io/HUDView/) and drag your `.menu` files
onto the page, or clone the repo and open `index.html`.

```
git clone https://github.com/sirquakealot/HUDView.git
```

Your HUD lives in `baseq3/ui/`, usually `hud.menu`. Many HUDs are split across several files,
so drop them in together to see the full picture.
