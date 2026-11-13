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

- Screenshots or a Figma link in; Claude describes every cell style following `knowledge/rules.md` (version 19).
- From Figma: a read-only `use_figma` script returns each screen's layer details (padding, gaps, fonts, colours,
  text) and exports the icons used (instances followed to their components, as SVG).
- Cells built with the cell preview engine; gallery, inspector, icon panel (Figma icons or a matched library),
  fonts panel (Google Fonts match or uploaded .ttf/.otf), remove with undo.
- Screens tab: mock-up drawn with each item's own text and device height rules, plus a **screen outline** as Zapp
  components (Hero, Horizontal List, List, Grid, Group with Group Info) in the layout's format.
- Screens tab, theme: a **Suggested theme values** card (the value most components and screens use, in the theme
  plugin's order, with Copy JSON) and the components or screens that set their own value instead. Each screen's
  spacing (screen padding, gap between components, background) comes back from Claude in `spacing`.
- Screens tab, components: tap a component in the built preview (or in the list beside it) to see its settings,
  each marked Theme or Override. Screen outlines only carry what differs from the suggested theme, including
  screen padding on the screen itself; `screens/theme.json` is in the zip.
- Navigation: Claude describes each screen's status bar, navigation bar and bottom tab bar in `navigation`;
  `Convert.navBar` / `Convert.tabBar` turn them into the plugins' own fields (QuickBrick `mobile-nav-bar-2`,
  `quick-brick-bottom-tabs`), with checks (bar height = tallest item + padding, padding adjusted to match; 5 tabs;
  fixed 49/56 tab bar). Screens with identical bars are grouped into versions. The bars are drawn in each preview
  and tappable; a Navigation card sums them up. The zip has `navigation/` (plugin JSON, @3x button and tab images,
  upload list) and each screen outline carries its `navigations` and `hide_menu`. The Figma script now looks
  through button and tab wrappers to the glyph, records each glyph's colour, and skips the device status bar.
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

Theme (from the framework code): screens can override the theme's screen padding; Group Info falls back to the
theme's margins when empty, so headers always set bottom margin 0; the Group itself adds no margin or padding.

Ch4 theme agreed with Jon: component padding 12, margin bottom 24, gutters 10, screen padding 24 top / 48 bottom
(0 top on screens that open with a hero), background #1E1E1E. The theme and tap-to-inspect changes were tested
with canned screens in headless Chrome, not yet with a live run on the Ch4 file.

Navigation (from the framework code): nav bar settings live on each screen; height = max(logo or title line
height, button image) + padding; left button is back (automatic) or menu (side menu or menu target only);
title is the screen name; tab bar height fixed (49 iOS / 56 Android) plus safe area, icons drawn in 32x32, up to
5 tabs, no selected indicator or badges; tab bar hides on player screens, the search screen plugin and screens
with "hide menu". Ch4: three bar versions (Top Level logo left, Second Level back + centred title, Gradient over
the Show hero with content under the bar); tab bar #1E1E1E with a 0.5 top border, no labels, Category has none.
Tested with canned screens in headless Chrome and `tools/nav-fixture.json`; not yet a live run.

## Open questions

- How the app chooses phone vs tablet cell styles.
- Selected/focused states on mobile; action plugin state icons (download progress, favourited).
- Whether Zapp can import a layout file, or the screen outline stays a setup guide.

## Possible next steps

- Build the whole app layout (screens, bottom tabs, type mapping) as one file from all screens.
- Re-run the Ch4 Figma file in the published studio: check the suggested theme and the three navigation bar versions.
- Navigation bar and tab bar in the PDF report (not there yet).
- Run Jon's real test designs end to end (screenshots and the Ch4 Figma file) and review results.
- Later scope: components, plugins, web, TV.
