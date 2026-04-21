import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';

type Tier = 'FREE' | 'STANDARD' | 'DIASPORA';
type Gateway = 'stripe' | 'paynow';

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
  const expiresAt = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;

  const initiateMutation = useMutation({
    mutationFn: async (input: { tier: Exclude<Tier, 'FREE'>; gateway: Gateway }) =>
      api.post<{ url: string }>(`/api/payments/initiate`, input),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-600 mt-1">
          Current tier: <span className="font-medium text-slate-900">{user?.subscriptionTier ?? 'FREE'}</span>
          {expiresAt ? (
            <span className="text-slate-500"> • Expires {expiresAt.toLocaleDateString('en-ZW')}</span>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PRICING.map((p) => (
          <div key={p.tier} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">{p.title}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{p.price}</div>
              </div>
              {user?.subscriptionTier === p.tier ? (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">Current</span>
              ) : null}
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {p.features.map((f) => (
                <li key={f}>- {f}</li>
              ))}
            </ul>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => initiateMutation.mutate({ tier: p.tier, gateway: 'stripe' })}
                disabled={initiateMutation.isPending}
                className="w-full bg-primary-500 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary-600 disabled:opacity-40"
              >
                {initiateMutation.isPending ? 'Redirecting…' : 'Pay with Card (Stripe)'}
              </button>
              <button
                onClick={() => initiateMutation.mutate({ tier: p.tier, gateway: 'paynow' })}
                disabled={initiateMutation.isPending}
                className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                Pay with EcoCash (Paynow)
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500">
        After payment, your tier will update automatically when the payment provider sends a webhook to the backend.
      </div>
    </div>
  );
}

