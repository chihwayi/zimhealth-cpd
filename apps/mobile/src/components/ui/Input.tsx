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
  editable = true,
}: InputProps) {
  const [show, setShow] = useState(false);
  const defaultCapitalize = keyboardType === 'email-address' ? 'none' : 'sentences';

  return (
    <View className="gap-y-1.5">
      <Text className="text-sm font-semibold text-slate-800">{label}</Text>
      <View
        className={`flex-row items-center rounded-2xl border px-4 py-3.5
          ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}
          ${!editable ? 'bg-slate-50' : ''}`}
      >
        <TextInput
          className="flex-1 text-sm text-slate-900"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureTextEntry && !show}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? defaultCapitalize}
          autoCorrect={false}
          editable={editable}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
            <Ionicons
              name={show ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color="#94a3b8"
            />
          </Pressable>
        )}
      </View>
      {error && <Text className="text-xs text-red-500">{error}</Text>}
      {hint && !error && <Text className="text-xs text-slate-400">{hint}</Text>}
    </View>
  );
}
