import { Text, View } from 'react-native';

type Variant = 'teal' | 'green' | 'amber' | 'slate' | 'white' | 'red';

interface BadgeProps {
  label: string;
  variant?: Variant;
}

const STYLE: Record<Variant, { bg: string; text: string }> = {
  teal:  { bg: 'bg-primary-100', text: 'text-primary-700' },
  green: { bg: 'bg-green-100',   text: 'text-green-700'   },
  amber: { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  slate: { bg: 'bg-slate-100',   text: 'text-slate-600'   },
  white: { bg: 'bg-white/20',    text: 'text-white'       },
  red:   { bg: 'bg-red-100',     text: 'text-red-600'     },
};

export function Badge({ label, variant = 'teal' }: BadgeProps) {
  const { bg, text } = STYLE[variant];
  return (
    <View className={`${bg} self-start rounded-full px-2.5 py-1`}>
      <Text className={`${text} text-xs font-semibold`}>{label}</Text>
    </View>
  );
}
