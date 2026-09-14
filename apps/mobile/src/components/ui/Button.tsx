import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const SHADOW = {
  primary: { shadowColor: '#7c3aed', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  danger:  { shadowColor: '#e11d48', shadowOpacity: 0.25, shadowRadius: 8,  shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  secondary: {},
  ghost: {},
};

const BG: Record<Variant, string> = {
  primary:   'bg-primary-500',
  secondary: 'bg-white border border-slate-200',
  ghost:     'bg-transparent',
  danger:    'bg-red-500',
};

const LABEL: Record<Variant, string> = {
  primary:   'text-white font-bold text-base tracking-wide',
  secondary: 'text-slate-700 font-semibold text-base',
  ghost:     'text-primary-600 font-semibold text-base',
  danger:    'text-white font-bold text-base',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        !isDisabled ? SHADOW[variant] : undefined,
      ]}
      className={`flex-row items-center justify-center rounded-2xl py-4 px-6
        ${BG[variant]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-40' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#7c3aed'} />
      ) : (
        <Text className={LABEL[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
