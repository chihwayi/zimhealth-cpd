import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import { en } from '@zimhealth/i18n';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'zimhealth-language';

// English ships built into the bundle so the app never has an empty/loading
// UI on first paint or offline. Every other language is fetched at runtime
// from the LanguagePack the admin uploaded — no rebuild needed to add one.
i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    lng: localStorage.getItem(STORAGE_KEY) || 'en',
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    // Translation keys are flat strings like "common.save", not nested
    // objects — disable the dot-as-nesting behaviour i18next defaults to.
    keySeparator: false,
    nsSeparator: false,
    backend: {
      loadPath: `${API_BASE}/api/locales/{{lng}}`,
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export function setLanguage(code: string) {
  localStorage.setItem(STORAGE_KEY, code);
  void i18n.changeLanguage(code);
}

export default i18n;
