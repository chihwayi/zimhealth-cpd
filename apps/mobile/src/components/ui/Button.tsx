import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const BG: Record<Variant, string> = {
  primary:   'bg-primary-500',
  secondary: 'bg-white border border-primary-400',
  ghost:     'bg-transparent',
  danger:    'bg-red-500',
};

const LABEL: Record<Variant, string> = {
  primary:   'text-white font-semibold text-base',
  secondary: 'text-primary-600 font-semibold text-base',
  ghost:     'text-primary-600 font-semibold text-base',
  danger:    'text-white font-semibold text-base',
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
      className={`flex-row items-center justify-center rounded-2xl py-4 px-6
        ${BG[variant]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#0d9488'} />
      ) : (
        <Text className={LABEL[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
