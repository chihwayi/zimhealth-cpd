import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import type { AuthUser } from '../../store/auth.store';
import type { LoginScreenProps } from '../../navigation/types';
import { GRADIENT_LOGIN, WHATSAPP, VIOLET_500, AMBER_400, DANGER_BG } from '../../theme';

type LoginResponse = { user: AuthUser; accessToken: string; refreshToken: string };
const WHATSAPP_LINK = 'https://wa.me/263771234567';

// ── Glass input on the sunrise gradient ────────────────────────────────────────

function DarkInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);

  return (
    <View style={[s.inputRow, focused && s.inputRowFocused]} pointerEvents="box-none">
      <Ionicons
        name={icon}
        size={18}
        color={focused ? '#fff' : 'rgba(255,255,255,0.5)'}
        style={{ marginRight: 12 }}
      />
      <TextInput
        style={s.inputText}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        secureTextEntry={secureTextEntry && !show}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {secureTextEntry && (
        <Pressable onPress={() => setShow(v => !v)} hitSlop={10}>
          <Ionicons
            name={show ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(255,255,255,0.5)"
          />
        </Pressable>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { t } = useTranslation();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const loginMutation = useMutation({
    mutationFn: () =>
      api.post<LoginResponse>('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      }),
    onSuccess: async (data) => {
      await setAuth(data.user, data.accessToken, data.refreshToken);
    },
  });

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <LinearGradient colors={GRADIENT_LOGIN} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ── Brand ── */}
            <View style={s.brand}>
              <View style={s.logoBadge}>
                <Image source={require('../../../assets/icon-mark.png')} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.headline}>Your CPD points, rising every day you show up.</Text>
              <Text style={s.sub}>One account for the app and WhatsApp — track hours, courses and your council renewal in one place.</Text>
            </View>

            {/* ── Form ── */}
            <View style={s.form}>
              <DarkInput
                icon="mail-outline"
                placeholder={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <DarkInput
                icon="lock-closed-outline"
                placeholder={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Pressable style={s.forgotWrap} hitSlop={10}>
                <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
              </Pressable>

              {loginMutation.isError && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color="#fecdd3" />
                  <Text style={s.errorText}>
                    {loginMutation.error?.message ?? t('common.error')}
                  </Text>
                </View>
              )}

              {/* Primary button */}
              <Pressable
                style={[s.btn, (!canSubmit || loginMutation.isPending) && s.btnDisabled]}
                onPress={() => loginMutation.mutate()}
                disabled={!canSubmit || loginMutation.isPending}
              >
                <Text style={s.btnText}>
                  {loginMutation.isPending ? 'Signing in…' : t('common.continue')}
                </Text>
              </Pressable>

              {/* Divider */}
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>OR</Text>
                <View style={s.dividerLine} />
              </View>

              {/* WhatsApp */}
              <Pressable style={s.waBtn} onPress={() => Linking.openURL(WHATSAPP_LINK)}>
                <View style={s.waIconWrap}>
                  <FontAwesome5 name="whatsapp" size={22} color="#fff" />
                </View>
                <Text style={s.waBtnText}>Continue on WhatsApp</Text>
              </Pressable>
            </View>

            {/* ── Footer ── */}
            <View style={s.footer}>
              <Text style={s.footerText}>{t('auth.dontHaveAccount')} </Text>
              <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
                <Text style={s.footerLink}>{t('auth.register')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD = 'rgba(255,255,255,0.12)';
const BORDER = 'rgba(255,255,255,0.22)';
const BORDER_FOCUS = '#fff';

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40, justifyContent: 'center' },

  // Brand
  brand: { paddingTop: 60, paddingBottom: 40 },
  logoBadge: {
    width: 52, height: 52, borderRadius: 16, marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: 32, height: 32 },
  headline: {
    fontFamily: Platform.select({ ios: 'DM Serif Display', android: 'serif', default: 'serif' }),
    color: '#fff',
    fontSize: 30,
    lineHeight: 38,
    maxWidth: 300,
  },
  sub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    marginTop: 14,
    lineHeight: 20,
    maxWidth: 300,
  },

  // Form
  form: { gap: 14 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  inputRowFocused: {
    borderColor: BORDER_FOCUS,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  inputText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -2 },
  forgotText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DANGER_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: '#fecdd3', fontSize: 13, flex: 1 },

  btn: {
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: VIOLET_500,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  btnText: { color: '#2e1065', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  dividerText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: WHATSAPP,
    shadowColor: WHATSAPP,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  waIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  footerText: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  footerLink: { color: AMBER_400, fontSize: 14, fontWeight: '700' },
});
