# snBible

A Supernote plugin that inserts Berean Standard Bible passages into the current note as a text box.

Tap the **snBible** button in a note's toolbar, then either pick **book → chapter → verses** (tap the first verse, then the last), or type a reference such as `genesis 1:1-5` and press **Go**. The preview shows exactly what will be inserted; adjust verse numbers, layout, reference position, size and placement, then tap **Insert into note**.

## Build and install

This repository is the complete plugin project, generated from the official template (`@supernote-plugin/sn-plugin-template`, React Native **0.79.2**, which must not change) with the snBible source on top.

You need Node 18+ and `zip`, plus `jq` or `python3`. snBible has no native Android code, so `buildPlugin.sh` only bundles the JavaScript and zips it. JDK 17 and the Android SDK are needed only if you later add a dependency with native code.

```bash
npm install
npm run build:plugin        # or ./buildPlugin.sh; .\buildPlugin.ps1 on Windows
```

The package is written to `build/outputs/snBible.snplg`. Copy it to **MyStyle** on the Supernote, then go to **Settings → Apps → Plugins → Add Plugin**.

## Development

| Command | What it does |
|---|---|
| `npm test` | Jest tests for the reference parser, book table, formatter and bundled data |
| `npm run typecheck` | `tsc --noEmit` against the real `sn-plugin-lib` types |
| `npm run lint` | ESLint (template config) |
| `npm run fetch-bsb` | Re-downloads bereanbible.com/bsb.txt and regenerates `src/data/bsb.json` (`-- --file bsb.txt` uses a local copy) |
| `npm run build:plugin` | Builds the `.snplg` |

`src/data/bsb.json` is committed (about 4 MB, 66 books, 31,102 verses) so builds are reproducible and need no network access.

## Reference formats the text box accepts

| Typed | Result |
|---|---|
| `genesis 1:1-5`, `Gen 1:1–5` | Genesis 1:1–5 |
| `Jn 3:16`, `first john 1:9`, `I John 4:8`, `Gen. 1:1` | single verses |
| `Rom 8:38-9:2`, `Isa 52:13-53:12` | ranges across chapters |
| `Ps 23`, `Gen 1-2` | whole chapters |
| `John 3:16, 18-21` | several pieces of one chapter |
| `Jude 3-5`, `Philemon 6`, `Philemon 1:6` | verses in one-chapter books |
| `deuter 6:4`, `lament 3:22` | any unambiguous prefix of a book name |
| `John`, `1 cor` | opens that book's chapter list |

Abbreviations like `Matt`, `Deut`, `Phil`, `Phlm`, `Eccl`, `Song`, `Rev` all work. For ambiguous ones such as `Jo` or `Ez`, the plugin asks you to type more.

## Where the text comes from

- **Offline (default):** `src/data/bsb.json`, converted from [bereanbible.com/bsb.txt](https://bereanbible.com/bsb.txt) and bundled into the plugin. No Wi-Fi is needed on the device.
- **Online fallback:** if the bundle is missing or empty, chapters are downloaded on demand from the [Free Use Bible API](https://bible.helloao.org) (`/api/BSB/{BOOK}/{chapter}.json`). The plugin asks for internet permission the first time.

## Files

| File | Purpose |
|---|---|
| `index.js` | Initialises the plugin and registers the NOTE toolbar button (id 100) |
| `App.tsx` | The picker, search box and preview UI |
| `src/books.ts` | 66 books, chapter counts, abbreviations |
| `src/reference.ts` | Reference parser and label formatting |
| `src/bibleSource.ts` | Offline bundle reader and online fallback |
| `src/format.ts` | Turns verses into the text box string (options live here) |
| `src/insert.ts` | Sizes and places the text box, calls `PluginNoteAPI.insertText` |
| `src/ui/components.tsx` | E-ink buttons, segmented choices and toggles |
| `src/data/bsb.json` | The bundled BSB text |
| `scripts/fetch-bsb.mjs` | Downloads and converts the BSB text |
| `PluginConfig.json` | Plugin name, ID, version and permissions |
| `buildPlugin.sh` / `.ps1` | Template packaging scripts |
| `__tests__/` | Jest tests |

## Notes

- Text boxes can only go into NOTE files (not PDFs/EPUBs), and always land on the main layer. Lasso the box afterwards to move or resize it.
- The plugin asks for write permission only if the note refuses the insert without it (error 1501).
- Verses the BSB omits (e.g. Matthew 17:21) appear greyed out in the list and are skipped when inserting a range.
- To release an update, raise `versionCode`/`versionName` in `PluginConfig.json` (and `version` in `package.json`), and keep `pluginID` unchanged.

### Corrections from checking the real SDK (sn-plugin-lib 0.1.65)

- `PluginNoteAPI.insertText` and `PluginCommAPI.getPageDisplaySize` are typed as `Promise<Object>`, not `APIResponse`, and `APIResponse` isn't exported from the package root. `src/insert.ts` casts to a local `{ success, result, error: { code, message } }` type, which matches what the SDK returns at runtime.
- `insertText` validates `textRect` as **integers** with non-zero area, and `fontSize ≥ 1`. The page size is rounded so the rectangle stays integral.
- `registerButton` type 1 is documented in the SDK as the "sidebar" button, which is the NOTE toolbar. `['NOTE']` alone is accepted.
- `requestPermission(p, desc)` returns 0 (deny), 1 (while in use) or 2 (always). `desc` is shown only in the "previously denied" dialog. Otherwise the host uses its default text.

## Device checklist

These can only be confirmed on a Supernote. Please report results in an issue.

- [ ] The toolbar button appears in NOTE and opens the UI.
- [ ] The plugin opens without a noticeable delay. The ~4 MB of bundled text is evaluated when the book grid first renders. If it's slow, switch `bsb.json` to a compact format (one string per chapter, joined with `\u0001`).
- [ ] `insertText` works without asking for FILE:WRITE. If it doesn't, check that the 1501 retry path asks for permission and then inserts.
- [ ] Font size factors (small 0.018, medium 0.022, large 0.027 × page width) look right. Note which model you tested on.
- [ ] The height estimate is reasonable. Test Psalm 119 as a long passage; it should report that it overflows the page.
- [ ] Superscript verse numbers render in the Supernote font, including cross-chapter markers like `⁸:³⁹`, where the colon isn't superscript.
- [ ] The en dash, curly quotes and em dash in references and text render.
- [ ] The UI is readable on e-ink: no ghosting, and tap targets are big enough. There are deliberately no spinners or animations.
- [ ] The text box can be lassoed and moved after inserting.
- [ ] The button does not appear in DOC/PDF (it is registered for NOTE only).

## Licence

The Berean Standard Bible text is in the public domain.
