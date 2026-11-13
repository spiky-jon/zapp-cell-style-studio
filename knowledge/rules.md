# Zapp mobile cell styles: rules

Version 19 · phone and tablet · cell plugins 16.0.0-alpha

These rules decide how a design becomes Zapp cell styles. They were learned by rebuilding a full streaming app
(ITVX) cell by cell and reviewing the results on device. Follow them exactly: when a design asks for something
the rules say isn't possible, build the closest version and say what changed, why, and the alternative.

## 0. Priorities

Apply these in order, every time, so the same design always gives the same cells:

1. **Keep everything visible.** Every piece of text, image and button in the design appears in a built cell.
   Never drop a visible element to keep a block in one cell: when a block has more than a cell can hold (more
   than 3 labels, labels and buttons that won't fit), **split it into stacked cells** that read the same feed
   and share the background, so they look like one block. Leave something out only when a rule says it can't
   be built at all (an icon inside a label, an expand chevron), and record why.
2. **Match the look.** Sizes, spacing, colours, fonts and alignment as close to the screenshot as the cell
   allows.
3. **Then use the fewest cells.** Only after 1 and 2.

How to split a block, so it splits the same way each time: the first cell takes the image and the labels in
reading order until it is full (3 labels); the next cell takes the remaining labels and the buttons. Name the
second cell after the first with what it holds (e.g. "Show Detail Hero" and "Show Detail Actions"). Status
`workaround`, with a decision on each cell saying which cell continues it.

## 1. The four cell types

| Type | Use it for | Structure |
|---|---|---|
| `cell_1` | Tiles with text **below** the image (news tiles, thumbnails with titles under them) | Image on top, then up to 3 labels stacked below, optional buttons |
| `cell_2` | Rows with the image **beside** the text (episode rows, list rows), and **text-only** cells (info blocks, action rows, channel rows) | Optional image on the left at a fixed width, up to 3 labels to its right, optional right-hand column (cell badge or action icon) |
| `cell_3` | Text and buttons **over** the image (hero cards, posters with tags, detail heroes) | Full-width image; labels in one of three zones over it (top, centre, bottom), up to 3 per zone; optional buttons |
| `cell_info` | Rail and list headers ("Continue Watching", "View All"), spacers and footers inside a group | An optional badge, one title, an optional button on the right |

Choosing:
- Text under a picture → `cell_1`. Text beside a picture, or no picture → `cell_2`. Text on a picture → `cell_3`.
- A poster with a small tag on it (NEW, RECENTLY ADDED) → `cell_3` with the tag in the bottom zone.
- A header row above a rail or list → `cell_info`.
- A header title followed by an arrow or chevron (e.g. "New & Trending >") is a call to action: the row opens
  the full list. An icon can't sit straight after the title, so build the title on the left and an **icon-only
  header button** (the chevron) on the right. It matches the look and does the same job. Status `adapted`.
- If a `cell_3` design puts the text **below** the image (title, description and button under key art), it can
  be built with bottom cell padding that reserves the space, but the text then can't grow; prefer `cell_1`
  unless the design needs `cell_3`-only features.

### Groups and group headers

- A **Group** is a component that holds several components sharing **one feed**: its items fill the child
  components in order (each child takes up to its item limit before the next one starts).
- **Group Info** (the `cell_info` cell style) only works inside a group, as a header at the top, a decorative row
  between components, or a footer. It can also be a blank spacer.
- The header **title is the group's feed title**, or a "title override" set on the Group Info component. Sample
  text in the design is just that feed's name.
- The row is **badge (optional) → title → button**. The title stretches to fill the row and the button sits at
  the far right, so a badge can only go **before** the title and nothing can follow the title directly (hence
  the icon-only button for "Title >" designs).
- When the button is switched on, **the whole header row is tappable** and opens the group's feed (where it goes
  depends on the feed's type). With the button off the header isn't tappable.
- The button only appears when its **label has a value**, even if its text is hidden: an icon-only button still
  needs a label (the studio fills in "View all"; it is also read out by screen readers).
- The header hides itself when the group has no items.
- Spacing: the Group Info component has its own padding and margins (default 0). The header cell's side padding
  falls back to the theme's component padding (20) when left empty, so it lines up with rails by default.

## 2. Text labels

- **At most 3 labels** per cell (`cell_1`, `cell_2`), or 3 per zone (`cell_3`). Cell 2 has a 4th label in its
  template but apps only render 3: never use it.
- **One style per label**: one font, size, weight, colour and letter spacing. A line that mixes weights
  ("**Up next:** Lorraine") or colours ("06:00 · <green>13m left</green>") must use one style, or be split into
  separate labels.
- **No icons inside labels** (subtitles, guidance ratings, inline dots as images). Leave the icon out, or note
  it as feed artwork.
- Labels can have a **background colour, padding and a corner radius** (tags, pills). The radius applies to all
  four corners or none: a tab with one rounded corner becomes square.
- No gradient fills on text.
- Per label: alignment (left, centre, right), number of lines (truncates with …), uppercase transform, margins.
- Each label reads a **data key**: `title`, `summary`, or any feed path such as `extensions.genre`.
- **An empty value removes its label**, with its margins, padding and background: the labels below move up and no
  gap is left. So a tag or meta line that only some items have needs no special handling. (Confirmed on device.)
- Lines are a **maximum**: longer text is cut off with "…". Set each label's lines to what the design needs, not
  more, because the lines also decide the cell's height in rails (see section 7).
- When content needs more than 3 lines (e.g. a show hero: genre, title, synopsis, next episode, buttons; or an
  expanded live panel: logo, title, time, description, "up next"), **split it across two cells** placed as two
  components that read the same feed (see Priorities). Never leave a line out instead. Record this as a
  `workaround`.

## 2a. Fonts

- Name every font by **family** and weight. Match the design's type to the closest **Google Fonts** family
  (same classification, proportions, x-height, letterform details such as a single- or double-storey "a"), and
  give two Google alternatives.
- When the user supplies font files, they are the design's own fonts: use them, by their family name, wherever
  the design's type matches.
- Use one family per distinct typeface in the design, and keep the same choice for the same type across every
  screen.
- If the design uses the phone's system font (SF Pro), name the closest Google family (Inter) and mention SF Pro
  as an alternative.

## 3. Images

- When an item has **no image**, the image area stays (in the placeholder colour) and badges still show on it;
  the cell's shape doesn't change. (Confirmed on device.)
- One **main image** per cell, from a feed media key: `image_base` (landscape key art), `thumb_1` (title logo),
  `thumb_2` (poster), `thumb_3` (still). Aspect ratio from presets (16x9, 4x3, 1x1, 3x4, 2x3, 9x16) or a custom
  `WxH`. Corner radius, a border (width, colour) and a placeholder colour are available.
- One **secondary image** (title logo, channel logo, rank artwork): fixed width and height, fitted inside that
  box, positioned above or below a label or over the image (in a corner or the centre, with margins). It has
  **no border** setting.
- A **title treatment** (a show or film name drawn as artwork, like a stylised logo over a hero) is always the
  secondary image reading `thumb_1`, never a text label and never left out. When it sits over the bottom of the
  key art, place it over the image (a corner or the centre) and fine-tune it with margins.
- **Gradients and scrims** over the image are an **overlay image** (a PNG the studio generates from the gradient
  stops). There is no gradient setting on the cell.
- A design element that overlaps another (a rank number tucked behind a poster) can't be layered. Draw the
  effect into artwork the feed supplies (e.g. one rank image per position, cropped so it looks tucked behind),
  and place the pieces side by side. Record as `workaround`.
- Promo banners, collection tiles and date strips that are part of the artwork are just images.

## 4. Badges, pills and progress

- **Duration / runtime pill**: always **bottom right** of the image (background, colour, font, radius, padding,
  margins). A design with it elsewhere → keep bottom right and record the change; alternative: a content badge.
- The pill shows the feed's `extensions.duration` (in seconds) as minutes and seconds with leading zeros (163 →
  "02:43", 1280 → "21:20"); from an hour it adds hours without a leading zero (4000 → "1:06:40"). Items without a duration show no pill. It can't show other text ("45 min", "1h 20m"):
  a design that formats it differently → keep the pill and record the change, or use a label that reads a
  feed field with the text already formatted. (Confirmed on device.)
- **Content badges** sit on the image and are chosen by the item's **type**: up to five type names (e.g. video,
  show, movie), each with its own badge image, shown in one position (centre, a corner) at one size. Useful in a
  mixed feed (a play icon on videos, a TV icon on shows). Every item of that type shows the same badge.
- A badge that depends on the viewer (NEXT EPISODE, "new for you", watched) **can't** come from content badges:
  the type also decides where a tap goes (video opens the player, show or movie opens the screen mapped to that
  type), so changing an item's type to get a badge would break navigation. Record it as `changed`. Alternative:
  the feed supplies it per item, as text (e.g. `extensions.tag`, shown as a tag label) or artwork (a secondary
  image), which needs the customer's backend to know what to send (e.g. which episode is next for this viewer).
- **Lock badge**: driven by a feed field (e.g. `extensions.free`): `true` shows the unlocked image, `false` the
  locked image, and no value shows no badge. Fixed size, in a corner of the image. (Confirmed on device.)
- A cell with no image area at all (Cell 2 text only) can't show content or lock badges.
- **Cell badge**: one static image the studio draws and ships in the download, at **any width and height**,
  placed in a corner or the centre of the image (Cell 2 also in its right-hand column), fine-tuned with margins.
  Because it is an image, draw the design's shape exactly: a square green play block stays a **square**, a round
  play button a circle, a chevron just the icon. It is the same on every item (it doesn't come from the feed).
- **Action icon** (cell_2): e.g. a download button in the right-hand column.
- **Progress bar**: on top of the image, above or below text label 1 or 2, or at the bottom of the cell. Colour,
  track colour, height, radius and margins. It **can't share a line with a label** (a bar with "2m left" at its
  end): put the label on the line above (right-aligned) and give the bar a right margin to leave room. Extra
  bottom margin only adds space under the cell.

## 5. Icons and plugin assets

- Every icon a cell uses is a deliverable: button icons (per action plugin, two flavours: flavour 1 for dark
  backgrounds, flavour 2 for light), cell badges (chevrons, play buttons), action icons and header icons.
- When the design comes from a **Figma file**, the studio also sends the screen's layer details (exact positions,
  auto-layout padding and gaps, fonts, colours and text). Use those numbers instead of measuring the picture.
- When the design comes from a **Figma file**, use the file's own icons: the studio exports them and lists them
  by ref (`figma:12:34`). Use the ref wherever a cell needs that icon. One-colour icons are recoloured to fit
  (e.g. the plugin's light and dark flavours); multi-colour artwork stays as drawn. If a Figma icon already
  includes its background shape, don't add a plate behind it.
- For screenshots, and for any icon the Figma file doesn't have, the studio draws from an icon library chosen to
  match the design's icon style (outline or filled, stroke weight, rounded or square ends). Name those icons by
  role (`play`, `chevron-right`, `download`...).
- A play button on a thumbnail is a cell badge with a filled circle behind the icon.

## 6. Buttons

- Up to **3 buttons** per cell, stacked horizontally or vertically, aligned left or centre, positioned relative
  to the labels or over the image.
- Buttons work in every cell type, **including a text-only Cell 2**: e.g. a detail block with a row of three
  icon-above-label buttons (Trailer, Share, Download) above the synopsis, cast and director labels, all in one
  cell. (Confirmed on device.)
- Each button runs an **action plugin**: navigation (open / play), favourites (my list), share, downloads,
  trailer.
- **Labels and icons come from the action plugin**, set once for the whole app, and **the label can be changed
  to match the design** ("My List" instead of the default "Add to Favorites", "Play" instead of "Watch Now").
  Use the design's wording and casing, and record the label to set on the plugin. Each plugin has one label, so
  two navigation buttons with different labels ("WATCH NOW" + "WATCH AD-FREE", or "MORE INFO") aren't possible:
  drop the second button, or note that it needs its own action plugin.
- Keep button rows lined up with what's above them. A row of icon-over-label buttons under a full-width button
  or centred content is **centred**; when a button can't be built (no action plugin for it), centre the remaining
  buttons rather than leaving a gap where the missing one was.
- Icons come from the plugin's two flavours (light and dark): pick the flavour that suits the button colour.
  A one-off icon colour (e.g. a lime icon on one button) isn't possible.
- Per button: fill (full width), dynamic (fits its label) or a fixed width; background, text colour, border,
  corner radius, padding, font; icon left, right or above the label.

## 7. Layout, spacing and behaviour

- **Measure each cell's left edge separately.** Rail and list headers usually line up exactly with the first
  item of the rail or list below them; heroes and banners are often inset differently on purpose. Copy what the
  design does: compare the header title's left edge with the first tile's left edge, and give both the same
  inset when they line up in the design.
- **List rows keep their spacing inside the cell.** A row in a vertical list (a category, a setting, a menu item)
  puts the space above and below its text into the cell's own top and bottom padding (equal, as designed), and
  the list has no gap between rows. That keeps the whole row tappable (a good hit area) and the divider in the
  right place. Use a list gap only when the design shows real space between separate cards.
- Cell padding, background, corner radius and border (inside) are on the cell. Cell 2 also has top and bottom
  **dividers** (thickness, colour). Each divider has **its own margins** (top, right, bottom, left), added inside
  the cell's side padding, so the top and bottom dividers can have different insets (e.g. a full-width top line
  and a shorter bottom line). (Confirmed on device.) Both start from the cell's side padding. Components have **20pt side padding by
  default** (a theme value), changed per component when a design needs something else. For a divider flush
  with the screen edges, set that component's side padding to 0 and give the cell no side padding, and inset the content
  with the labels' (and image's and buttons') own margins. Don't use negative margins for this.
- Cell 2 **centres its text vertically** against the image when the text is shorter than the image, and
  top-aligns when taller. A full-width line under both the image and the text (e.g. a synopsis under an episode
  row) isn't possible: the text stays beside the image.
- Describe each screen as components top to bottom (single, rail, list, grid) so the studio can mock it up, with
  the text each item shows on that screen (the feed decides it in the app, but the mock-up should read like the
  design: "Search" for the page title, "All Shows", "Comedy"... for the rows).
- **Heights by component** (confirmed on device):
  - **Rail**: every item is as tall as the deepest cell could be (the image, every label at its maximum lines,
    buttons), even when the text is shorter. Shorter items keep their text at the top and the cell's background
    fills the rest. So extra lines on a label make every tile taller: match the design's lines exactly.
  - **Grid**: each row is as tall as its deepest item's actual content, so rows can differ.
  - **List**: each cell is its own height.
  - **Cell 3** is sized by its image ratio, so text over the image never changes its height in any component.
- **Screens are built as Screen → Components → Cells.** Each component (horizontal list, grid, list, hero) shows one
  cell style, chosen on the component. Spacing between and around cells is set on the component, falling back
  to the theme when left empty. Theme defaults, phone (tablet in brackets):
  - Screen padding: top 25 (30), bottom 50 (70), sides 0.
  - Component padding: sides 20 (52), top and bottom 0. Component margin: bottom 20 (20), the space between
    components.
  - Gutters: 12 (16), between cells in a row (horizontal) and between rows or list items (vertical).
- **Theme values come from the designs.** The theme holds the value most components and screens use, counted
  across every screen: side padding, the space between components (component margin bottom), the gutters,
  screen padding and the app background. Report each screen's own spacing in `spacing` and keep it out of the
  cells, because spacing baked into a cell can't follow the theme. A component or screen that differs sets its
  own value instead (e.g. a hero with wider side padding).
- **Screen padding top** is the space between the navigation bar and the first component. Use the most common
  value for the theme; a screen that opens with a hero against the navigation bar sets its own top padding to 0
  (screens can override the theme's screen padding).
- **Headers and the theme margin**: a Group Info left on the theme's bottom margin opens that gap between the
  header and its list, so the header's bottom margin is always set to 0. The Group itself adds no margin or
  padding; the gap after the group comes from the rail, list or grid inside it.
- **How the studio's components map to Zapp components** (as in a Zapp layout):
  - `single` → **Hero**: its cells stack vertically at full width (not a carousel). Used for heroes and for the
    blocks of a detail screen; set its side padding to 0 for edge-to-edge artwork.
  - `rail` → **Horizontal List**; a swipeable hero carousel is a Horizontal List with 1 cell per view and page
    indicators.
  - `list` → **List**; `grid` → **Grid**.
  - A header above a rail or grid → a **Group** (which carries the feed) containing **Group Info** (the header
    cell style) and the rail or grid (no feed of its own).
  - Each component points at one cell style, and the same cell style is often reused by several components.
- **Detail screens** are chosen by the item's type: the layout maps each type (e.g. movie, tv-show) to a screen,
  and that screen's components show the tapped item (see "type" under badges).
- **Horizontal list (rail)**: by default the cells are **scaled** to fit a number of **cells per view** plus a
  **next cell offset** (the peek of the next cell; defaults 2 and 20), so cell width follows the screen width.
  The other mode is a **fixed cell width** (default 200). It can snap to start, centre or end, and has optional
  **page indicators** (dots: size, colours, alignment, margins), auto-scroll and looping. So carousel dots are a
  component setting, not part of the cell.
- **Grid**: a number of columns (default 2) with horizontal and vertical gutters. **List**: a vertical gutter
  (theme default 12; set it to 0 for rows that touch, see "List rows" above).
- Things around cells belong to the **component**, not the cell: carousel peek, page dots, rail gaps and item
  widths, grid columns, side insets. Note them, don't build them.
- **The navigation bar and the bottom tab bar are plugins, not cells.** Describe them in `navigation` (never as
  cells) so the studio can set up the two plugins. Each screen carries its own navigation bar settings, so
  screens can use different bars (a top-level bar with a logo, a second-level bar with back and a title, a
  see-through bar over a hero).
- **Navigation bar height** is the tallest of the logo (or the title's line height), and the button images, plus
  padding top and bottom. Give the bar's real height and padding; the studio adjusts the padding when they don't
  add up.
- **Navigation bar left side**: a back button appears by itself when there is a screen to go back to; otherwise
  a menu button, but only with a side menu (or a menu target screen). There is only one left button. A design
  with two buttons on the left can't be built: keep the first and record the other.
- **Navigation bar centre**: a logo, the screen's title, or nothing, aligned left or centre. The title is the
  screen's name, one line, in one font. Text other than the screen name (a subtitle, a search field, tabs)
  can't be built in the bar: build it as the first cell on the screen instead.
- **Navigation bar right side**: icon buttons only, all the same size, each opening a screen (pushed or as a
  modal). Text buttons, a profile photo or a badge on an icon can't be built: draw the icon only.
- **Navigation bar button images** are the whole tap area (often 44 or 48): the glyph sits in the middle with
  its padding around it. Give the box size in `buttonSize` and the glyph in `iconSize`.
- **Navigation bar background**: a colour or a two-colour vertical gradient, optional bottom border, optional
  blur. A gradient fading over a hero covers the status bar too. When content runs behind the bar (a hero under
  a see-through bar), set `contentPosition` to `under_bar`.
- **Bottom tab bar** (fixed by the plugin): 49 tall on iPhone (56 on Android) plus the home indicator area, up
  to 5 tabs of equal width, each an icon in a 32x32 box with an optional one-line label (14 tall) under it, a
  background colour and a top border. Colours: one for the selected tab, one for the rest. A selected pill or
  underline, notification badges, per-tab colours, a floating or rounded bar and a see-through bar can't be
  built: draw any selected marker into the selected icon, leave the rest out, and record each in `unsupported`.
- **Tab icons** keep their designed size: give the glyph size in `iconSize` (the studio draws it inside the
  32x32 box). Give a separate `selectedIcon` only when the selected tab uses a different glyph (filled versus
  outline), not for a colour change.
- **Screens without the tab bar** (a detail screen that hides it) set "hide the menu" on that screen. The tab
  bar also hides on player screens and on the search screen plugin, so a search screen with a tab bar must be a
  normal screen.

- **No expand/collapse**: cells can't open or close in place. Chevrons that toggle a row have no job: leave them
  out and record why. Show an expanded state as its own cell(s).
- A composition that depends on an exact width (number + poster) only works in a horizontal list with a fixed
  item width.
- Negative margins work but should be tested on device; prefer layouts that avoid them (e.g. swap which picture
  is the main image).

## 8. Reporting decisions

For every cell, record:
- `works`: what carries over as designed.
- `changed`: each visible difference, named (`item`), with the rule-based reason in plain words.
- `alternative`: the suggested approach where there is one.

Status: `as_designed` (nothing material changed), `adapted` (visible changes), `workaround` (not possible
directly; built another way).

Write decisions for a customer: plain language, no internal key names, one sentence each.
