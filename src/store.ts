import { FileUtils, PluginManager } from 'sn-plugin-lib';
import { DEFAULT_SETTINGS, Settings } from './format';

/**
 * Settings and recent passages, kept between plugin restarts.
 *
 * sn-plugin-lib has no way to write file contents or key-value data (FileUtils can
 * only make, list, rename and delete), and AsyncStorage would mean shipping native code.
 * So each value is stored as the *name* of an empty directory inside the plugin's own
 * folder, e.g. `s.layout=spaced` or `r.0=John%203%3A16`, and read back by listing it.
 * Anything unreadable falls back to the defaults, so the worst case is today's
 * behaviour: settings last only as long as the plugin process.
 */
export type Stored = { settings: Settings; recents: string[] };

export const RECENT_MAX = 6;

const CHOICES: { [K in keyof Settings]: ReadonlyArray<string> } = {
  verseNumbers: ['plain', 'superscript', 'off'],
  layout: ['paragraph', 'lines', 'spaced'],
  reference: ['top', 'bottom', 'off'],
  includeTranslation: ['true', 'false'],
  textSize: ['small', 'medium', 'large'],
  bold: ['true', 'false'],
  placement: ['below', 'top', 'middle'],
};

export function encodeState(st: Stored): string[] {
  const names = (Object.keys(CHOICES) as Array<keyof Settings>).map(k => `s.${k}=${String(st.settings[k])}`);
  st.recents.slice(0, RECENT_MAX).forEach((r, i) => names.push(`r.${i}=${encodeURIComponent(r)}`));
  return names;
}

export function decodeState(names: string[]): Stored {
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const recents: Array<[number, string]> = [];
  for (const name of names) {
    const s = /^s\.(\w+)=(.*)$/.exec(name);
    if (s && s[1] in CHOICES && CHOICES[s[1] as keyof Settings].includes(s[2])) {
      settings[s[1]] = s[2] === 'true' ? true : s[2] === 'false' ? false : s[2];
      continue;
    }
    const r = /^r\.(\d+)=(.+)$/.exec(name);
    if (r) {
      try {
        recents.push([Number(r[1]), decodeURIComponent(r[2])]);
      } catch {
        // skip a mangled entry
      }
    }
  }
  recents.sort((a, b) => a[0] - b[0]);
  return { settings: settings as Settings, recents: recents.map(([, label]) => label).slice(0, RECENT_MAX) };
}

/** Most recent first, no duplicates. */
export function pushRecent(recents: string[], label: string): string[] {
  return [label, ...recents.filter(r => r !== label)].slice(0, RECENT_MAX);
}

// ---- device I/O ------------------------------------------------------------

async function stateDir(): Promise<string | null> {
  const base = await PluginManager.getPluginDirPath();
  return base ? `${base.replace(/\/+$/, '')}/superbible-state` : null;
}

const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? '';

export async function loadStored(): Promise<Stored | null> {
  try {
    const dir = await stateDir();
    if (!dir || !(await FileUtils.exists(dir))) {
      return null;
    }
    // Typed as string[], but the native side returns { path, type } objects.
    const list = ((await FileUtils.listFiles(dir)) ?? []) as Array<string | { path?: string }>;
    return decodeState(list.map(e => basename(typeof e === 'string' ? e : e?.path ?? '')));
  } catch {
    return null;
  }
}

let pending: Stored | null = null;
let writing = false;

/** Rewrites the state directory. Calls made while a write is running collapse into one more write. */
export async function saveStored(st: Stored): Promise<void> {
  pending = st;
  if (writing) {
    return;
  }
  writing = true;
  try {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        const dir = await stateDir();
        if (!dir) {
          return;
        }
        await FileUtils.deleteDir(dir);
        await FileUtils.makeDir(dir);
        for (const name of encodeState(next)) {
          await FileUtils.makeDir(`${dir}/${name}`);
        }
      } catch {
        // keep going with in-memory settings
      }
    }
  } finally {
    writing = false;
  }
}
