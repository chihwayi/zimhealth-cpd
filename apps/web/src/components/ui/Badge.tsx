import clsx from 'clsx';

type Variant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'clinical' | 'management' | 'ethics' | 'research';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  default: 'bg-slate-100 text-slate-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  clinical: 'bg-blue-100 text-blue-700',
  management: 'bg-violet-100 text-violet-700',
  ethics: 'bg-orange-100 text-orange-700',
  research: 'bg-teal-100 text-teal-700',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
