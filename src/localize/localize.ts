import * as en from './languages/en.json';
import * as pt_BR from './languages/pt_br.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: any = {
  en: en,
  pt_BR: pt_BR,
};

export function localize(string: string, search = '', replace = ''): string {
  const canonicalizeLanguage = (language?: string | null): string | null => {
    if (!language) {
      return null;
    }
    return language.replace('-', '_');
  };

  // Try the HA language first...
  let lang;
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

  // Default to English is there's still no language setting.
  lang = lang || 'en';
  let translated: string;

  try {
    translated = string.split('.').reduce((o, i) => o[i], languages[lang]);
  } catch (e) {
    translated = string.split('.').reduce((o, i) => o[i], languages['en']);
  }

  if (translated === undefined) {
    translated = string.split('.').reduce((o, i) => o[i], languages['en']);
  }

  if (search !== '' && replace !== '') {
    translated = translated.replace(search, replace);
  }
  return translated;
}
