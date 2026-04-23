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
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { Input }  from '../../components/ui/Input';
import type { AuthUser } from '../../store/auth.store';
import type { LoginScreenProps } from '../../navigation/types';

type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

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
    <SafeAreaView className="flex-1 bg-primary-500" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header / brand ── */}
          <View className="items-center justify-center px-6 pt-14 pb-10">
            <View className="h-16 w-16 bg-white/20 rounded-3xl items-center justify-center mb-5">
              <Text className="text-4xl">🏥</Text>
            </View>
            <Text className="text-white text-4xl font-bold tracking-tight">ZimHealth</Text>
            <Text className="text-primary-200 text-sm mt-2 text-center">
              CPD Platform · Zimbabwe
            </Text>
          </View>

          {/* ── Form card ── */}
          <View className="bg-white rounded-t-[2.5rem] px-6 pt-8 pb-10 flex-1">
            <Text className="text-2xl font-bold text-slate-900 mb-1">
              Welcome back
            </Text>
            <Text className="text-slate-500 text-sm mb-8">
              Log in to continue your CPD journey
            </Text>

            <View className="gap-y-4">
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
                placeholder="Enter your password"
                secureTextEntry
              />
            </View>

            <Pressable className="self-end mt-3 mb-6" hitSlop={8}>
              <Text className="text-primary-600 text-sm font-medium">Forgot password?</Text>
            </Pressable>

            {loginMutation.isError && (
              <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-4">
                <Text className="text-red-600 text-sm text-center">
                  {loginMutation.error?.message ?? 'Login failed. Please try again.'}
                </Text>
              </View>
            )}

            <Button
              label="Log In"
              onPress={() => loginMutation.mutate()}
              loading={loginMutation.isPending}
              disabled={!canSubmit}
            />

            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="mx-4 text-slate-400 text-xs font-medium">OR</Text>
              <View className="flex-1 h-px bg-slate-200" />
            </View>

            {/* WhatsApp login — Sprint 4 */}
            <Button
              label="💬  Continue via WhatsApp"
              onPress={() => { /* Implemented in Sprint 4 */ }}
              variant="secondary"
            />

            <View className="flex-row justify-center mt-10">
              <Text className="text-slate-500 text-sm">Don't have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
                <Text className="text-primary-600 text-sm font-semibold">Register here</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
