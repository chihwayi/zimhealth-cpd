interface LogoMarkProps {
  className?: string;
}

// Icon-only mark: a rounded gradient badge with a pulse/ECG line — reads as
// "health" universally, deliberately free of any country's flag colors or
// imagery so it works across every council/country this platform serves.
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cpdhub-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#cpdhub-logo-grad)" />
      <path
        d="M5 21h5l2.5-7 4 13 3.5-10.5 2.5 4.5H35"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface LogoProps {
  variant?: 'full' | 'icon';
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MARK: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

const SIZE_TEXT: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-xl',
};

// Full lockup: icon + "CPD Hub" wordmark. Use variant="icon" where space is
// tight (e.g. a collapsed sidebar rail).
export function Logo({ variant = 'full', theme = 'dark', size = 'md', className }: LogoProps) {
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900';
  const accentColor = theme === 'dark' ? 'text-accent-400' : 'text-primary-600';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark className={`${SIZE_MARK[size]} flex-shrink-0`} />
      {variant === 'full' && (
        <span className={`font-black tracking-tight leading-none ${SIZE_TEXT[size]} ${textColor}`}>
          CPD<span className={accentColor}>Hub</span>
        </span>
      )}
    </span>
  );
}
