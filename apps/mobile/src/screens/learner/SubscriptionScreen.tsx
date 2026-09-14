import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useModal } from '../../context/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, SURFACE2, BORDER, BORDER_FOCUS, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, SUCCESS, SUCCESS_BG, DANGER_BG, DANGER,
} from '../../theme';

const TIERS = [
  {
    tier: 'STANDARD',
    title: 'Standard',
    price: '$5',
    period: '/ year',
    features: ['Full course library', 'AI Tutor on WhatsApp', 'Certificates', 'CPD tracking'],
    color: ACCENT,
    bgColor: ACCENT_BG,
  },
  {
    tier: 'DIASPORA',
    title: 'Diaspora',
    price: '$15',
    period: '/ year',
    features: ['All Standard features', 'Priority support'],
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.12)',
  },
] as const;

export default function SubscriptionScreen() {
  const { showAlert } = useModal();
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc         = useQueryClient();

  const [voucherCode, setVoucherCode] = useState('');
  const [focused,     setFocused]     = useState(false);
  const [redeemed,    setRedeemed]    = useState<{ message: string; tier: string } | null>(null);

  const redeemMutation = useMutation({
    mutationFn: (code: string) =>
      api.post<{ ok: boolean; tier: string; sponsorName: string; message: string }>(
        '/api/payments/redeem-voucher',
        { code },
      ),
    onSuccess: (data) => {
      setRedeemed({ message: data.message, tier: data.tier });
      setVoucherCode('');
      updateUser({ subscriptionTier: data.tier as 'STANDARD' | 'DIASPORA' });
      qc.invalidateQueries({ queryKey: ['points-summary'] });
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
    onError: (err) => {
      showAlert({
        type: 'danger',
        title: 'Could not redeem',
        message: err.message ?? 'Check the code and try again.',
      });
    },
  });

  const expiresAt = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 14 }}
      >
        {/* ── Current plan ── */}
        <View style={s.currentCard}>
          <Text style={s.currentLabel}>Current plan</Text>
          <Text style={s.currentTier}>{user?.subscriptionTier ?? 'FREE'}</Text>
          {expiresAt && (
            <Text style={s.currentExpiry}>
              Expires {expiresAt.toLocaleDateString('en-ZW')}
            </Text>
          )}
        </View>

        {/* ── Tier cards ── */}
        {TIERS.map((tier) => {
          const isCurrent = user?.subscriptionTier === tier.tier;
          return (
            <View
              key={tier.tier}
              style={[s.tierCard, isCurrent && { borderColor: tier.color }]}
            >
              <View style={s.tierRow}>
                <View>
                  <Text style={s.tierTitle}>{tier.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 }}>
                    <Text style={[s.tierPrice, { color: tier.color }]}>{tier.price}</Text>
                    <Text style={s.tierPeriod}>{tier.period}</Text>
                  </View>
                </View>
                {isCurrent && (
                  <View style={[s.currentBadge, { backgroundColor: tier.bgColor }]}>
                    <Ionicons name="checkmark-circle" size={13} color={tier.color} />
                    <Text style={[s.currentBadgeText, { color: tier.color }]}>Current</Text>
                  </View>
                )}
              </View>

              <View style={{ marginTop: 14, gap: 8 }}>
                {tier.features.map((feature) => (
                  <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={16} color={tier.color} />
                    <Text style={s.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.tierNote}>
                To subscribe, visit the ZimHealth web portal and pay via Stripe or EcoCash (Paynow).
              </Text>
            </View>
          );
        })}

        {/* ── Voucher redemption ── */}
        <View style={s.card}>
          <Text style={s.voucherTitle}>Redeem a Sponsor Voucher</Text>
          <Text style={s.voucherSub}>
            Have a code from an NGO, employer, or sponsor? Enter it below.
          </Text>

          {redeemed ? (
            <View style={[s.successBox, { marginTop: 12 }]}>
              <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />
              <View style={{ flex: 1 }}>
                <Text style={s.successTitle}>Voucher redeemed!</Text>
                <Text style={s.successBody}>{redeemed.message}</Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 10 }}>
              <TextInput
                value={voucherCode}
                onChangeText={(text) => setVoucherCode(text.toUpperCase())}
                placeholder="ZHCPD-XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect={false}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={[s.voucherInput, focused && s.voucherInputFocused]}
                placeholderTextColor={TEXT3}
              />
              <Pressable
                style={[s.redeemBtn, (!voucherCode.trim() || redeemMutation.isPending) && s.redeemBtnDisabled]}
                onPress={() => {
                  const trimmed = voucherCode.trim();
                  if (!trimmed) return;
                  redeemMutation.mutate(trimmed);
                }}
                disabled={redeemMutation.isPending || !voucherCode.trim()}
              >
                <Text style={s.redeemBtnText}>
                  {redeemMutation.isPending ? 'Checking...' : 'Redeem Code'}
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={s.voucherNote}>
            Each voucher code can only be used once and activates a 1-year subscription.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  currentCard: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    padding: 20,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  currentLabel:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  currentTier:   { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  currentExpiry: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },

  tierCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  tierRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tierTitle:  { color: TEXT, fontSize: 18, fontWeight: '800' },
  tierPrice:  { fontSize: 28, fontWeight: '900' },
  tierPeriod: { color: TEXT3, fontSize: 13 },

  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  currentBadgeText: { fontSize: 11, fontWeight: '700' },
  featureText: { color: TEXT2, fontSize: 13 },
  tierNote:    { color: TEXT3, fontSize: 11, marginTop: 14, lineHeight: 16 },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },
  voucherTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  voucherSub:   { color: TEXT2, fontSize: 13, marginTop: 4 },
  voucherNote:  { color: TEXT3, fontSize: 11, marginTop: 12 },

  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: SUCCESS_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${SUCCESS}44`,
    padding: 14,
  },
  successTitle: { color: SUCCESS, fontSize: 14, fontWeight: '700' },
  successBody:  { color: TEXT2, fontSize: 13, marginTop: 2 },

  voucherInput: {
    backgroundColor: SURFACE2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  voucherInputFocused: { borderColor: BORDER_FOCUS, backgroundColor: 'rgba(139,92,246,0.08)' },

  redeemBtn: {
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
  redeemBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  redeemBtnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
});
