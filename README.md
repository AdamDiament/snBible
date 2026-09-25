# snBible

A Supernote plugin that inserts Berean Standard Bible passages into the current note as a text box.

Tap the **snBible** button in a note's toolbar, then either pick **book → chapter → verses** (tap the first verse, then the last), or type a reference such as `genesis 1:1-5` and press **Go**. The preview shows exactly what will be inserted; adjust verse numbers, layout, reference position, size and placement, then tap **Insert into note**.

## Build and install

You need Node 18+, JDK 17 and the Android SDK, set up as in the [Supernote environment guide](https://docs.supernote.com/en/environment).

```bash
cd snBible-source
./setup.sh
```

The script creates a sibling `snBible/` project from the official template (`@supernote-plugin/sn-plugin-template`, React Native 0.79.2), copies this source in, downloads `bsb.txt` from bereanbible.com into `src/data/bsb.json`, and runs `buildPlugin.sh`.

Copy `snBible/build/outputs/*.snplg` to **MyStyle** on the Supernote, then go to **Settings → Apps → Plugins → Add Plugin**.

On Windows, run the same steps by hand: create the project with the `npx @react-native-community/cli init snBible --template @supernote-plugin/sn-plugin-template --version 0.79.2` command, copy the files listed in `setup.sh`, run `node scripts/fetch-bsb.mjs`, then `.\buildPlugin.ps1`.

## Reference formats the text box accepts

| Typed | Result |
|---|---|
| `genesis 1:1-5`, `Gen 1:1–5` | Genesis 1:1–5 |
| `Jn 3:16`, `first john 1:9`, `I John 4:8` | single verses |
| `Rom 8:38-9:2`, `Isa 52:13-53:12` | ranges across chapters |
| `Ps 23`, `Gen 1-2` | whole chapters |
| `John 3:16, 18-21` | several pieces of one chapter |
| `Jude 3-5`, `Philemon 6` | verses in one-chapter books |
| `John`, `1 cor` | opens that book's chapter list |

Abbreviations like `Matt`, `Deut`, `Phil`, `Phlm`, `Eccl`, `Song`, `Rev` all work. Ambiguous ones (`Jo`, `Ez`) ask you to type more.

## Where the text comes from

- **Offline (default):** `npm run fetch-bsb` converts [bereanbible.com/bsb.txt](https://bereanbible.com/bsb.txt) (one verse per line) into `src/data/bsb.json`, which is bundled into the plugin. No Wi-Fi needed on the device.
- **Online fallback:** if you build without that step, chapters are downloaded on demand from the [Free Use Bible API](https://bible.helloao.org) (`/api/BSB/{BOOK}/{chapter}.json`); the plugin asks for internet permission the first time.

The BSB is in the public domain.

## Files

| File | Purpose |
|---|---|
| `index.js` | Initialises the plugin and registers the NOTE toolbar button |
| `App.tsx` | The picker, search box and preview UI |
| `src/books.ts` | 66 books, chapter counts, abbreviations |
| `src/reference.ts` | Reference parser and label formatting |
| `src/bibleSource.ts` | Offline bundle reader and online fallback |
| `src/format.ts` | Turns verses into the text box string (options live here) |
| `src/insert.ts` | Sizes and places the text box, calls `PluginNoteAPI.insertText` |
| `scripts/fetch-bsb.mjs` | Downloads and converts the BSB text |
| `PluginConfig.json` | Plugin name, ID, version and permissions |

## Notes

- Text boxes can only go into NOTE files (not PDFs/EPUBs), and always land on the main layer. Lasso the box afterwards to move or resize it.
- The plugin asks for write permission only if the note refuses the insert without it.
- Verses the BSB omits (e.g. Matthew 17:21) appear greyed out in the list and are skipped when inserting a range.
- To release an update, raise `versionCode`/`versionName` in `PluginConfig.json` and keep `pluginID` unchanged.
