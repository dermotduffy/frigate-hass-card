import { HomeAssistant } from 'custom-card-helpers';
import * as en from './languages/en.json';

const DEFAULT_LANG = 'en' as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: Record<string, any> = {
  // English as always loaded as it's the fallback language that will be used
  // when translations are not found or before they are loaded (via
  // loadLanguages()).
  [DEFAULT_LANG]: en,
};

// The language is calculated and stored once, then re-used to avoid needing to
// repeat the lookups and to ensure minimal information needs to be plumbed
// through on each localization call.
let frigateCardLanguage: string | undefined;

/**
 * Get the configured language.
 */
export function getLanguage(hass?: HomeAssistant): string {
  const canonicalizeLanguage = (language: string): string => {
    return language.replace('-', '_');
  };

  // Try the hass language first...
  const hassLanguage = hass?.language ?? hass?.selectedLanguage;
  if (hassLanguage) {
    return canonicalizeLanguage(hassLanguage);
  }

  // Then the language that hass may have stored locally.
  const storageLanguage = localStorage.getItem('selectedLanguage');
  if (storageLanguage) {
    const parsedLanguage: string | null = JSON.parse(storageLanguage);
    if (parsedLanguage) {
      return canonicalizeLanguage(parsedLanguage);
    }
  }

  // Then fall back to the browser language.
  for (const language of navigator.languages) {
    const canonicalLanguage = canonicalizeLanguage(language);
    if (canonicalLanguage && canonicalLanguage in languages) {
      return canonicalLanguage;
    }
  }
  return DEFAULT_LANG;
}

/**
 * Load required languages.
 */
export const loadLanguages = async (hass: HomeAssistant): Promise<void> => {
  const lang = getLanguage(hass);
  if (lang === 'it') {
    languages[lang] = await import('./languages/it.json');
  } else if (lang === 'pt') {
    languages[lang] = await import('./languages/pt-PT.json');
  } else if (lang === 'pt_BR') {
    languages[lang] = await import('./languages/pt-BR.json');
  }

  if (lang) {
    frigateCardLanguage = lang;
  }
};

/**
 * Get a localized version of a given string key.
 * @param string The key.
 * @param search An optional search key to be used with 'replace'.
 * @param replace An optional replacement text to be used with 'search'.
 * @returns
 */
export function localize(string: string, search = '', replace = ''): string {
  let translated = '';

  try {
    translated = string
      .split('.')
      .reduce((o, i) => o[i], languages[frigateCardLanguage ?? DEFAULT_LANG]);
  } catch (_) {}

  if (!translated) {
    translated = string.split('.').reduce((o, i) => o[i], languages[DEFAULT_LANG]);
  }

  if (search !== '' && replace !== '') {
    translated = translated.replace(search, replace);
  }
  return translated;
}
