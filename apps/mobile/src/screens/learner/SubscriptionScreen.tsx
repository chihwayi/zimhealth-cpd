import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

const TIERS = [
  {
    tier: 'STANDARD',
    title: 'Standard',
    price: '$5 / year',
    features: ['Full course library', 'AI Tutor on WhatsApp', 'Certificates', 'CPD tracking'],
  },
  {
    tier: 'DIASPORA',
    title: 'Diaspora',
    price: '$15 / year',
    features: ['All Standard features', 'Priority support'],
  },
] as const;

export default function SubscriptionScreen() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const qc = useQueryClient();

  const [voucherCode, setVoucherCode] = useState('');
  const [redeemed, setRedeemed] = useState<{ message: string; tier: string } | null>(null);

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
      Alert.alert('Could not redeem', err.message ?? 'Check the code and try again.');
    },
  });

  const expiresAt = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 20, gap: 20 }}>
      <View className="bg-white rounded-2xl p-5 border border-slate-200">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Current plan
        </Text>
        <Text className="text-2xl font-bold text-slate-900 mt-1">
          {user?.subscriptionTier ?? 'FREE'}
        </Text>
        {expiresAt ? (
          <Text className="text-sm text-slate-500 mt-1">
            Expires {expiresAt.toLocaleDateString('en-ZW')}
          </Text>
        ) : null}
      </View>

      {TIERS.map((tier) => (
        <View key={tier.tier} className="bg-white rounded-2xl p-5 border border-slate-200">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-lg font-bold text-slate-900">{tier.title}</Text>
              <Text className="text-2xl font-bold text-primary-600 mt-1">{tier.price}</Text>
            </View>
            {user?.subscriptionTier === tier.tier ? (
              <View className="bg-green-100 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-green-800">Current</Text>
              </View>
            ) : null}
          </View>
          <View className="mt-3 gap-y-1.5">
            {tier.features.map((feature) => (
              <View key={feature} className="flex-row items-center gap-x-2">
                <Ionicons name="checkmark-circle" size={16} color="#2563eb" />
                <Text className="text-sm text-slate-600">{feature}</Text>
              </View>
            ))}
          </View>
          <Text className="text-xs text-slate-400 mt-4">
            To subscribe, visit the ZimHealth web portal and use Stripe or EcoCash (Paynow).
          </Text>
        </View>
      ))}

      <View className="bg-white rounded-2xl p-5 border border-slate-200 gap-y-4">
        <View>
          <Text className="text-base font-bold text-slate-900">Redeem a Sponsor Voucher</Text>
          <Text className="text-sm text-slate-500 mt-1">
            Have a code from an NGO, employer, or sponsor? Enter it below.
          </Text>
        </View>

        {redeemed ? (
          <View className="rounded-xl border border-green-200 bg-green-50 p-4">
            <Text className="text-sm font-bold text-green-800">Voucher redeemed!</Text>
            <Text className="text-sm text-green-700 mt-1">{redeemed.message}</Text>
          </View>
        ) : (
          <View className="gap-y-3">
            <TextInput
              value={voucherCode}
              onChangeText={(text) => setVoucherCode(text.toUpperCase())}
              placeholder="ZHCPD-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-slate-900 bg-white"
              placeholderTextColor="#94a3b8"
            />
            <Pressable
              onPress={() => {
                const trimmed = voucherCode.trim();
                if (!trimmed) return;
                redeemMutation.mutate(trimmed);
              }}
              disabled={redeemMutation.isPending || !voucherCode.trim()}
              className="bg-slate-800 rounded-xl py-3 items-center disabled:opacity-40"
            >
              <Text className="text-white font-semibold text-sm">
                {redeemMutation.isPending ? 'Checking...' : 'Redeem Code'}
              </Text>
            </Pressable>
          </View>
        )}

        <Text className="text-xs text-slate-400">
          Each voucher code can only be used once and activates a 1-year subscription.
        </Text>
      </View>
    </ScrollView>
  );
}
