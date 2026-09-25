# snBible: handover for Claude Code

You are continuing work on **snBible**, a Supernote e-ink tablet plugin that inserts Berean Standard Bible (BSB) passages into the open note as a text box. The source was written in a chat session that could not build or run it: there was no Android SDK, no network in the sandbox, and no device. Your job is to turn it into a real, building project in a GitHub repository, then fix whatever the real toolchain turns up.

The user is Adam. He is technical, comfortable with code and theology, and wants you to get on with it. Ask only where this file says to ask.

## What you have

`snBible.zip` is somewhere on this machine (probably `~/Downloads`). It unzips to `snBible-source/`:

```
snBible-source/
  App.tsx                 UI: search box, book grid, chapter grid, verse list, preview/options
  index.js                PluginManager.init() + NOTE toolbar button (id 100, showType 1)
  app.json                {"name":"snBible"}; must equal pluginKey
  PluginConfig.json       name/pluginKey snBible, pluginID snbible7q2k9x4mw, uses-permissions FILE:WRITE + INTERNET
  assets/icon/icon.png    128px open-book icon, black on transparent
  src/books.ts            66 books: USFM id, name, short label, chapter count, abbreviations; findBook()
  src/reference.ts        parseReference() free-text parser, formatSpans() label formatter
  src/bibleSource.ts      reads bundled src/data/bsb.json; falls back to bible.helloao.org per chapter
  src/format.ts           Settings type + buildText() (verse numbers, layout, reference position)
  src/insert.ts           computes textRect/fontSize, calls PluginNoteAPI.insertText, retries on error 1501
  src/ui/components.tsx   Button, Choice (segmented control), Toggle; e-ink theme tokens
  src/data/bsb.json       PLACEHOLDER ({"books":[]}); the real data is generated
  scripts/fetch-bsb.mjs   downloads https://bereanbible.com/bsb.txt and writes src/data/bsb.json
  setup.sh                scaffolds the template in a sibling dir and overlays the source (see below)
  README.md
```

`setup.sh` was written for a one-off build. For the repo, you will restructure things so the repository itself is the complete, buildable plugin project (Phase 2).

## Platform facts (researched from docs.supernote.com, September 2026)

- Plugins are **React Native 0.79.2** projects created from the template:
  `npx @react-native-community/cli init <name> --template @supernote-plugin/sn-plugin-template --version 0.79.2`
  The RN version must match exactly or the host rejects the plugin.
- The SDK is the npm package **`sn-plugin-lib`** (included by the template).
- `index.js` must call `AppRegistry.registerComponent(appName, ...)`, then `PluginManager.init()`, then `registerButton(...)`.
- `PluginManager.registerButton(type, appTypes, config)`: type 1 is the toolbar button. `showType: 1` opens the full-screen plugin UI.
- `PluginNoteAPI.insertText({ textContentFull, textRect, fontSize, textAlign, textBold, textItalics, textFrameWidthType, textFrameStyle, textEditable })` returns `APIResponse<boolean>`.
  - It works in NOTE only and always inserts on the main layer.
  - `textRect` must have non-zero area.
  - `textFrameStyle`: 0 none, 3 stroke. `textFrameWidthType`: 0 fixed, 1 auto. `textEditable`: 0 editable.
- `PluginCommAPI.getPageDisplaySize()` gives the current page size in pixels. Use it rather than `PluginFileAPI.getPageSize` for current-page inserts.
  - A5X/A6X2 portrait is 1404×1872; Manta is 1920×2560.
- `PluginManager.closePluginView()` closes the UI.
- **Permissions:**
  - Declare them in `PluginConfig.json` under `uses-permissions`.
  - At runtime, `hasPermission(p)` returns 1 if granted. `requestPermission(p, desc)` returns 1 (this session), 2 (always), or 0/-1 (denied).
  - Error codes: 1500 means the permission was not declared; 1501 means write is not granted.
  - Network access needs `plugin.permission.INTERNET`.
- **Packaging:** `./buildPlugin.sh` (or `.\buildPlugin.ps1`) writes `build/outputs/<name>.snplg`.
  - It generates `PluginConfig.json` only if one is missing.
  - `pluginKey` must equal the `app.json` name.
  - Never change `pluginID` once released.
- **Install:** copy the `.snplg` to `MyStyle/` on the device, then Settings → Apps → Plugins → Add Plugin.
- **Docs:** https://docs.supernote.com/en (index at https://docs.supernote.com/llms.txt). There is also a docs MCP server; add it with
  `claude mcp add --transport http --scope project supernote-docs https://docs.supernote.com/mcp`
  and treat it as authoritative over this file.

## BSB data sources

- **Primary:** `https://bereanbible.com/bsb.txt`. It starts with a BOM and 3 header lines, then one line per verse: `Genesis 1:1<TAB>In the beginning…`.
  - Books appear in canonical order.
  - Psalms is written as "Psalm".
  - Expect about 31,100 lines.
  - Verses the BSB omits may be blank or missing. The converter fills gaps with `""` and the UI greys them out.
- **Fallback:** `https://bible.helloao.org/api/BSB/{USFM}/{chapter}.json`. Verse blocks have `type: "verse"` and `number`; their `content` mixes strings, `{text}`, `{noteId}` and `{lineBreak}`.
- The BSB is public domain.

## Phase 1: unpack and orient (no questions needed)

1. Find the zip, unzip it into a working directory, and read every file.
2. Check the toolchain: `node -v` (18+), `java -version` (17), `ANDROID_HOME`/`ANDROID_SDK_ROOT`, and `gh auth status`.
3. Report what is missing and how to install it on this OS before continuing. Don't install system packages without saying so.

## Phase 2: make the repo a complete plugin project

1. Scaffold the template as `snBible` (the command above, with `--skip-git-init`) in the intended repo location.
2. Overlay the source files: `App.tsx`, `index.js`, `app.json`, `PluginConfig.json`, `src/`, `scripts/`, `assets/icon/icon.png`.
3. Replace the template README with the provided one, updated for the new layout.
4. Delete `setup.sh`. It is superseded because the repo now is the project. If a convenience script is still useful, rewrite it as `npm run build:plugin`.
5. In `package.json`, add these scripts:
   - `fetch-bsb`: `node scripts/fetch-bsb.mjs`
   - `typecheck`: `tsc --noEmit`
   - `build:plugin`: runs `./buildPlugin.sh`
6. Run `npm run fetch-bsb` and confirm it reports 66 books and roughly 31k verses.
7. **Commit the generated `src/data/bsb.json`.** It is public domain and about 4–5 MB, and committing it keeps builds reproducible and offline. Keep the fetch script so it can be regenerated.
8. `.gitignore`: add `node_modules/`, `build/`, `android/build`, `android/app/build`, `android/.gradle`, `.idea`, `*.keystore` except the template's `debug.keystore` if the template commits it, and `.DS_Store`.

## Phase 3: make it compile against the real SDK

The code was only typechecked against hand-written stubs. Check it against the real `sn-plugin-lib` type definitions in `node_modules/sn-plugin-lib` and fix any mismatch. In particular:

- the shape of `APIResponse` and whether the error code is `error.code`
- the return types of `hasPermission` and `requestPermission`
- the result shape of `getPageDisplaySize`
- the parameter type of `insertText`
- whether `registerButton` accepts `['NOTE']` alone

Then:

1. Run `npm run typecheck` and the template's lint, and fix what they report.
2. Add Jest tests for the pure logic: `src/reference.ts`, `src/books.ts` and `src/format.ts`. These inputs are known to work and should stay working:
   - `genesis 1:1-5`, `Gen 1`, `Jn 3:16`, `1 Cor 13:4-7`, `Ps 23` (label "Psalm 23")
   - `Rom 8:38-9:2`, `Jude 3-5`, `John 3:16, 18-21`, `Gen 1-2`
   - `first john 1:9`, `I John 4:8`, `Gen. 1:1`, `Philemon 1:6` (label "Philemon 6"), `deuter 6:4`
   - `Genesis 51` → error, `John 3:5-2` → error, `jo 1:1` → ambiguous error
   - Also check that no alias maps to two books.
3. Build with `./buildPlugin.sh`. Watch the Metro bundle size and time; the JSON is required lazily inside `bibleSource.ts`. If Hermes or Metro struggles with the large JSON, switch to a compact format such as one string per chapter joined with `\u0001`, and update `fetch-bsb.mjs` and `getChapter` together.

## Phase 4: GitHub repository (ask first)

1. Before creating anything, ask Adam in a single message:
   - repo name (default `snBible`)
   - visibility (default private)
   - code license (suggest MIT; note in the README that the BSB text is public domain)
2. Then:
   - `git init`, make a clean initial commit, and follow with logical commits for the Phase 3 fixes.
   - `gh repo create <name> --private|--public --source . --push`, with a description like "Supernote plugin: insert Berean Standard Bible passages into notes".
3. Add a GitHub Actions workflow `.github/workflows/build.yml`:
   - Ubuntu runner with `actions/setup-node` (Node 20) and `actions/setup-java` (Temurin 17). The Android SDK is preinstalled on `ubuntu-latest`.
   - Steps: `npm ci`, `npm run typecheck`, `npm test`, `./buildPlugin.sh`.
   - Upload `build/outputs/*.snplg` as an artifact.
   - On `v*` tags, attach the `.snplg` to a GitHub Release.
   - Get it green.
4. Tag `v1.0.0` only after Adam has tested on a device. Until then, leave the release step unexercised or use a pre-release.

## Phase 5: things only a device can confirm

Write these as a checklist in the README or in GitHub issues, and ask Adam to report back:

- The toolbar button appears in NOTE and opens the UI.
- `insertText` works without asking for FILE:WRITE. If it doesn't, check that the 1501 retry path runs.
- The font size factors (small 0.018, medium 0.022, large 0.027 × page width) look right on his model.
- The height estimate is reasonable; test Psalm 119 as a long passage.
- Superscript verse numbers render in the Supernote font.
- The en dash, curly quotes and em dash in references and text render.
- The UI is readable on e-ink: no ghosting, and tap targets are big enough. There are deliberately no spinners or animations.
- The text box can be lassoed and moved after inserting.
- Behaviour when opened on a DOC/PDF. The button is registered for NOTE only, so it should not appear there.

## Ideas for later (don't start without asking)

- Remember settings between sessions (plugin private directory or AsyncStorage, if the host supports it).
- Recent passages list.
- A lasso-toolbar button that replaces a lassoed text box with an updated passage.
- More public-domain translations from helloao (WEB, KJV), with the translation chosen in settings.
- Optional footnotes from the helloao data.

## Working style

- Keep commits small, with messages that say why.
- Don't change `pluginID`, the button `id` (100) or `pluginKey` without asking.
- When the docs or real SDK types disagree with this file, trust them and note the correction in the README.
