# Cell description format

The studio asks Claude to describe each distinct cell style in the supplied designs in this format. The studio's
converter turns each description into an importable Zapp cell style JSON, so describe what the platform will
build (after applying the rules), not a perfect copy of the design. Anything that can't be built goes in
`decisions`.

All sizes are in points at the device's width (phone 393, tablet 1133 unless told otherwise). Colours are
`#rrggbb` or `rgba(r,g,b,a)`. Boxes are `[top, right, bottom, left]`.

```jsonc
{
  "cells": [
    {
      "name": "Poster Tile",                 // short, Title Case, unique per style
      "screen": "Home",                       // where it appears
      "purpose": "Portrait poster for rails and grids, with an optional tag.",
      "bbox": { "x": 0.05, "y": 0.30, "w": 0.28, "h": 0.20 }, // one clear example in THIS image, fractions of the image (0-1)
      "plugin": "cell_3",                     // cell_1 | cell_2 | cell_3 | cell_info  (see rules)
      "status": "as_designed",                // as_designed | adapted | workaround
      "layout": { "type": "rail", "itemWidth": 112, "gap": 8, "padding": 20 },
      //   rail: horizontal list (itemWidth = the cell's width) · list: vertical list (rowGap) · single: one full-width cell
      "appBackground": "#172B3B",             // the screen colour behind the cell
      "cell": {
        "background": "rgba(0,0,0,0)", "radius": 0, "padding": [0, 0, 0, 0],
        "border": null,                       // or { "width": 1, "color": "rgba(255,255,255,0.14)" }
        "dividerTop": null,                   // cell_2 only: { "thickness": 1, "color": "#4B6F80", "margin": [20, 0, 0, 0] }
        "dividerBottom": null
      },
      "image": {                              // null when the cell has no picture (cell_2 and cell_info only)
        "key": "thumb_2",                     // feed media key: image_base (landscape key art), thumb_1 (logo), thumb_2 (poster), thumb_3 (still)
        "ratio": "2x3",                       // 16x9 | 4x3 | 1x1 | 3x4 | 2x3 | 9x16 | or any "WxH" (e.g. "43x60")
        "width": 135,                         // cell_2 only: the image's width
        "radius": 2,
        "border": null,                       // or { "width": 1, "color": "rgba(255,255,255,0.10)" }
        "margin": [0, 0, 0, 0],               // cell_1: bottom margin = gap to the text; cell_2: right margin = gap to the text
        "placeholder": "#203A4B"
      },
      "overlay": null,                        // gradient over the image: { "direction": "vertical", "stops": [{ "at": 0, "color": "rgba(0,0,0,0)" }, { "at": 1, "color": "rgba(10,22,30,0.92)" }] }
      "secondaryImage": null,                 // { "key": "thumb_1", "width": 240, "height": 56, "align": "center", "beforeLabel": 1, "margin": [0,16,12,16], "fit": "center" }
                                              //   beforeLabel: index of the label it sits above (1-3); omit to sit below the last label;
                                              //   "position": "over_image" with "corner": "top_left | top_right | bottom_left | bottom_right | center" for over the picture
                                              //   title treatments (show or film names drawn as artwork) are always this, reading thumb_1
      "zone": "bottom",                       // cell_3 only: where the text sits over the image: top | center | bottom
      "labels": [                             // in reading order, max 3 (see rules)
        {
          "role": "tag",                      // short id: title, meta, tag, description...
          "dataKey": "extensions.tag",        // title | summary | any feed path (extensions.genre, extensions.runtime)
          "sample": "RECENTLY ADDED",         // the text in the design (used for the preview)
          "font": { "family": "DM Sans", "weight": 500, "size": 9, "lineHeight": 12, "letterSpacing": 0.6 },
          "color": "#172B3B",
          "background": "#E6F06E",            // null for none
          "padding": [1, 4, 1, 4], "radius": 2,
          "align": "center",                  // left | center | right
          "lines": 1,
          "uppercase": true,
          "margin": [0, 6, 5, 6]
        }
      ],
      "buttons": null,                        // { "stacking": "horizontal|vertical", "align": "left|center", "gap": 8, "margin": [0,0,0,0], "afterLabel": 3 | "position": "over_image",
                                              //   "items": [ { "action": "navigation|favourites|share|downloads|trailer", "label": true, "text": "My List", "uppercase": false,
                                              //               "icon": true | "<icon role>", "iconPosition": "left|right|top",
                                              //               "width": "fill" | "dynamic" | 260, "background": "#FFFFFF", "color": "#102C3D", "border": null, "radius": 2,
                                              //               "padding": [11,16,11,16], "font": {...}, "iconSize": 22, "iconFlavour": "light|dark" } ] }
      "progress": null,                       // { "position": "on_image | above_label_1 | below_label_1 | above_label_2 | below_label_2 | bottom_of_cell",
                                              //   "height": 4, "color": "#A0FCBB", "track": "#2E4B5C", "radius": 2, "margin": [6, 92, 0, 0] }
      "badge": null,                          // a static image the studio draws, on the image or (cell_2) in the right-hand column:
                                              //   { "icon": "play", "position": "cell_right | top_left | top_right | bottom_left | bottom_right | center",
                                              //     "width": 24, "height": 24, "iconSize": 14, "color": "#000000",
                                              //     "background": "#A0F07C" | null, "shape": "square | rounded | circle", "radius": 4, "margin": [0,0,0,0] }
                                              //   background: the plate behind the icon in the design's shape (square block, circle, rounded); color is the icon on it
      "action": null,                         // cell_2 action icon in the right-hand column (download, add to list):
                                              //   { "action": "downloads|favourites", "icon": "download", "size": 44, "iconSize": 24, "color": "#FFFFFF", "margin": [0,0,0,8] }
      "runtime": null,                        // duration pill (always bottom right of the image): { "background": "rgba(17,34,46,0.85)", "color": "#FFFFFF", "font": {...}, "radius": 3, "padding": [1,5,1,5], "margin": [0,6,6,0] }
      "header": null,                         // cell_info only: { "title": <label>, "button": { "text": "View All" | null, "icon": "chevron-right" | null, "iconSize": 20,
                                              //   "font": {...}, "color": "#EBF66F" } | null, "padding": [20, null, 12, null] }
                                              //   An arrow or chevron that signals "see more" becomes an icon-only header button on the right (text null).
      "decisions": [                          // what works, what changed and why, and the suggested alternative
        { "type": "works", "text": "2:3 poster with a lime tag that hides when the feed has no tag." },
        { "type": "changed", "item": "Duration pill position", "text": "The runtime pill always sits bottom right; the design shows it top right." },
        { "type": "alternative", "text": "Use a content badge if the pill must be top right." }
      ]
    }
  ]
}
```

## Whole response

```jsonc
{
  "inventory": [                              // FIRST: every visible element on the screen, top to bottom, and where it is built
    { "element": "Genre line \"Comedy\"", "cell": "Show Detail Hero", "slot": "label 1" },
    { "element": "Title \"Ellie & Natasia\"", "cell": "Show Detail Hero", "slot": "label 2" },
    { "element": "Next episode line", "cell": "Show Detail Actions", "slot": "label 1" },
    { "element": "Start watching button", "cell": "Show Detail Actions", "slot": "button 1" },
    { "element": "Bottom tab bar", "cell": null, "reason": "app navigation, not a cell" }
  ],                                          // cell null only when a rule says it can't be built (give the reason)
  "fonts": [                                  // one entry per typeface in the design
    { "seen": "titles and buttons: bold geometric sans", "family": "Inter", "source": "google",   // google | uploaded
      "alternatives": ["Figtree", "Manrope"], "why": "Tall x-height, flat terminals, single-storey a" }
  ],
  "cells": [ ... ],                           // new cell styles on this screen
  "seen": [ "Section Header" ],               // already-described styles that also appear on this screen
  "screen": [                                 // this screen top to bottom, as components of cells (for the screen mock-up)
    { "cell": "Hero Card", "component": "single" },
    { "cell": "Section Header", "component": "single" },
    { "cell": "Page Title", "component": "single", "texts": [{ "title": "Search" }] },
    { "cell": "Poster Tile", "component": "rail", "count": 4 },          // rail: horizontal list; count = items visible
    { "cell": "Category Row", "component": "list", "count": 3,           // list: vertical list
      "texts": [{ "title": "All Shows" }, { "title": "Audio Described" }, { "title": "Comedy" }] },  // what each item shows here
    { "cell": "Poster Tile", "component": "grid", "columns": 3, "count": 6 }
  ],
  "icons": { "library": "lucide", "light": "#FFFFFF", "dark": "#121212", "why": "Thin rounded outline icons" }
}
```

`icons.library` is the closest match to the design's icon style, from: `lucide` (Outline, 2px rounded strokes (iOS-like, Feather family)), `phosphor-regular` (Outline, 1.5px rounded strokes, friendly geometric), `phosphor-bold` (Heavy outline, bold rounded strokes), `phosphor-fill` (Solid filled shapes, rounded), `tabler` (Outline, 2px strokes, slightly technical), `heroicons-outline` (Outline, 1.5px strokes, clean UI), `heroicons-solid` (Solid filled, clean UI), `material-outlined` (Android / Google style outline, square-ish ends), `material-rounded` (Android / Google style outline, rounded ends), `material-rounded-fill` (Android / Google style, solid filled, rounded).
`light` is the icon colour for dark backgrounds, `dark` the colour for light backgrounds.

Icons from a Figma file: when the studio lists `ICONS FROM THE FIGMA FILE`, use their exact refs (`figma:12:34`) as
the icon value instead of a role, wherever the design uses them. Roles are for icons the file doesn't have.

Icon roles (use these names wherever an icon is named): `play`, `plus`, `check`, `heart`, `bookmark`, `share-ios`, `share-network`, `download`, `download-progress`, `download-done`, `download-error`, `download-expired`, `trailer`, `calendar-plus`, `more-horizontal`, `more-vertical`, `volume-mute`, `volume-on`, `chevron-right`, `chevron-left`, `chevron-down`, `chevron-up`, `arrow-right`, `info`, `close`, `lock`, `search`, `star`, `live`, `list`.

`texts`: one object per visible item, in order, giving the text that item shows on this screen, keyed by each label's
`dataKey` (`title`, `summary`, `extensions.genre`...). The cell's own `sample` is just one example; `texts` makes the
mock-up read like the design. Give them whenever the items show different text.

Notes for the describer:

- One entry per distinct cell *style*. Ten posters in a rail are one Poster Tile.
- Screenshots often overlap (a long screen captured in several parts). If a style on this screen matches one
  already described, even under a different name or with slightly different sample text, list it in `seen`; do
  not describe it again.
- Ignore the status bar, app navigation bar, tab bar and bottom tab bar: they aren't cells.
- Fonts: every `font.family` is a family listed in `fonts` (a Google Fonts family with its exact name and
  capitals, e.g. "DM Sans", or an uploaded font's family). Weight as a number.
- Button `text` is the label exactly as the design writes it (the plugin's label is set to match); `uppercase`
  only when the design is in capitals.
- Left edges: give each cell the inset the design shows. Check that headers and the rails under them start at the
  same x when they do in the design.
- Inventory: list every visible element before describing cells, and make sure each one with a cell is really
  in that cell's labels, images or buttons. Keep the inventory honest: it's how reviewers check nothing was
  dropped.
- Measure in points: the studio tells you the image's pixel width and the screen width in points.
- If the design needs more than the cell can do, build the closest version and record each difference as a
  `changed` decision with the reason from the rules, plus an `alternative` where there is one.
- `status`: `as_designed` when nothing material changed, `adapted` when something visible changed,
  `workaround` when the design isn't possible directly and needed another approach (extra cell, feed artwork).
