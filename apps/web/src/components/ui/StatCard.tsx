import clsx from 'clsx';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: 'teal' | 'amber' | 'green' | 'red' | 'blue';
}

const ACCENT_CLASSES = {
  teal: 'bg-primary-100 text-primary-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
};

export function StatCard({ title, value, subtitle, icon, accent = 'teal' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
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

