import * as en from './languages/en.json';
import * as pt_BR from './languages/pt_br.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: any = {
  en: en,
  pt_BR: pt_BR,
};

export function localize(string: string, search = '', replace = ''): string {
  // Get the browser language.
  let lang = localStorage
    .getItem('selectedLanguage')
    ?.replace(/['"]+/g, '')
    .replace('-', '_');

  // If that's not specified, try to find the Home Assistant language.
  if (!lang) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hass = (document.querySelector('home-assistant') as any)?.hass;
    lang = hass.selectedLanguage || hass.language;
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
