import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Trend {
  label: string;
  direction: 'up' | 'down' | 'neutral';
}

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: 'teal' | 'amber' | 'green' | 'red' | 'blue';
  trend?: Trend;
}

const ACCENT_CLASSES = {
  teal: 'bg-primary-100 text-primary-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
};

const TREND_CLASSES = {
  up: 'text-green-700 font-bold',
  down: 'text-red-700 font-bold',
  neutral: 'text-slate-500',
};

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function StatCard({ title, value, subtitle, icon, accent = 'teal', trend }: Props) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-600 font-semibold truncate">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          {trend && TrendIcon && (
            <div className={clsx('flex items-center gap-1 mt-2 text-xs font-medium', TREND_CLASSES[trend.direction])}>
              <TrendIcon size={12} />
              {trend.label}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-3',
              ACCENT_CLASSES[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
