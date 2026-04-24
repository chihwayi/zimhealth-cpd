import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface Trend {
  label: string;
  direction: 'up' | 'down' | 'neutral';
}

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'teal' | 'amber' | 'green' | 'red' | 'blue';
  trend?: Trend;
}

const ACCENT_BG: Record<string, string> = {
  teal: 'bg-gradient-to-br from-primary-600 to-primary-800',
  blue: 'bg-gradient-to-br from-blue-600 to-blue-800',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-600',
  green: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
  red: 'bg-gradient-to-br from-rose-500 to-rose-700',
};

const ACCENT_ICON: Record<string, string> = {
  teal: 'bg-white/20 text-white',
  blue: 'bg-white/20 text-white',
  amber: 'bg-white/20 text-white',
  green: 'bg-white/20 text-white',
  red: 'bg-white/20 text-white',
};

const TREND_CLASSES = {
  up: 'text-white/80',
  down: 'text-white/80',
  neutral: 'text-white/60',
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function StatCard({ title, value, subtitle, icon, accent = 'teal', trend }: Props) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  return (
    <div
      className={clsx(
        'rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5',
        ACCENT_BG[accent],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 truncate">{title}</p>
          <p className="text-4xl font-black text-white mt-2 tabular-nums leading-none">{value}</p>
          {subtitle && <p className="text-sm text-white/70 mt-1.5 font-medium">{subtitle}</p>}
          {trend && TrendIcon && (
            <div className={clsx('flex items-center gap-1.5 mt-3 text-xs font-semibold', TREND_CLASSES[trend.direction])}>
              <TrendIcon size={12} />
              {trend.label}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0',
              ACCENT_ICON[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
