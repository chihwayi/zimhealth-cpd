import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { setLanguage } from '../../i18n';

interface LocaleOption {
  code: string;
  name: string;
  countryCodes: string[];
}

interface Props {
  dark?: boolean;
}

export function LanguageSwitcher({ dark = false }: Props) {
  const { i18n } = useTranslation();
  const localesQuery = useQuery<{ locales: LocaleOption[] }>({
    queryKey: ['available-locales'],
    queryFn: () => api.get('/api/locales'),
    staleTime: 1000 * 60 * 10,
  });

  const options = [{ code: 'en', name: 'English' }, ...(localesQuery.data?.locales ?? [])];

  return (
    <label
      className={clsx(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        dark ? 'border border-white/15 bg-white/8 text-white/80' : 'border border-slate-200 bg-white text-slate-700',
      )}
    >
      <Globe size={15} className={dark ? 'text-white/60' : 'text-slate-400'} />
      <span className="sr-only">Language</span>
      <select
        value={i18n.resolvedLanguage ?? 'en'}
        onChange={(e) => setLanguage(e.target.value)}
        className={clsx(
          'flex-1 bg-transparent text-sm font-medium focus:outline-none',
          dark ? '[&>option]:text-slate-900' : '',
        )}
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
