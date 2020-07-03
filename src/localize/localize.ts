import * as en from './languages/en.json';
import * as nb from './languages/nb.json';

var languages = {
  en: en,
  nb: nb,
};

export function localize(string: string, search: string = '', replace: string = '') {

  const lang = (localStorage.getItem('selectedLanguage') || 'en').replace(/['"]+/g, '').replace('-', '_');

  var translated: string;

  try {
    tranlated = string.split('.').reduce((o, i) => o[i], languages[lang]);
  } catch (e) {
    tranlated = string.split('.').reduce((o, i) => o[i], languages['en']);
  }

  if (tranlated === undefined) tranlated = string.split('.').reduce((o, i) => o[i], languages['en']);

  if (search !== '' && replace !== '') {
    tranlated = tranlated.replace(search, replace);
  }
  return tranlated;
}
