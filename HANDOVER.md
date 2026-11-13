# Handover

Where Zapp Cell Style Studio stands, for picking the work up in a new conversation. Read README.md and CLAUDE.md
first; this note covers status and what's next.

## Links

- Published studio: https://claude.ai/artifact/Aunc4iaEei9ubCxUiQr9cs (shared as "anyone with the link"; republish
  `dist/` to the same artifact to keep the link)
- Repo: `spiky-jon/zapp-cell-style-studio`
- Framework sources (read access): `applicaster/QuickBrick` (component plugins, theme, MasterCell, cell plugins),
  `applicaster/Zapp-Frameworks` (feature plugins)
- Test Figma file: `WsD9lbiGq1s3lJ5OClmDk2` (Ch4: Home, Search, Category screens)

## What the studio does now

- Screenshots or a Figma link in; Claude describes every cell style following `knowledge/rules.md` (version 17).
- From Figma: a read-only `use_figma` script returns each screen's layer details (padding, gaps, fonts, colours,
  text) and exports the icons used (instances followed to their components, as SVG).
- Cells built with the cell preview engine; gallery, inspector, icon panel (Figma icons or a matched library),
  fonts panel (Google Fonts match or uploaded .ttf/.otf), remove with undo.
- Screens tab: mock-up drawn with each item's own text and device height rules, plus a **screen outline** as Zapp
  components (Hero, Horizontal List, List, Grid, Group with Group Info) in the layout's format.
- Downloads: cells zip (JSON, assets, thumbnails, plugin assets with labels, fonts, `screens/*.json`) and a PDF
  report.

## Confirmed on device (in the rules)

Empty labels collapse; rail height = tallest possible cell (max lines); grid rows = deepest item; lists = own
height; Cell 3 sized by image ratio; no-image items keep the placeholder; content badges by item type; lock badge
from `extensions.free` (true/false/absent); runtime from `extensions.duration` (02:43, 1:06:40); buttons work on a
text-only Cell 2; Cell 2 dividers have their own margins; components default to 20pt side padding.

From the framework code: theme defaults (screen, component padding/margins, gutters, tablet values); rail scaling
(cells per view + next cell offset) vs fixed width; page indicators on rails; Hero stacks cells vertically; Group
shares one feed; Group Info row is badge → title → button; whole header tappable when the button is on; the header
button needs a non-empty label (fixed: icon-only buttons get a hidden "View all").

## Open questions

- How the app chooses phone vs tablet cell styles.
- Selected/focused states on mobile; action plugin state icons (download progress, favourited).
- Whether Zapp can import a layout file, or the screen outline stays a setup guide.

## Possible next steps

- Build the whole app layout (screens, bottom tabs, type mapping) as one file from all screens.
- Run Jon's real test designs end to end (screenshots and the Ch4 Figma file) and review results.
- Later scope: components, plugins, web, TV.
