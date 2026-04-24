import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { Input }  from '../../components/ui/Input';
import type { AuthUser } from '../../store/auth.store';
import type { RegisterScreenProps } from '../../navigation/types';

type RegisterResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

const CADRE_OPTIONS = [
  { value: 'NURSE',           label: 'Nurse'                  },
  { value: 'MIDWIFE',         label: 'Midwife'                },
  { value: 'PHARMACIST',      label: 'Pharmacist'             },
  { value: 'CLINICAL_OFFICER', label: 'Clinical Officer'      },
  { value: 'LAB_TECH',        label: 'Laboratory Technician'  },
] as const;

type CadreValue = typeof CADRE_OPTIONS[number]['value'];

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [phone,     setPhone]     = useState('');

  // Step 2
  const [cadre,    setCadre]    = useState<CadreValue | ''>('');
  const [nczReg,   setNczReg]   = useState('');
  const [institution, setInstitution] = useState('');
  const [province, setProvince] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);

  const registerMutation = useMutation({
    mutationFn: () =>
      api.post<RegisterResponse>('/api/auth/register', {
        fullName:            fullName.trim(),
        email:               email.trim().toLowerCase(),
        password,
        phone:               phone.trim() || undefined,
        cadre:               cadre || undefined,
        nczRegistrationNumber: nczReg.trim() || undefined,
        institution:         institution.trim() || undefined,
        province:            province.trim() || undefined,
      }),
    onSuccess: async (data) => {
      await setAuth(data.user, data.accessToken, data.refreshToken);
    },
  });

  const step1Valid = fullName.trim().length >= 2 && email.includes('@') && password.length >= 8;

  // ── Step indicator ──────────────────────────────────────────────────────────
  function StepDot({ n }: { n: 1 | 2 }) {
    const active = step === n;
    return (
      <View
        className={`h-2.5 rounded-full ${active ? 'bg-primary-500 w-8' : 'bg-slate-200 w-2.5'}`}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View className="flex-row items-center px-4 py-3 border-b border-slate-100">
          <Pressable
            onPress={step === 1 ? () => navigation.goBack() : () => setStep(1)}
            hitSlop={12}
            className="p-1"
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="text-base font-bold text-slate-900">Create account</Text>
            <Text className="text-xs text-slate-400 mt-0.5">Step {step} of 2</Text>
          </View>
          <View className="flex-row gap-x-1.5 pr-1">
            <StepDot n={1} />
            <StepDot n={2} />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <Text className="text-xl font-bold text-slate-900 mb-1">Your details</Text>
              <Text className="text-slate-500 text-sm mb-8">
                Used for your ZimHealth account and certificates.
              </Text>

              <View className="gap-y-4">
                <Input
                  label="Full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Chiedza Moyo"
                  autoCapitalize="words"
                />
                <Input
                  label="Email address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="clinician@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 8 characters"
                  secureTextEntry
                  hint="At least 8 characters"
                />
                <Input
                  label="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+263 77 123 4567"
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mt-8">
                <Button
                  label="Next: Professional Details"
                  onPress={() => setStep(2)}
                  disabled={!step1Valid}
                />
              </View>
            </>
          ) : (
            <>
              <Text className="text-xl font-bold text-slate-900 mb-1">Professional details</Text>
              <Text className="text-slate-500 text-sm mb-6">
                Required for council reporting and personalised recommendations.
              </Text>

              {/* Cadre picker */}
              <Text className="text-sm font-semibold text-slate-800 mb-3">Cadre</Text>
              <View className="flex-row flex-wrap gap-2 mb-5">
                {CADRE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setCadre(opt.value)}
                    className={`rounded-full px-4 py-2.5 border
                      ${cadre === opt.value
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-white border-slate-200'}`}
                  >
                    <Text
                      className={`text-sm font-semibold
                        ${cadre === opt.value ? 'text-white' : 'text-slate-700'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className="gap-y-4">
                <Input
                  label="Council registration number (optional)"
                  value={nczReg}
                  onChangeText={setNczReg}
                  placeholder="e.g. RN-12345"
                  autoCapitalize="characters"
                />
                <Input
                  label="Institution (optional)"
                  value={institution}
                  onChangeText={setInstitution}
                  placeholder="e.g. Parirenyatwa Hospital"
                  autoCapitalize="words"
                />
                <Input
                  label="Province (optional)"
                  value={province}
                  onChangeText={setProvince}
                  placeholder="e.g. Harare"
                  autoCapitalize="words"
                />
              </View>

              {registerMutation.isError && (
                <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mt-4">
                  <Text className="text-red-600 text-sm text-center">
                    {registerMutation.error?.message ?? 'Registration failed. Please try again.'}
                  </Text>
                </View>
              )}

              <View className="mt-8">
                <Button
                  label="Create Account"
                  onPress={() => registerMutation.mutate()}
                  loading={registerMutation.isPending}
                />
              </View>
            </>
          )}

          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-500 text-sm">Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text className="text-primary-600 text-sm font-semibold">Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
