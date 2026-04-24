import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import type { AuthUser } from '../../store/auth.store';
import type { LoginScreenProps } from '../../navigation/types';

type LoginResponse = { user: AuthUser; accessToken: string; refreshToken: string };

// ── Dark glass input ──────────────────────────────────────────────────────────

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
        color={focused ? '#60a5fa' : 'rgba(255,255,255,0.35)'}
        style={{ marginRight: 12 }}
      />
      <TextInput
        style={s.inputText}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
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
            color="rgba(255,255,255,0.3)"
          />
        </Pressable>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: LoginScreenProps) {
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
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand ── */}
          <View style={s.brand}>
            <Image
              source={require('../../../assets/brand-logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.headline}>Welcome back</Text>
            <Text style={s.sub}>Log in to continue your CPD journey</Text>
          </View>

          {/* ── Form ── */}
          <View style={s.form}>
            <DarkInput
              icon="mail-outline"
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <DarkInput
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Pressable style={s.forgotWrap} hitSlop={10}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </Pressable>

            {loginMutation.isError && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color="#fca5a5" />
                <Text style={s.errorText}>
                  {loginMutation.error?.message ?? 'Login failed. Please try again.'}
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
                {loginMutation.isPending ? 'Signing in…' : 'Log In'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            {/* WhatsApp */}
            <Pressable style={s.waBtn}>
              <View style={s.waIconWrap}>
                <FontAwesome5 name="whatsapp" size={22} color="#fff" />
              </View>
              <Text style={s.waBtnText}>Continue with WhatsApp</Text>
            </Pressable>
          </View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <Text style={s.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
              <Text style={s.footerLink}>Register here</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BG   = '#0f172a';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.10)';
const BORDER_FOCUS = 'rgba(96,165,250,0.7)';

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },

  // Brand
  brand: { alignItems: 'center', paddingTop: 52, paddingBottom: 44 },
  logo:  { width: 200, height: 54 },
  headline: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 32,
    letterSpacing: -0.5,
  },
  sub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
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
    backgroundColor: 'rgba(96,165,250,0.06)',
  },
  inputText: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
  },

  forgotWrap: { alignSelf: 'flex-end', marginTop: -2 },
  forgotText: { color: '#60a5fa', fontSize: 13, fontWeight: '500' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1 },

  btn: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: '600', letterSpacing: 1 },

  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#25D366',
    shadowColor: '#25D366',
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
  footerText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  footerLink: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
});
