# Zapp Cell Style Studio

Turns app designs (screenshots or Figma frames) into a gallery of importable Zapp mobile cell styles, with a
side-by-side report of the designs against the built cells: what works, what changed to fit the cell framework,
why, and the suggested alternative.

It is standalone: everything it knows about the Zapp cell framework is in `knowledge/` and `engine/`, bundled
into the published page. Nothing depends on a chat history.

Published studio: https://claude.ai/artifact/Aunc4iaEei9ubCxUiQr9cs (private until shared).

## How it works

1. **Designs**: upload phone or tablet screenshots, or paste a Figma link (uses the viewer's Figma connector on
   claude.ai to export the frames).
2. **Find cells**: for each screen, the page asks Claude (through the artifact's `sample` capability, with the
   image) to describe every distinct cell style, following `knowledge/rules.md`, in the format in
   `knowledge/schema.md`, using `knowledge/examples.json` as worked examples.
3. **Build**: `src/convert.js` turns each description into a build spec; the cell engine
   (`engine/template.html`, the Zapp cell preview, running in a hidden frame) builds the cell style JSON with
   `engine/lib/tokens.mjs` from the plugin templates in `engine/bases/`, renders it, and snapshots it.
4. **Review**: gallery of original vs built, an inspector per cell (type, result, decisions, data keys, full
   description editable and rebuildable).
5. **Download**: a zip (one folder per cell: JSON, README with the decisions, 500x280@2x thumbnail, overlay PNG
   when there's a gradient) and a PDF report.

## Repo

| Path | What |
|---|---|
| `knowledge/rules.md` | The framework rules Claude follows. **Edit this to teach the studio something new.** |
| `knowledge/schema.md` | The cell description format Claude answers in (and the converter reads). |
| `knowledge/examples.json` | Worked examples from a reviewed build; also the studio's opening example cells. |
| `src/index.html`, `src/studio.js` | The studio page and its logic. |
| `src/convert.js` | Description -> build spec. Runs in the page and in Node. |
| `engine/` | The cell engine: preview template (with `window.CellEngine`), builder library, plugin templates (16.0.0-alpha exports), tokens, action assets. |
| `tools/build.py` | Builds `dist/` (what gets published). |
| `tools/test.mjs` | Builds every example through the converter and builder in Node. |

## Build, test, publish

```
python3 tools/build.py          # writes dist/
node tools/test.mjs             # converter + builder check (or pass a descriptions JSON)
```

Publish `dist/index.html` as a claude.ai artifact with `dist/studio.js`, `dist/convert.js`, `dist/knowledge.js`
and `dist/engine.js` as supporting files, and these capabilities:

```json
{ "sample": { "images": true }, "downloads": true,
  "mcp": { "servers": [{ "server": "Figma", "tools": ["create_session", "get_metadata", "get_screenshot"] }] } }
```

## Scope

Version 1: mobile (phone and tablet), Cell 1, Cell 2, Cell 3 and Group Info. Colours and type are taken from the
design (no design-token mapping). Next: components, plugins, layouts, web, TV.
