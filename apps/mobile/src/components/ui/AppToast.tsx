import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT, DANGER, WARN, SUCCESS } from '../../theme';

export type ToastType = 'info' | 'success' | 'warning' | 'danger';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number; // ms, default 3000
}

interface Props extends ToastConfig {
  visible: boolean;
  onHide: () => void;
}

const TYPE_STYLES: Record<ToastType, { bg: string; icon: string; iconColor: string; border: string }> = {
  info:    { bg: 'rgba(30,41,59,0.97)',  icon: 'information-circle', iconColor: ACCENT,   border: 'rgba(59,130,246,0.4)' },
  success: { bg: 'rgba(20,40,30,0.97)',  icon: 'checkmark-circle',   iconColor: SUCCESS,  border: 'rgba(34,197,94,0.4)' },
  warning: { bg: 'rgba(40,32,10,0.97)',  icon: 'warning',            iconColor: WARN,     border: 'rgba(245,158,11,0.4)' },
  danger:  { bg: 'rgba(40,20,20,0.97)',  icon: 'alert-circle',       iconColor: DANGER,   border: 'rgba(239,68,68,0.4)' },
};

export function AppToast({ visible, message, type = 'info', duration = 3000, onHide }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // auto-hide
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 120, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onHide, translateY, opacity]);

  if (!visible) return null;

  const ts = TYPE_STYLES[type];

  return (
    <Animated.View
      style={[
        s.container,
        {
          bottom: insets.bottom + 24,
          backgroundColor: ts.bg,
          borderColor: ts.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons name={ts.icon as never} size={20} color={ts.iconColor} style={s.icon} />
      <Text style={s.text} numberOfLines={3}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
