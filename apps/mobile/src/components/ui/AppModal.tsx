import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BG, SURFACE2, BORDER2, TEXT, TEXT2,
  ACCENT, DANGER, WARN, SUCCESS,
} from '../../theme';

export type ModalType = 'info' | 'success' | 'warning' | 'danger';

interface ModalButton {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'cancel';
}

export interface AppModalProps {
  visible: boolean;
  type?: ModalType;
  title: string;
  message?: string;
  buttons: ModalButton[];
  onDismiss: () => void;
}

const TYPE_ICON: Record<ModalType, { name: string; color: string }> = {
  info:    { name: 'information-circle', color: ACCENT },
  success: { name: 'checkmark-circle',  color: SUCCESS },
  warning: { name: 'warning',           color: WARN },
  danger:  { name: 'alert-circle',      color: DANGER },
};

const TYPE_GLOW: Record<ModalType, string> = {
  info:    'rgba(124,58,237,0.20)',
  success: 'rgba(34,197,94,0.18)',
  warning: 'rgba(245,158,11,0.18)',
  danger:  'rgba(239,68,68,0.18)',
};

export function AppModal({ visible, type = 'info', title, message, buttons, onDismiss }: AppModalProps) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  const icon = TYPE_ICON[type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={s.backdrop} onPress={onDismiss}>
        <Animated.View style={[s.card, { opacity, transform: [{ scale }], borderColor: TYPE_GLOW[type] }]}>
          {/* Stop backdrop press from closing when tapping inside card */}
          <Pressable onPress={() => null} style={s.inner}>
            {/* Icon badge */}
            <View style={[s.iconBadge, { backgroundColor: TYPE_GLOW[type] }]}>
              <Ionicons name={icon.name as never} size={32} color={icon.color} />
            </View>

            {/* Text */}
            <Text style={s.title}>{title}</Text>
            {!!message && <Text style={s.message}>{message}</Text>}

            {/* Divider */}
            <View style={s.divider} />

            {/* Buttons */}
            <View style={buttons.length > 2 ? s.buttonsCol : s.buttonsRow}>
              {buttons.map((btn, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    s.btn,
                    buttons.length <= 2 && s.btnFlex,
                    btn.variant === 'cancel'  && s.btnCancel,
                    btn.variant === 'danger'  && s.btnDanger,
                    btn.variant === 'primary' && s.btnPrimary,
                    !btn.variant && s.btnCancel,
                    pressed && s.btnPressed,
                  ]}
                  onPress={() => { btn.onPress(); onDismiss(); }}
                >
                  <Text style={[
                    s.btnLabel,
                    btn.variant === 'cancel'  && s.btnLabelCancel,
                    btn.variant === 'danger'  && s.btnLabelDanger,
                    btn.variant === 'primary' && s.btnLabelPrimary,
                    !btn.variant && s.btnLabelCancel,
                  ]}>
                    {btn.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1e293b',
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  inner: {
    padding: 28,
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    color: TEXT2,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: BORDER2,
    marginVertical: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonsCol: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: {
    flex: 1,
  },
  btnCancel: {
    backgroundColor: SURFACE2,
    borderWidth: 1,
    borderColor: BORDER2,
  },
  btnPrimary: {
    backgroundColor: ACCENT,
  },
  btnDanger: {
    backgroundColor: DANGER,
  },
  btnPressed: {
    opacity: 0.75,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnLabelCancel: {
    color: TEXT2,
  },
  btnLabelPrimary: {
    color: '#fff',
  },
  btnLabelDanger: {
    color: '#fff',
  },
});
