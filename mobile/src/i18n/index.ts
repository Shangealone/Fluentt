import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fil from './locales/fil.json';

export type InterfaceLanguage = 'en' | 'fil';

export const resources = {
  en: { translation: en },
  fil: { translation: fil },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export async function setInterfaceLanguage(languageCode: InterfaceLanguage): Promise<void> {
  await i18n.changeLanguage(languageCode);
}

export default i18n;
