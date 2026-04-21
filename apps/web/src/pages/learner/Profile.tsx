import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, User, Camera } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../components/ui/Toast';
import clsx from 'clsx';

type MeUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  cadre: string | null;
  nczRegistrationNumber: string | null;
  institution: string | null;
  province: string | null;
  district: string | null;
  phone: string | null;
  avatarUrl: string | null;
  specialtyArea: string | null;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  createdAt: string;
};

const CADRE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Not specified' },
  { value: 'NURSE', label: 'Nurse' },
  { value: 'MIDWIFE', label: 'Midwife' },
  { value: 'PHARMACIST', label: 'Pharmacist' },
  { value: 'CLINICAL_OFFICER', label: 'Clinical officer' },
  { value: 'LAB_TECH', label: 'Laboratory technician' },
];

function formatTier(tier: string) {
  return tier
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const token = useAuthStore((s) => s.accessToken);
  const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') as string;
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [cadre, setCadre] = useState('');
  const [nczRegistrationNumber, setNczRegistrationNumber] = useState('');
  const [specialtyArea, setSpecialtyArea] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<MeUser>('/api/auth/me'),
  });

  useEffect(() => {
    if (!me) return;
    setFullName(me.fullName);
    setPhone(me.phone ?? '');
    setInstitution(me.institution ?? '');
    setProvince(me.province ?? '');
    setDistrict(me.district ?? '');
    setCadre(me.cadre ?? '');
    setNczRegistrationNumber(me.nczRegistrationNumber ?? '');
    setSpecialtyArea(me.specialtyArea ?? '');
  }, [me]);

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<MeUser>('/api/auth/me', body),
    onSuccess: (updated) => {
      toast.success('Profile saved');
      queryClient.setQueryData(['auth-me'], updated);
      updateUser({
        fullName: updated.fullName,
        avatarUrl: updated.avatarUrl ?? undefined,
        nczRegistrationNumber: updated.nczRegistrationNumber,
        cadre: updated.cadre,
        phone: updated.phone ?? undefined,
        institution: updated.institution ?? undefined,
        province: updated.province ?? undefined,
        district: updated.district ?? undefined,
        specialtyArea: updated.specialtyArea ?? undefined,
        subscriptionTier: updated.subscriptionTier,
        subscriptionExpiresAt: updated.subscriptionExpiresAt ?? undefined,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleAvatarChange() {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file || !token) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'profiles');
      const res = await fetch(`${baseUrl}/api/media/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === 'string' ? body.error : `Upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      patchMutation.mutate({ avatarUrl: url });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    patchMutation.mutate({
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      institution: institution.trim() || null,
      province: province.trim() || null,
      district: district.trim() || null,
      cadre: cadre || null,
      nczRegistrationNumber: nczRegistrationNumber.trim() || null,
      specialtyArea: specialtyArea.trim() || null,
    });
  }

  const expires = me?.subscriptionExpiresAt ? new Date(me.subscriptionExpiresAt) : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Keep your professional details up to date for certificates and NCZ reporting.
        </p>
      </div>

      {isLoading ? (
        <div className="h-48 rounded-xl bg-white border border-slate-200 animate-pulse" />
      ) : me ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="relative shrink-0">
                <div
                  className={clsx(
                    'w-24 h-24 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center',
                  )}
                >
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="text-slate-400" size={40} />
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={() => void handleAvatarChange()}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading || patchMutation.isPending}
                  className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-md hover:bg-primary-600 disabled:opacity-50"
                  aria-label="Upload profile photo"
                >
                  {avatarUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-slate-900">Photo</p>
                <p className="text-xs text-slate-500">
                  JPG, PNG or Webp. Used on certificates and across the platform when configured.
                </p>
                <p className="text-xs text-slate-400">
                  Upload requires media storage (S3) to be configured on the server.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email</label>
              <input
                type="email"
                value={me.email}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+263…"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Cadre</label>
                <select
                  value={cadre}
                  onChange={(e) => setCadre(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  {CADRE_OPTIONS.map((o) => (
                    <option key={o.value || 'unset'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Specialty area</label>
              <input
                value={specialtyArea}
                onChange={(e) => setSpecialtyArea(e.target.value)}
                placeholder="e.g. Paediatrics, Maternal Health, ICU…"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Used to personalise your course recommendations. Leave blank for general suggestions.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">NCZ registration number</label>
              <input
                value={nczRegistrationNumber}
                onChange={(e) => setNczRegistrationNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Institution</label>
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Province</label>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">District</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-900">Subscription</p>
            <p className="text-sm text-slate-600 mt-1">
              Plan: <span className="font-medium text-slate-900">{formatTier(me.subscriptionTier)}</span>
              {expires ? (
                <span className="text-slate-500"> · Renews or expires {expires.toLocaleDateString('en-ZW')}</span>
              ) : (
                <span className="text-slate-500"> · No expiry date on file</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Upgrade or change billing on the{' '}
              <Link to="/subscription" className="text-primary-600 font-medium hover:underline">
                Subscription
              </Link>{' '}
              page.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={patchMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {patchMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save changes
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
