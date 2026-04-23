import type { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'teal' | 'slate';
}

const BG: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-white border border-slate-100',
  teal:    'bg-primary-500',
  slate:   'bg-slate-50 border border-slate-100',
};

export function Card({ children, className = '', variant = 'default' }: CardProps) {
  return (
    <View className={`rounded-3xl shadow-sm p-4 ${BG[variant]} ${className}`}>
      {children}
    </View>
  );
}
