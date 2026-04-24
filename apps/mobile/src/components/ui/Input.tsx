import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string;
  hint?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  hint,
  keyboardType = 'default',
  autoCapitalize,
  autoCorrect = false,
  editable = true,
}: InputProps) {
  const [show,     setShow]     = useState(false);
  const [focused,  setFocused]  = useState(false);

  const defaultCapitalize = keyboardType === 'email-address' ? 'none' : 'sentences';

  const borderColor = error
    ? 'border-red-400'
    : focused
      ? 'border-primary-500'
      : 'border-slate-200';

  const bgColor = error ? 'bg-red-50' : !editable ? 'bg-slate-50' : 'bg-white';

  return (
    <View className="gap-y-1.5">
      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</Text>
      <View
        className={`flex-row items-center rounded-2xl border px-4 py-4 ${borderColor} ${bgColor}`}
        style={focused && !error ? { shadowColor: '#3b82f6', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } } : undefined}
      >
        <TextInput
          className="flex-1 text-sm text-slate-900"
          style={{ lineHeight: 20 }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#cbd5e1"
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? defaultCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} className="pl-2">
            <Ionicons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={focused ? '#3b82f6' : '#94a3b8'}
            />
          </Pressable>
        )}
      </View>
      {error  && <Text className="text-xs text-red-500 pl-1">{error}</Text>}
      {hint && !error && <Text className="text-xs text-slate-400 pl-1">{hint}</Text>}
    </View>
  );
}
