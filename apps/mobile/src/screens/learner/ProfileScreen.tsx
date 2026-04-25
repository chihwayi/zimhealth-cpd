import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useModal } from '../../context/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import type { AuthUser } from '../../store/auth.store';
import type { ProfileScreenProps } from '../../navigation/types';
import {
  BG, SURFACE, SURFACE2, BORDER, BORDER_FOCUS, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, DANGER, DANGER_BG,
} from '../../theme';

const CADRE_LABEL: Record<string, string> = {
  NURSE:            'Registered General Nurse',
  MIDWIFE:          'Registered Midwife',
  PHARMACIST:       'Pharmacist',
  CLINICAL_OFFICER: 'Clinical Officer',
  LAB_TECH:         'Laboratory Technician',
};

const TIER_LABEL: Record<string, string> = {
  FREE:        'Free',
  STANDARD:    'Standard',
  INSTITUTION: 'Institution',
  DIASPORA:    'Diaspora',
};

// ── Dark input ────────────────────────────────────────────────────────────────

function DarkInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences';
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.inputLabel}>{label.toUpperCase()}</Text>
      <TextInput
        style={[s.input, focused && s.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT3}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hint && <Text style={s.inputHint}>{hint}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { showConfirm } = useModal();
  const queryClient  = useQueryClient();
  const clearAuth    = useAuthStore((s) => s.clearAuth);
  const updateUser   = useAuthStore((s) => s.updateUser);

  const [editing,       setEditing]       = useState(false);
  const [fullName,      setFullName]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [institution,   setInstitution]   = useState('');
  const [province,      setProvince]      = useState('');
  const [specialtyArea, setSpecialtyArea] = useState('');
  const [nczReg,        setNczReg]        = useState('');

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () =>
      api.get<AuthUser & { email: string; createdAt: string; subscriptionExpiresAt: string | null }>(
        '/api/auth/me',
      ),
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
    mutationFn: (body: Record<string, unknown>) => api.patch<AuthUser>('/api/auth/me', body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['auth-me'], updated);
      updateUser(updated);
      setEditing(false);
    },
  });

  function handleSave() {
    patchMutation.mutate({
      fullName:               fullName.trim(),
      phone:                  phone.trim() || null,
      institution:            institution.trim() || null,
      province:               province.trim() || null,
      specialtyArea:          specialtyArea.trim() || null,
      nczRegistrationNumber:  nczReg.trim() || null,
    });
  }

  function handleLogout() {
    showConfirm({
      type: 'danger',
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      onConfirm: () => void clearAuth(),
    });
  }

  if (isLoading || !me) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: TEXT3 }}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{me.fullName}</Text>
              {me.cadre && (
                <View style={s.cadrePill}>
                  <Text style={s.cadreText}>{CADRE_LABEL[me.cadre] ?? me.cadre}</Text>
                </View>
              )}
              <Text style={s.memberSince}>
                Member since {new Date((me as any).createdAt).toLocaleDateString('en-ZW', {
                  month: 'long', year: 'numeric',
                })}
              </Text>
            </View>
            <View style={s.avatar}>
              <Ionicons name="person" size={32} color={ACCENT_L} />
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
            {/* ── Subscription card ── */}
            <Pressable
              style={s.subCard}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View>
                <Text style={s.subLabel}>Subscription</Text>
                <Text style={s.subTier}>
                  {me.subscriptionTier ? TIER_LABEL[me.subscriptionTier] ?? me.subscriptionTier : 'Free'}
                </Text>
                {(me as any).subscriptionExpiresAt && (
                  <Text style={s.subExpiry}>
                    Expires {new Date((me as any).subscriptionExpiresAt).toLocaleDateString('en-ZW')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={ACCENT_L} />
            </Pressable>

            {/* ── Profile details ── */}
            <View style={s.card}>
              <View style={[s.cardRow, { marginBottom: 16 }]}>
                <Text style={s.cardTitle}>Profile details</Text>
                <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
                  <Text style={s.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
                </Pressable>
              </View>

              {editing ? (
                <View style={{ gap: 14 }}>
                  <DarkInput label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
                  <DarkInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+263 77 123 4567" />
                  <DarkInput label="Council registration number" value={nczReg} onChangeText={setNczReg} autoCapitalize="characters" placeholder="e.g. RN-12345" />
                  <DarkInput label="Specialty area" value={specialtyArea} onChangeText={setSpecialtyArea} placeholder="e.g. Paediatrics, ICU" hint="Used to personalise your course recommendations" />
                  <DarkInput label="Institution" value={institution} onChangeText={setInstitution} autoCapitalize="words" />
                  <DarkInput label="Province" value={province} onChangeText={setProvince} autoCapitalize="words" />

                  {patchMutation.isError && (
                    <View style={s.errorBox}>
                      <Text style={s.errorText}>{patchMutation.error?.message ?? 'Could not save changes.'}</Text>
                    </View>
                  )}

                  <Pressable
                    style={[s.btnPrimary, patchMutation.isPending && s.btnDisabled]}
                    onPress={handleSave}
                    disabled={patchMutation.isPending}
                  >
                    <Text style={s.btnText}>{patchMutation.isPending ? 'Saving…' : 'Save changes'}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 2 }}>
                  {[
                    { label: 'Email',         value: (me as any).email },
                    { label: 'Phone',         value: (me as any).phone ?? '—' },
                    { label: 'Registration',  value: me.nczRegistrationNumber ?? '—' },
                    { label: 'Specialty',     value: me.specialtyArea ?? '—' },
                    { label: 'Institution',   value: (me as any).institution ?? '—' },
                    { label: 'Province',      value: (me as any).province ?? '—' },
                  ].map(({ label, value }) => (
                    <View key={label} style={s.detailRow}>
                      <Text style={s.detailLabel}>{label}</Text>
                      <Text style={s.detailValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Logout ── */}
            <Pressable style={s.btnDanger} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color={DANGER} />
              <Text style={s.btnDangerText}>Log out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  name:        { color: TEXT, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  memberSince: { color: TEXT3, fontSize: 11, marginTop: 6 },
  cadrePill:   {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
  },
  cadreText: { color: ACCENT_L, fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 64, height: 64, borderRadius: 22,
    backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center',
  },

  // Sub card
  subCard: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  subLabel:  { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  subTier:   { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  subExpiry: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

  // Card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  editBtn:   { color: ACCENT_L, fontSize: 13, fontWeight: '600' },

  // Detail rows
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER },
  detailLabel:  { color: TEXT3, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, width: 100 },
  detailValue:  { color: TEXT, fontSize: 13, flex: 1, textAlign: 'right' },

  // Dark input
  inputLabel: { color: TEXT3, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: SURFACE2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 14,
  },
  inputFocused: { borderColor: BORDER_FOCUS, backgroundColor: 'rgba(96,165,250,0.06)' },
  inputHint:   { color: TEXT3, fontSize: 11 },

  errorBox: {
    backgroundColor: DANGER_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${DANGER}44`,
    padding: 12,
  },
  errorText: { color: DANGER, fontSize: 13, textAlign: 'center' },

  // Buttons
  btnPrimary: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  btnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },

  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DANGER_BG,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: `${DANGER}33`,
  },
  btnDangerText: { color: DANGER, fontSize: 15, fontWeight: '700' },
});
