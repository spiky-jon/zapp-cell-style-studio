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
   description editable and rebuildable). Cells that are mistakes or duplicates can be removed (with undo).
5. **Consistency**: Claude lists every visible element first (the inventory) and follows the priorities in
   `knowledge/rules.md`: keep everything visible (split a block into stacked cells rather than drop a line), match
   the look, then use the fewest cells. Anything left out is listed with its reason in the log and the Screens tab.
6. **Fonts**: Claude matches each typeface to the closest Google Fonts family, with alternatives the Fonts panel
   can switch to (or any Google family typed in). Designers can add their own .ttf or .otf files on the Designs tab:
   the studio reads each file's family, PostScript name and weight, uses them in the preview and the cell JSON,
   and includes them in the download's `fonts/` folder.
7. **Icons**: Claude picks the icon library closest to the design's icon style (Lucide, Phosphor, Tabler,
   Heroicons, Material Symbols, from `knowledge/icons.json`); the icon panel switches library and colours.
   Every icon a cell uses (badges, action icons, header buttons, plugin button flavours) is drawn as a PNG @3x.
   From a Figma link, a read-only `use_figma` script finds every small instance without text in the screens (icons
   inside components included), follows each to its main component and exports it as SVG. Layer data from
   `get_metadata` can't see inside instances, so it is only the fallback (layers named like icons, rendered or cut
   from the exported screen). Icons are listed to Claude by ref (`figma:12:34`) with a numbered contact sheet. Cells use
   them instead of the library; one-colour icons are recoloured (plugin flavours), multi-colour ones kept as drawn.
   Cell badges are drawn to the design's size and shape (square, rounded or round plate behind the icon).
   Button labels use the design's wording; the zip lists the label to set on each action plugin.
   After each run, headers that sit a few points off the first item of the rail below are lined up with it.
8. **Screens**: each screen mocked up from the built cells, laid out as the components Claude described
   (single, rail, list, grid), next to the original.
9. **Download**: a zip (one folder per cell: JSON, README with the decisions and the upload field for each
   asset, 500x280@2x thumbnail, overlay PNG when there's a gradient, `assets/` icons; plus a `plugin assets`
   folder for action plugin button icons; a `fonts` folder with the font files and names) and a PDF report.

## Manual version (no Claude)

`dist-manual/` is the same studio plus `src/manual.js`, published as its own artifact:
https://claude.ai/artifact/TWMNzs5DYs62q5cEd8hBkw (capabilities: `{ "downloads": true }`).
A person does the reading: draw a box round a cell on a screenshot, start from a blank cell or a worked example,
and adjust it in forms that only offer what the cell framework can build. Rule checks flag what breaks the
rules, ready-made decisions come from `knowledge/decisions.json`, and a Rules tab shows `knowledge/rules.md`.
Cells are placed on screens by hand in the Screens tab. Work is kept in the browser and can be saved and opened
as a project file. Saving files (zip, report, project) uses the downloads capability, which needs a signed-in
viewer; signed out, each cell's JSON can still be copied.

## Repo

| Path | What |
|---|---|
| `knowledge/rules.md` | The framework rules Claude follows. **Edit this to teach the studio something new.** |
| `knowledge/schema.md` | The cell description format Claude answers in (and the converter reads). |
| `knowledge/decisions.json` | Ready-made, customer-facing decisions per rule (manual version). |
| `src/manual.js` | The manual version's editors (form inspector, new-cell dialog, screen layout, rules page, project files). |
| `knowledge/examples.json` | Worked examples from a reviewed build, sent to Claude with every screen. |
| `src/index.html`, `src/studio.js` | The studio page and its logic. |
| `src/convert.js` | Description -> build spec. Runs in the page and in Node. |
| `engine/` | The cell engine: preview template (with `window.CellEngine`), builder library, plugin templates (16.0.0-alpha exports), tokens, action assets. |
| `tools/build.py` | Builds `dist/` (what gets published). |
| `knowledge/icons.json` | Icon libraries by role, generated by `tools/icons/extract.py` from pinned npm packages. |
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
  "mcp": { "servers": [{ "server": "Figma", "tools": ["create_session", "get_metadata", "get_screenshot", "use_figma"] }] } }
```

## Scope

Version 1: mobile (phone and tablet), Cell 1, Cell 2, Cell 3 and Group Info. Colours and type are taken from the
design (no design-token mapping). Next: components, plugins, layouts, web, TV.
