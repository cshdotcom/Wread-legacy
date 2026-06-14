/**
 * WRead Built-in Dictionaries Registry
 *
 * Auto-registers the built-in MDX dictionaries that ship with WRead.
 * These dictionaries are pre-installed in /public/dictionaries/ and are
 * available to all logged-in users without requiring manual import.
 *
 * WRead Modification: This is a WRead-specific addition that has no
 * equivalent in upstream Readest. The built-in dictionaries include:
 * - 汉英词典（第三版）.mdx (Chinese-English Dictionary 3rd Edition)
 * - 牛津•外研社英汉汉英词典.mdx (Oxford FLTRP English-Chinese Chinese-English Dictionary)
 * - dict.mdx (General Dictionary)
 * - 现汉7.mdx (Modern Chinese Dictionary 7th Edition)
 * - 國語辭典v5简体索引.mdx (Mandarin Dictionary v5 Simplified Index)
 * - 汉语官话方言研究 v2.mdx (Chinese Mandarin Dialect Research v2)
 */
import type { ImportedDictionary, DictionarySettings } from './types';

/** Built-in dictionary definition */
interface BuiltinDictDef {
  id: string;
  name: string;
  filename: string;
  lang?: string;
}

/** All built-in MDX dictionaries that ship with WRead */
export const WREAD_BUILTIN_DICTIONARIES: BuiltinDictDef[] = [
  {
    id: 'wread-builtin-hanying',
    name: '汉英词典（第三版）',
    filename: '汉英词典（第三版）.mdx',
    lang: 'zh',
  },
  {
    id: 'wread-builtin-oxford',
    name: '牛津•外研社英汉汉英词典',
    filename: '牛津•外研社英汉汉英词典.mdx',
    lang: 'zh',
  },
  {
    id: 'wread-builtin-dict',
    name: '通用词典',
    filename: 'dict.mdx',
    lang: 'zh',
  },
  {
    id: 'wread-builtin-xianhan7',
    name: '现代汉语词典第7版',
    filename: '现汉7.mdx',
    lang: 'zh',
  },
  {
    id: 'wread-builtin-guoyu',
    name: '国语辞典v5简体索引',
    filename: '國語辭典v5简体索引.mdx',
    lang: 'zh',
  },
  {
    id: 'wread-builtin-fangyan',
    name: '汉语官话方言研究v2',
    filename: '汉语官话方言研究 v2.mdx',
    lang: 'zh',
  },
];

/**
 * Convert a built-in dictionary definition to an ImportedDictionary
 * that the existing dictionary system can work with.
 */
export function builtinDictToImported(def: BuiltinDictDef): ImportedDictionary {
  return {
    id: def.id,
    kind: 'mdict',
    name: def.name,
    bundleDir: `wread-builtin/${def.id}`,
    files: {
      mdx: def.filename,
    },
    lang: def.lang,
    addedAt: 0, // Built-in, always available
    unavailable: false,
    unsupported: false,
  };
}

/**
 * Get all built-in dictionaries as ImportedDictionary objects.
 */
export function getBuiltinDictionaries(): ImportedDictionary[] {
  return WREAD_BUILTIN_DICTIONARIES.map(builtinDictToImported);
}

/**
 * Check if a dictionary ID belongs to a WRead built-in dictionary.
 */
export function isWReadBuiltinDict(id: string): boolean {
  return id.startsWith('wread-builtin-');
}

/**
 * Get the URL for a built-in MDX file.
 * In the web platform, these are served from /dictionaries/ static path.
 */
export function getBuiltinDictUrl(filename: string): string {
  return `/dictionaries/${encodeURIComponent(filename)}`;
}

/**
 * Merge built-in dictionaries into the user's dictionary list.
 * Built-in dictionaries are always added if not present, but user
 * preferences (order, enabled) are preserved.
 */
export function mergeBuiltinDictionaries(
  userDictionaries: ImportedDictionary[],
): ImportedDictionary[] {
  const existingIds = new Set(userDictionaries.map((d) => d.id));
  const builtins = getBuiltinDictionaries();
  const merged = [...userDictionaries];

  for (const builtin of builtins) {
    if (!existingIds.has(builtin.id)) {
      merged.push(builtin);
    }
  }

  return merged;
}

/**
 * Ensure built-in dictionaries are included in the dictionary settings
 * provider order and enabled list.
 */
export function ensureBuiltinDictSettings(settings: DictionarySettings): DictionarySettings {
  const providerOrder = [...settings.providerOrder];
  const providerEnabled = { ...settings.providerEnabled };

  for (const def of WREAD_BUILTIN_DICTIONARIES) {
    if (!providerOrder.includes(def.id)) {
      // Add built-in dictionaries at the end of the provider order
      providerOrder.push(def.id);
    }
    if (providerEnabled[def.id] === undefined) {
      // Enable built-in dictionaries by default
      providerEnabled[def.id] = true;
    }
  }

  return {
    ...settings,
    providerOrder,
    providerEnabled,
  };
}
