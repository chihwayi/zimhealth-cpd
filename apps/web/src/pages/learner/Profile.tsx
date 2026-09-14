import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, User, Camera, Building2, BadgeCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../components/ui/Toast';

type MeUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  councilId: string | null;
  council?: { id: string; name: string; acronym: string; requiredPoints: number; allowedTitles?: string[] } | null;
  professionalTitle: string | null;
  registrationNumber: string | null;
  cadre: string | null; // legacy
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

type CouncilOption = {
  id: string;
  name: string;
  acronym: string;
  requiredPoints: number;
  allowedTitles: string[];
};

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
  const [councilId, setCouncilId] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [specialtyArea, setSpecialtyArea] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: me, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get<MeUser>('/api/auth/me'),
  });

  const councilsQuery = useQuery<{ councils: CouncilOption[] }>({
    queryKey: ['councils'],
    queryFn: () => api.get('/api/councils'),
  });

  const councils = useMemo(() => councilsQuery.data?.councils ?? [], [councilsQuery.data?.councils]);
  const selectedCouncil = useMemo(
    () => councils.find((c) => c.id === councilId) ?? null,
    [councilId, councils],
  );
  const titles = selectedCouncil?.allowedTitles ?? [];

  useEffect(() => {
    if (!me) return;
    setFullName(me.fullName);
    setPhone(me.phone ?? '');
    setInstitution(me.institution ?? '');
    setProvince(me.province ?? '');
    setDistrict(me.district ?? '');
    setCouncilId(me.councilId ?? '');
    setProfessionalTitle(me.professionalTitle ?? '');
    setRegistrationNumber(me.registrationNumber ?? '');
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
        councilId: updated.councilId,
        council: updated.council ?? undefined,
        professionalTitle: updated.professionalTitle,
        registrationNumber: updated.registrationNumber,
        nczRegistrationNumber: updated.nczRegistrationNumber,
        cadre: updated.cadre, // legacy
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
      councilId: councilId || null,
      professionalTitle: professionalTitle || null,
      registrationNumber: registrationNumber.trim().toUpperCase() || null,
      specialtyArea: specialtyArea.trim() || null,
    });
  }

  const expires = me?.subscriptionExpiresAt ? new Date(me.subscriptionExpiresAt) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#150a26] via-[#2e1065] to-[#1a0f2e] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.18),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.08),transparent_45%)]" />
        <div className="relative max-w-2xl mx-auto px-6 py-8">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {me?.avatarUrl ? (
                <img src={me.avatarUrl} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/20" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary-500/25 ring-2 ring-primary-400/30 flex items-center justify-center">
                  <User size={28} className="text-primary-300" />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary-500 ring-2 ring-[#150a26] flex items-center justify-center hover:bg-primary-400 transition-colors disabled:opacity-50"
              >
                {avatarUploading ? (
                  <Loader2 size={12} className="text-white animate-spin" />
                ) : (
                  <Camera size={12} className="text-white" />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">{me?.fullName ?? 'Your Profile'}</h1>
              <p className="text-white/55 text-sm mt-0.5">
                {me?.council ? `${me.council.acronym} · ` : ''}{me?.professionalTitle ?? 'Health Professional'}
              </p>
              <p className="text-white/40 text-xs mt-1">
                Keep your details up to date for certificates and council reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

      {isLoading ? (
        <div className="h-48 rounded-xl bg-white border border-slate-200 animate-pulse" />
      ) : me ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {(!me.councilId || !me.professionalTitle || !me.registrationNumber) && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-primary-900">Complete your council identity</p>
              <p className="text-xs text-primary-800/80 mt-1 leading-relaxed">
                Add your council, professional title, and registration number so we can match your course library and CPD target to the right council rules.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-[1.75rem] border border-blue-200 bg-gradient-to-br from-white via-emerald-50/60 to-amber-50 shadow-sm">
            <div className="border-b border-emerald-100 bg-white/70 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-blue-300">
                  <BadgeCheck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Council identity</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This profile controls which courses you can see, your renewal target, and compliance reporting.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">Council</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={councilId}
                      onChange={(e) => {
                        setCouncilId(e.target.value);
                        setProfessionalTitle('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="">
                        {councilsQuery.isLoading ? 'Loading councils…' : 'Select your council'}
                      </option>
                      {councils.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.acronym} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">Professional title</label>
                  <select
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                    disabled={!selectedCouncil}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{selectedCouncil ? 'Select your title' : 'Choose council first'}</option>
                    {titles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:items-end">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-800">Registration number</label>
                  <input
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Your council registration number"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 uppercase"
                  />
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
                  <p className="text-xs text-slate-500">Annual target</p>
                  <p className="font-black text-slate-950">
                    {selectedCouncil ? `${selectedCouncil.requiredPoints} CPD pts` : 'Set by council'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                If you change your council identity, your eligible courses and compliance target will update immediately.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
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
    </div>
  );
}
