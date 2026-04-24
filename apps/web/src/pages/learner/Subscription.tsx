import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';

type Tier = 'FREE' | 'STANDARD' | 'DIASPORA';
type Gateway = 'stripe' | 'paynow';
type PaidTier = Exclude<Tier, 'FREE'>;

const PRICING: Array<{
  tier: Exclude<Tier, 'FREE'>;
  title: string;
  price: string;
  features: string[];
}> = [
  {
    tier: 'STANDARD',
    title: 'Standard',
    price: '$5 / year',
    features: ['Full web course library', 'AI Tutor on WhatsApp', 'Certificates', 'WhatsApp CPD + web CPD'],
  },
  {
    tier: 'DIASPORA',
    title: 'Diaspora',
    price: '$15 / year',
    features: ['All Standard features', 'Priority support', 'Sponsor a learner (coming soon)'],
  },
];

export default function SubscriptionPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const expiresAt = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherSuccess, setVoucherSuccess] = useState('');
  const [voucherError, setVoucherError] = useState('');

  const initiateMutation = useMutation({
    mutationFn: async (input: { tier: Exclude<Tier, 'FREE'>; gateway: Gateway }) =>
      api.post<{ url: string }>(`/api/payments/initiate`, input),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const redeemMutation = useMutation({
    mutationFn: (code: string) =>
      api.post<{ ok: boolean; tier: string; sponsorName: string; message: string }>(
        '/api/payments/redeem-voucher',
        { code },
      ),
    onSuccess: (data) => {
      setVoucherSuccess(data.message);
      setVoucherCode('');
      setVoucherError('');
      // Optimistically update the auth store so the tier badge refreshes
      updateUser({ subscriptionTier: data.tier as PaidTier });
    },
    onError: (err) => {
      setVoucherError(
        err instanceof Error
          ? err.message
          : 'Could not redeem voucher. Please check the code and try again.',
      );
      setVoucherSuccess('');
    },
  });

  const isUpgraded = user?.subscriptionTier !== 'FREE';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#030c1a] via-[#0d1f3c] to-[#0a1628] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.10),transparent_45%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-black text-white">Subscription</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isUpgraded ? 'bg-primary-500/25 text-primary-300 ring-1 ring-primary-400/30' : 'bg-white/10 text-white/60 ring-1 ring-white/15'}`}>
              {isUpgraded ? '★ ' : ''}{user?.subscriptionTier ?? 'FREE'}
            </span>
            {expiresAt && (
              <span className="text-white/45 text-xs">Expires {expiresAt.toLocaleDateString('en-ZW')}</span>
            )}
          </div>
          <p className="text-white/50 text-sm mt-2">Unlock the full course library and earn CPD certificates.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PRICING.map((p) => {
          const isCurrent = user?.subscriptionTier === p.tier;
          return (
            <div key={p.tier} className={`rounded-2xl p-6 border shadow-sm ${isCurrent ? 'bg-gradient-to-br from-primary-600 to-primary-800 border-primary-500 text-white' : 'bg-white border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${isCurrent ? 'text-primary-200' : 'text-slate-500'}`}>{p.title}</div>
                  <div className={`text-3xl font-black ${isCurrent ? 'text-white' : 'text-slate-900'}`}>{p.price}</div>
                </div>
                {isCurrent && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white">Current plan</span>
                )}
              </div>

              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${isCurrent ? 'text-primary-100' : 'text-slate-600'}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${isCurrent ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => initiateMutation.mutate({ tier: p.tier, gateway: 'stripe' })}
                  disabled={initiateMutation.isPending}
                  className={`w-full text-sm font-bold py-3 rounded-xl transition-colors disabled:opacity-40 ${isCurrent ? 'bg-white text-primary-700 hover:bg-primary-50' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                >
                  {initiateMutation.isPending ? 'Redirecting…' : 'Pay with Card (Stripe)'}
                </button>
                <button
                  onClick={() => initiateMutation.mutate({ tier: p.tier, gateway: 'paynow' })}
                  disabled={initiateMutation.isPending}
                  className={`w-full text-sm font-semibold py-3 rounded-xl border transition-colors disabled:opacity-40 ${isCurrent ? 'border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Pay with EcoCash (Paynow)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Voucher redemption ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Redeem a Sponsor Voucher</h2>
          <p className="text-sm text-slate-500 mt-1">
            Have a code from an NGO, employer, or sponsor? Enter it below to activate your subscription.
          </p>
        </div>

        {voucherSuccess ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
            <p className="text-sm font-bold text-green-800">Voucher redeemed!</p>
            <p className="text-sm text-green-700 mt-0.5">{voucherSuccess}</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={voucherCode}
              onChange={(e) => {
                setVoucherCode(e.target.value.toUpperCase());
                setVoucherError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && voucherCode.trim()) {
                  redeemMutation.mutate(voucherCode.trim());
                }
              }}
              placeholder="ZHCPD-XXXX-XXXX-XXXX"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono tracking-wider focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 placeholder:font-sans placeholder:tracking-normal"
            />
            <button
              onClick={() => redeemMutation.mutate(voucherCode.trim())}
              disabled={redeemMutation.isPending || !voucherCode.trim()}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
            >
              {redeemMutation.isPending ? 'Checking…' : 'Redeem Code'}
            </button>
          </div>
        )}

        {voucherError && (
          <p className="text-sm text-red-600">{voucherError}</p>
        )}

        <p className="text-xs text-slate-400">
          Each voucher code can only be used once and will activate a 1-year subscription.
        </p>
      </div>

      <div className="text-xs text-slate-400 text-center pb-4">
        Tier updates automatically after payment via webhook confirmation.
      </div>
      </div>
    </div>
  );
}
