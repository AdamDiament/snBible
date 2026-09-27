# Super Bible

A Supernote plugin that inserts Berean Standard Bible passages into the current note as a text box.

Tap the **Super Bible** button in a note's toolbar, then either pick **book → chapter → verses** (tap the first and last verse, in either order), or type a reference such as `genesis 1:1-5` and press **Go**. Up to 30 verses can be inserted at a time. By default the passage goes just below the last thing you wrote on the page.

**From the lasso toolbar** (the Super Bible button appears when you lasso handwriting or a text box):

- **Lasso a handwritten reference** such as "Rom 8:28": it's read with handwriting recognition, and the passage is inserted where you wrote it, replacing the handwriting (untick *Replace handwriting* to keep it). If the reference can't be read, what was recognised is put in the search box for you to correct.
- **Lasso a Super Bible text box** to change it: the reference is read from the box, you can pick a different range or change the layout, and *Update text box* rewrites it in place.

Your settings and your last six passages (shown under **Recent** on the book grid) are remembered. The preview shows exactly what will be inserted; adjust verse numbers, layout, reference position, size and placement, then tap **Insert into note**.

## Build and install

This repository is the complete plugin project, generated from the official template (`@supernote-plugin/sn-plugin-template`, React Native **0.79.2**, which must not change) with the plugin source on top. The display name is **Super Bible**; the package name, `pluginKey` and `app.json` name stay `snBible`, and `pluginID` never changes, so new builds install as updates.

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
| `Ps 23`, `John 3` | opens that chapter's verse list to pick from |
| `Gen 1-2` | whole chapters (if 30 verses or fewer) |
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
| `src/buttons.ts` | Toolbar and lasso button ids; hands button presses to App |
| `src/lasso.ts` | Reads the lasso: recognises handwriting, or finds the reference in a text box |
| `src/pageContent.ts` | Finds the bottom of the last thing written on the page |
| `src/store.ts` | Remembers settings and recent passages |
| `src/selection.ts` | Verse-list selection (either order) and the 30-verse limit |
| `src/layout.ts` | Text box size and position, and the one-page fit estimate |
| `src/insert.ts` | Calls `PluginNoteAPI.insertText` and closes the panel |
| `src/ui/components.tsx` | E-ink buttons, segmented choices and toggles |
| `src/ui/SafeScrollView.tsx` | ScrollView that can't get stuck ignoring taps (see Notes) |
| `src/data/bsb.json` | The bundled BSB text |
| `scripts/fetch-bsb.mjs` | Downloads and converts the BSB text |
| `PluginConfig.json` | Plugin name, ID, version and permissions |
| `buildPlugin.sh` / `.ps1` | Template packaging scripts |
| `__tests__/` | Jest tests |

## Notes

- Text boxes can only go into NOTE files (not PDFs/EPUBs), and always land on the main layer. Lasso the box afterwards to move or resize it.
- The plugin asks for write permission only if the note refuses the insert without it (error 1501).
- Verses the BSB omits (e.g. Matthew 17:21) appear greyed out in the list and are skipped when inserting a range.
- **Layouts:** Paragraph, One per line, or Spaced list (a blank line between verses, like the verse picker).
- **No borders or backgrounds yet.** Tested on device: the documented border value (`textFrameStyle` 3) and the SDK's internal fill/stroke values (0–2 with `textFrameFillColor`/`textColor`) all drew nothing. It's a question for Supernote whether plugins can set text box frames and colours.
- **How settings are remembered.** sn-plugin-lib can't write file contents (FileUtils can only make, list, rename and delete) and has no key-value store, and AsyncStorage would mean shipping native code. So each setting and recent passage is stored as the name of an empty directory in the plugin's own folder (`superbible-state/s.layout=spaced`, `r.0=John%203%3A16`), read back by listing it. If that fails, settings last as long as the plugin process, as before. Reinstalling the plugin may reset them.
- **Below my writing** uses the last element added to the page (`getLastElement`), which is the lowest one when you write top to bottom. If you added something higher up most recently, the passage goes under that instead. Reading every element on the page to find the true bottom would be slow on busy pages.
- **Limit: 30 verses per insert.** That's about one full page at Small text (roughly 22 at Medium and 14 at Large), and it covers 69% of whole chapters. The preview warns before inserting if the passage won't fit on one page at the chosen size.
- **Tap freeze (fixed in 1.1.0).** The host keeps the plugin mounted while it's hidden. RN's ScrollView ignores taps on its children while it thinks a fling is still running or the keyboard is open, and hiding the plugin mid-scroll could leave it thinking that for good. Grids then stopped responding while buttons outside them still worked. `SafeScrollView` always passes taps through to buttons, remounts if a fling never finishes, and remounts every time the plugin is shown again.
- To release an update, raise `versionCode`/`versionName` in `PluginConfig.json` (and `version` in `package.json`), and keep `pluginID` unchanged.

### Corrections from checking the real SDK (sn-plugin-lib 0.1.65)

- `PluginNoteAPI.insertText` and `PluginCommAPI.getPageDisplaySize` are typed as `Promise<Object>`, not `APIResponse`, and `APIResponse` isn't exported from the package root. `src/insert.ts` casts to a local `{ success, result, error: { code, message } }` type, which matches what the SDK returns at runtime.
- `insertText` validates `textRect` as **integers** with non-zero area, and `fontSize ≥ 1`. The page size is rounded so the rectangle stays integral.
- `registerButton` type 1 is documented in the SDK as the "sidebar" button, which is the NOTE toolbar. `['NOTE']` alone is accepted.
- `requestPermission(p, desc)` returns 0 (deny), 1 (while in use) or 2 (always). `desc` is shown only in the "previously denied" dialog. Otherwise the host uses its default text.

## Device checklist

These can only be confirmed on a Supernote. Please report results in an issue.

- [ ] The toolbar button appears in NOTE, is named Super Bible, and opens the UI.
- [ ] No tap freeze after lots of opening and closing: scroll a long grid (Psalms), close the plugin mid-scroll, reopen, and tap a chapter. Also try after typing in the search box.
- [ ] The plugin opens without a noticeable delay. The ~4 MB of bundled text is evaluated when the book grid first renders. If it's slow, switch `bsb.json` to a compact format (one string per chapter, joined with `\u0001`).
- [ ] `insertText` works without asking for FILE:WRITE. If it doesn't, check that the 1501 retry path asks for permission and then inserts.
- [ ] Font size factors (small 0.018, medium 0.022, large 0.027 × page width) look right. Note which model you tested on.
- [ ] The height estimate is reasonable. Try Psalm 119:1–30: the preview should warn that it won't fit on one page at Medium, and the inserted box should roughly match the text.
- [ ] Superscript verse numbers render in the Supernote font, including cross-chapter markers like `⁸:³⁹`, where the colon isn't superscript.
- [ ] The en dash, curly quotes and em dash in references and text render.
- [ ] The UI is readable on e-ink: no ghosting, and tap targets are big enough. There are deliberately no spinners or animations.
- [ ] The text box can be lassoed and moved after inserting.
- [ ] Spaced list inserts with a blank line between verses.
- [ ] Below my writing: the passage lands just under your last writing (try after handwriting, and after a previous passage); the preview warns when the page is too full.
- [ ] Lasso button appears for lassoed handwriting and for a lassoed text box (and not for images/links).
- [ ] Handwritten references are recognised: try `Rom 8:28`, `Jn 3:16-18`, `1 Cor 13:4-7`, `Ps 23`. With *Replace handwriting* on, the handwriting disappears and the passage appears in its place.
- [ ] If an insert fails after the handwriting was removed, Undo in the note brings the handwriting back.
- [ ] Lassoing a Super Bible text box, changing the range and tapping *Update text box* rewrites that box in place.
- [ ] Settings and Recent passages survive a device restart.
- [ ] The preview box stays about a third of the screen tall, with the options visible below it.
- [ ] The button does not appear in DOC/PDF (it is registered for NOTE only).

## Licence

The code is released under the [MIT License](LICENSE). The Berean Standard Bible text in `src/data/bsb.json` is in the public domain.
