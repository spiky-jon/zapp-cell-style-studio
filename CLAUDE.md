# Working on Zapp Cell Style Studio

Read README.md first. Key points for any session:

- **The studio must stay standalone.** Everything it knows lives in `knowledge/` (rules, schema, examples) and
  `engine/` (templates, builder, renderer). When we learn something about the Zapp framework, write it into
  `knowledge/rules.md` (plain language, one rule per bullet, with the reason and the alternative) and, if it
  changes what can be built, into `src/convert.js` and `knowledge/schema.md`. Bump the version line in rules.md.
- **Engine source of truth.** `engine/template.html` and `engine/lib/*.mjs` come from the cell preview tool
  (cell-tokens). Keep them in step when the preview changes; the studio drives the template through
  `window.CellEngine` (buildCell, render, snapshot, registerFont, registerFace). `window.CELL_ENGINE_MODE` stops the engine
  from using artifact capabilities.
- **After any change:** `python3 tools/build.py && node tools/test.mjs`, then republish `dist/` and, when shared
  code or knowledge changed, `dist-manual/` (see README for the file lists and capabilities). Keep
  `knowledge/decisions.json` in step with rules.md. Publishing again to the same artifact keeps its link.
- **Decisions are customer-facing.** Write them in plain language, no internal key names, one sentence each.
- Statuses: as_designed, adapted, workaround. Cell types: cell_1 (text below image), cell_2 (beside / text
  only), cell_3 (over image), cell_info (headers).
- Commit messages: imperative, short.
