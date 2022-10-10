import * as en from './languages/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: Record<string, any> = {
  // English as always loaded as it's the fallback language that will be used
  // when translations are not found or before they are loaded (via
  // loadLanguages()).
  en: en,
}

/**
 * Get the configured language.
 */
export function getLanguage(): string {
  const canonicalizeLanguage = (language?: string | null): string | null => {
    if (!language) {
      return null;
    }
    return language.replace('-', '_');
  };

  // Try the HA language first...
  let lang: string | null = null;
  const HALanguage = localStorage.getItem('selectedLanguage');
  if (HALanguage) {
    const selectedLanguage = canonicalizeLanguage(JSON.parse(HALanguage));
    if (selectedLanguage) {
      lang = selectedLanguage;
    }
  }

  // Then fall back to the browser language.
  if (!lang) {
    for (const language of navigator.languages) {
      const canonicalLanguage = canonicalizeLanguage(language);
      if (canonicalLanguage && canonicalLanguage in languages) {
        lang = language;
      }
    }
  }
  return lang || 'en';
}

/**
 * Load required languages.
 */
export const loadLanguages = async (): Promise<void> => {
  const lang = getLanguage();
  if (lang === 'it') {
    languages['it'] = await import('./languages/it.json');
  } else if (lang === 'pt_BR') {
    languages['pt_BR'] = await import('./languages/pt-BR.json');
  }
}

/**
 * Get a localized version of a given string key.
 * @param string The key.
 * @param search An optional search key to be used with 'replace'.
 * @param replace An optional replacement text to be used with 'search'.
 * @returns 
 */
export function localize(string: string, search = '', replace = ''): string {
  const lang = getLanguage();
  let translated = '';

  try {
    translated = string.split('.').reduce((o, i) => o[i], languages[lang]);
  } catch (_) {
  }

  if (!translated) {
    translated = string.split('.').reduce((o, i) => o[i], languages['en']);
  }

  if (search !== '' && replace !== '') {
    translated = translated.replace(search, replace);
  }
  return translated;
}
