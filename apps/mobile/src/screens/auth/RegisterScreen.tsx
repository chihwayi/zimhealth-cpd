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
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import type { AuthUser } from '../../store/auth.store';
import type { RegisterScreenProps } from '../../navigation/types';
import { BG, VIOLET_600, VIOLET_500, AMBER_400, DANGER_BG } from '../../theme';

type RegisterResponse = { user: AuthUser; accessToken: string; refreshToken: string };

const CADRE_OPTIONS = [
  { value: 'NURSE',            label: 'Nurse'             },
  { value: 'MIDWIFE',          label: 'Midwife'           },
  { value: 'PHARMACIST',       label: 'Pharmacist'        },
  { value: 'CLINICAL_OFFICER', label: 'Clinical Officer'  },
  { value: 'LAB_TECH',         label: 'Lab Technician'    },
] as const;
type CadreValue = typeof CADRE_OPTIONS[number]['value'];

// ── Dark glass input ──────────────────────────────────────────────────────────

function DarkInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  hint,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  hint?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) {
  const [focused, setFocused] = useState(false);
  const [show,    setShow]    = useState(false);

  return (
    <View style={{ gap: 6 }} pointerEvents="box-none">
      <View style={[s.inputRow, focused && s.inputRowFocused]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? '#c4b5fd' : 'rgba(255,255,255,0.4)'}
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
      {hint && (
        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, paddingLeft: 4 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [step, setStep] = useState<1 | 2>(1);

  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [cadre,       setCadre]       = useState<CadreValue | ''>('');
  const [nczReg,      setNczReg]      = useState('');
  const [institution, setInstitution] = useState('');
  const [province,    setProvince]    = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);

  const registerMutation = useMutation({
    mutationFn: () =>
      api.post<RegisterResponse>('/api/auth/register', {
        fullName:              fullName.trim(),
        email:                 email.trim().toLowerCase(),
        password,
        phone:                 phone.trim() || undefined,
        cadre:                 cadre || undefined,
        nczRegistrationNumber: nczReg.trim() || undefined,
        institution:           institution.trim() || undefined,
        province:              province.trim() || undefined,
      }),
    onSuccess: async (data) => {
      await setAuth(data.user, data.accessToken, data.refreshToken);
    },
  });

  const step1Valid =
    fullName.trim().length >= 2 && email.includes('@') && password.length >= 8;

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
          {/* ── Header ── */}
          <View style={s.header}>
            <Pressable
              onPress={step === 1 ? () => navigation.goBack() : () => setStep(1)}
              hitSlop={12}
              style={s.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.5)" />
            </Pressable>

            <View style={s.brand}>
              <Image
                source={require('../../../assets/brand-logo.png')}
                style={s.logo}
                resizeMode="contain"
              />
              <Text style={s.headline}>
                {step === 1 ? 'Create account' : 'Almost there'}
              </Text>
              <Text style={s.sub}>
                {step === 1
                  ? 'Join health professionals across the region'
                  : 'Tell us about your profession'}
              </Text>

              {/* Step dots */}
              <View style={s.dots}>
                <View style={[s.dot, step === 1 && s.dotActive]} />
                <View style={[s.dot, step === 2 && s.dotActive]} />
              </View>
            </View>
          </View>

          {/* ── Form ── */}
          <View style={s.form}>
            {step === 1 ? (
              <>
                <DarkInput
                  icon="person-outline"
                  placeholder="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
                <DarkInput
                  icon="mail-outline"
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <DarkInput
                  icon="lock-closed-outline"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  hint="At least 8 characters"
                />
                <DarkInput
                  icon="call-outline"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />

                <Pressable
                  style={[s.btn, !step1Valid && s.btnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={!step1Valid}
                >
                  <Text style={s.btnText}>Next: Professional Details →</Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Cadre pills */}
                <View style={{ gap: 10 }}>
                  <Text style={s.sectionLabel}>Your cadre</Text>
                  <View style={s.pills}>
                    {CADRE_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setCadre(opt.value)}
                        style={[s.pill, cadre === opt.value && s.pillActive]}
                      >
                        <Text style={[s.pillText, cadre === opt.value && s.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <DarkInput
                  icon="card-outline"
                  placeholder="Council registration number"
                  value={nczReg}
                  onChangeText={setNczReg}
                  autoCapitalize="characters"
                  hint="Optional — for automatic council reporting"
                />
                <DarkInput
                  icon="business-outline"
                  placeholder="Institution (optional)"
                  value={institution}
                  onChangeText={setInstitution}
                  autoCapitalize="words"
                />
                <DarkInput
                  icon="location-outline"
                  placeholder="Province (optional)"
                  value={province}
                  onChangeText={setProvince}
                  autoCapitalize="words"
                />

                {registerMutation.isError && (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle-outline" size={15} color="#fca5a5" />
                    <Text style={s.errorText}>
                      {registerMutation.error?.message ?? 'Registration failed. Please try again.'}
                    </Text>
                  </View>
                )}

                <Pressable
                  style={[s.btn, registerMutation.isPending && s.btnDisabled]}
                  onPress={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                >
                  <Text style={s.btnText}>
                    {registerMutation.isPending ? 'Creating account…' : 'Create Account'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text style={s.footerLink}>Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD   = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.10)';
const BORDER_FOCUS = 'rgba(139,92,246,0.7)';

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },

  header:  { paddingTop: 16, paddingBottom: 36 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20 },

  brand:    { alignItems: 'center' },
  logo:     { width: 180, height: 48 },
  headline: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 24, letterSpacing: -0.5, textAlign: 'center' },
  sub:      { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6, textAlign: 'center' },

  dots:     { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot:      { width: 16, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive:{ width: 32, backgroundColor: AMBER_400 },

  form: { gap: 14 },

  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:        { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 50, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  pillActive:  { backgroundColor: VIOLET_600, borderColor: VIOLET_600 },
  pillText:    { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  inputRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingVertical: 15 },
  inputRowFocused: { borderColor: BORDER_FOCUS, backgroundColor: 'rgba(139,92,246,0.08)' },
  inputText:       { flex: 1, color: '#fff', fontSize: 15 },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DANGER_BG, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(225,29,72,0.3)', paddingHorizontal: 14, paddingVertical: 10 },
  errorText: { color: '#fca5a5', fontSize: 13, flex: 1 },

  btn:         { backgroundColor: VIOLET_600, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: VIOLET_500, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, marginTop: 4 },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 36 },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  footerLink: { color: AMBER_400, fontSize: 14, fontWeight: '700' },
});
