import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '@zimhealth/i18n';
import { api } from './lib/api';
import { storage } from './lib/storage';

const LANGUAGE_STORAGE_KEY = 'zimhealth_language';

// Custom i18next backend that reuses the app's existing `api` client (auth
// headers, platform-aware base URL, timeout/abort) instead of a second HTTP
// stack. English never hits the network — it's the bundled fallback.
const backend = {
  type: 'backend' as const,
  init() {},
  read(language: string, _namespace: string, callback: (err: unknown, data: Record<string, string> | null) => void) {
    if (language === 'en') {
      callback(null, {});
      return;
    }
    api
      .get<Record<string, string>>(`/api/locales/${language}`)
      .then((data) => callback(null, data))
      .catch((err) => callback(err, null));
  },
};

void i18n
  .use(backend)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Restore the learner's saved language choice once SecureStore resolves —
// i18next itself must init synchronously above so early renders have text.
void storage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
  if (saved && saved !== 'en') void i18n.changeLanguage(saved);
});

export function setLanguage(code: string) {
  void storage.setItem(LANGUAGE_STORAGE_KEY, code);
  void i18n.changeLanguage(code);
}

export default i18n;
