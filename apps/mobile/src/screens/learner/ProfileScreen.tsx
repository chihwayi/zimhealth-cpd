import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { AuthUser } from '../../store/auth.store';
import type { ProfileScreenProps } from '../../navigation/types';

const CADRE_LABEL: Record<string, string> = {
  NURSE:            'Registered General Nurse',
  MIDWIFE:          'Registered Midwife',
  PHARMACIST:       'Pharmacist',
  CLINICAL_OFFICER: 'Clinical Officer',
  LAB_TECH:         'Laboratory Technician',
};

const TIER_LABEL: Record<string, string> = {
  FREE:    'Free',
  STANDARD: 'Standard',
  INSTITUTION: 'Institution',
  DIASPORA: 'Diaspora',
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const queryClient  = useQueryClient();
  const clearAuth    = useAuthStore((s) => s.clearAuth);
  const updateUser   = useAuthStore((s) => s.updateUser);

  const [editing, setEditing] = useState(false);
  const [fullName,     setFullName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [institution,  setInstitution]  = useState('');
  const [province,     setProvince]     = useState('');
  const [specialtyArea, setSpecialtyArea] = useState('');
  const [nczReg,       setNczReg]       = useState('');

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<AuthUser & { email: string; createdAt: string; subscriptionExpiresAt: string | null }>('/api/auth/me'),
  });

  useEffect(() => {
    if (!me) return;
    setFullName(me.fullName);
    setPhone((me as any).phone ?? '');
    setInstitution((me as any).institution ?? '');
    setProvince((me as any).province ?? '');
    setSpecialtyArea(me.specialtyArea ?? '');
    setNczReg(me.nczRegistrationNumber ?? '');
  }, [me]);

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<AuthUser>('/api/auth/me', body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['auth-me'], updated);
      updateUser(updated);
      setEditing(false);
    },
  });

  function handleSave() {
    patchMutation.mutate({
      fullName:            fullName.trim(),
      phone:               phone.trim() || null,
      institution:         institution.trim() || null,
      province:            province.trim() || null,
      specialtyArea:       specialtyArea.trim() || null,
      nczRegistrationNumber: nczReg.trim() || null,
    });
  }

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void clearAuth() },
    ]);
  }

  if (isLoading || !me) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
        <Text className="text-slate-400">Loading profile…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          {/* ── Header ── */}
          <View className="bg-white px-5 pt-5 pb-6 border-b border-slate-100">
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-2xl font-bold text-slate-900">{me.fullName}</Text>
                {me.cadre && (
                  <Badge label={CADRE_LABEL[me.cadre] ?? me.cadre} variant="teal" />
                )}
                <Text className="text-xs text-slate-400 mt-2">
                  Member since {new Date((me as any).createdAt).toLocaleDateString('en-ZW', { month: 'long', year: 'numeric' })}
                </Text>
              </View>

              <View className="h-16 w-16 bg-primary-100 rounded-3xl items-center justify-center">
                <Ionicons name="person" size={32} color="#2563eb" />
              </View>
            </View>
          </View>

          <View className="px-4 pt-4 gap-y-4">
            {/* ── Subscription card ── */}
            <Card variant="teal" className="flex-row items-center justify-between px-5 py-4">
              <View>
                <Text className="text-white/70 text-xs font-medium">Subscription</Text>
                <Text className="text-white text-lg font-bold mt-0.5">
                  {me.subscriptionTier
                    ? TIER_LABEL[me.subscriptionTier] ?? me.subscriptionTier
                    : 'Free'}
                </Text>
                {(me as any).subscriptionExpiresAt && (
                  <Text className="text-primary-200 text-xs mt-0.5">
                    Expires {new Date((me as any).subscriptionExpiresAt).toLocaleDateString('en-ZW')}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => navigation.navigate('Subscription')}
                className="items-center gap-y-1"
                hitSlop={8}
              >
                <Ionicons name="shield-checkmark" size={32} color="rgba(255,255,255,0.5)" />
                <Text className="text-white/80 text-xs font-semibold">Manage</Text>
              </Pressable>
            </Card>

            {/* ── Profile details ── */}
            <Card>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-bold text-slate-900">Profile details</Text>
                <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
                  <Text className="text-primary-600 text-sm font-semibold">
                    {editing ? 'Cancel' : 'Edit'}
                  </Text>
                </Pressable>
              </View>

              {editing ? (
                <View className="gap-y-4">
                  <Input
                    label="Full name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                  <Input
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+263 77 123 4567"
                  />
                  <Input
                    label="Council registration number"
                    value={nczReg}
                    onChangeText={setNczReg}
                    autoCapitalize="characters"
                    placeholder="e.g. RN-12345"
                  />
                  <Input
                    label="Specialty area"
                    value={specialtyArea}
                    onChangeText={setSpecialtyArea}
                    placeholder="e.g. Paediatrics, ICU, Maternal Health"
                    hint="Used to personalise your course recommendations"
                  />
                  <Input
                    label="Institution"
                    value={institution}
                    onChangeText={setInstitution}
                    autoCapitalize="words"
                  />
                  <Input
                    label="Province"
                    value={province}
                    onChangeText={setProvince}
                    autoCapitalize="words"
                  />

                  {patchMutation.isError && (
                    <Text className="text-red-500 text-xs text-center">
                      {patchMutation.error?.message ?? 'Could not save changes.'}
                    </Text>
                  )}

                  <Button
                    label="Save changes"
                    onPress={handleSave}
                    loading={patchMutation.isPending}
                  />
                </View>
              ) : (
                <View className="gap-y-3">
                  {[
                    { label: 'Email',         value: (me as any).email },
                    { label: 'Phone',         value: (me as any).phone ?? '—' },
                    { label: 'Registration number', value: me.nczRegistrationNumber ?? '—' },
                    { label: 'Specialty',     value: me.specialtyArea ?? '—' },
                    { label: 'Institution',   value: (me as any).institution ?? '—' },
                    { label: 'Province',      value: (me as any).province ?? '—' },
                  ].map(({ label, value }) => (
                    <View key={label} className="flex-row justify-between py-1.5 border-b border-slate-50">
                      <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-28">
                        {label}
                      </Text>
                      <Text className="text-sm text-slate-900 flex-1 text-right">{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* ── Logout ── */}
            <Button
              label="Log out"
              onPress={handleLogout}
              variant="danger"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
