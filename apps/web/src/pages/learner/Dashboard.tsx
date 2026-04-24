import { Award, BookOpen, Calendar, CheckCircle2, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useCPDPoints } from '../../hooks/useCPDPoints';
import { StatCard } from '../../components/ui/StatCard';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { api } from '../../lib/api';
import { CourseCard } from '../../components/course/CourseCard';

type InProgressEnrollment = {
  id: string;
  progressPercent: number;
  course: {
    id: string;
    title: string;
    category: string;
    thumbnailUrl?: string | null;
    estimatedMinutes: number;
    cpdPoints: number;
  };
};

type RecentActivity = {
  id: string;
  activityType: string;
  pointsEarned: number;
  completedAt: string;
  course?: { title: string } | null;
};

type RecommendedCourse = {
  id: string;
  title: string;
  category: string;
  difficulty?: string;
  thumbnailUrl?: string | null;
  estimatedMinutes: number;
  cpdPoints: number;
  averageRating?: number | null;
  reviewCount?: number | null;
  creatorName?: string | null;
  modules?: Array<{ isOfflineReady: boolean }>;
  aiReason?: string;
  aiReasonCategories?: string[];
};

type RecommendationsResponse = {
  courses: RecommendedCourse[];
  isProfileBased?: boolean;
  message?: string;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const CATEGORY_COLOURS: Record<string, string> = {
  CLINICAL: 'bg-blue-100',
  MANAGEMENT: 'bg-violet-100',
  ETHICS: 'bg-orange-100',
  RESEARCH: 'bg-teal-100',
};

function getRenewalDateFromCouncil(cpd: { renewalMonth?: number; renewalDay?: number } | undefined, year: number): Date {
  const month = typeof cpd?.renewalMonth === 'number' ? cpd.renewalMonth : 12;
  const day = typeof cpd?.renewalDay === 'number' ? cpd.renewalDay : 31;
  const safeMonth = Math.min(Math.max(month, 1), 12);
  const safeDay = Math.min(Math.max(day, 1), 31);
  // JS Date month index is 0-based.
  return new Date(year, safeMonth - 1, safeDay);
}

export default function LearnerDashboard() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: cpd, isLoading: cpdLoading } = useCPDPoints();

  const { data: inProgress, isLoading: inProgressLoading } = useQuery<InProgressEnrollment[]>({
    queryKey: ['enrollments', 'in-progress'],
    queryFn: () => api.get('/api/enrollments?status=IN_PROGRESS&limit=3'),
  });

  const { data: recentActivity } = useQuery<RecentActivity[]>({
    queryKey: ['cpd-records', 'recent'],
    queryFn: () => api.get('/api/points/records?limit=5'),
  });

  const {
    data: recommendations,
    isLoading: recsLoading,
    isError: recsError,
  } = useQuery<RecommendationsResponse>({
    queryKey: ['recommendations'],
    queryFn: () => api.get('/api/recommendations'),
    staleTime: 1000 * 60 * 30, // treat as fresh for 30 min to avoid hammering the AI
  });

  const refreshRecsMutation = useMutation({
    mutationFn: () => api.post('/api/recommendations/refresh', {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });

  const currentYear = new Date().getFullYear();
  const renewalDeadline = getRenewalDateFromCouncil(cpd, currentYear);
  const daysLeft = Math.ceil((renewalDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysLeft <= 60;
  const isCpdComplete = (cpd?.percentComplete ?? 0) >= 100;
  const profileMissing = !user?.councilId || !user?.professionalTitle || !user?.registrationNumber;

  const hasCourses = (recommendations?.courses?.length ?? 0) > 0;
  const isProfileBased = recommendations?.isProfileBased;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero banner */}
      <div className="relative bg-gradient-to-br from-[#030c1a] via-[#0d1f3c] to-[#0a1628] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.20),transparent_55%),radial-gradient(circle_at_80%_15%,rgba(251,191,36,0.10),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">
                {new Date().toLocaleDateString('en-ZW', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <h1 className="text-3xl font-black text-white leading-tight">
                Good {getGreeting()},&nbsp;
                <span className="text-primary-400">{user?.fullName.split(' ')[0]}</span>
              </h1>
              <p className="text-white/55 mt-1.5 text-sm">
                {isCpdComplete
                  ? 'You have completed your CPD requirements for this cycle.'
                  : `${Math.max(0, (cpd?.requiredPoints ?? 12) - (cpd?.totalPoints ?? 0))} points to go — keep the momentum.`}
              </p>
            </div>

            <div className="flex items-center gap-5 flex-shrink-0">
              {cpdLoading ? (
                <div className="w-28 h-28 bg-white/10 rounded-full animate-pulse" />
              ) : (
                <ProgressRing
                  value={cpd?.percentComplete ?? 0}
                  label={`${cpd?.totalPoints ?? 0}`}
                  sublabel={`/ ${cpd?.requiredPoints ?? 12} pts`}
                  color={isCpdComplete ? '#22c55e' : isUrgent ? '#f59e0b' : '#3b82f6'}
                />
              )}
              {isCpdComplete && (
                <div className="flex items-center gap-2 bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-semibold px-4 py-2 rounded-full">
                  <CheckCircle2 size={16} />
                  CPD Complete!
                </div>
              )}
            </div>
          </div>

          {/* Urgent deadline strip */}
          {isUrgent && !isCpdComplete && (
            <div className="mt-5 bg-amber-500/15 border border-amber-400/25 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                <Calendar size={16} className="text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-200">{daysLeft} days until renewal deadline</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  You still need {Math.max(0, (cpd?.requiredPoints ?? 12) - (cpd?.totalPoints ?? 0))} more points.
                </p>
              </div>
              <Link
                to="/courses"
                className="flex-shrink-0 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
              >
                Find courses →
              </Link>
            </div>
          )}

          {/* Profile completeness prompt */}
          {profileMissing && (
            <div className="mt-4 bg-white/8 border border-white/10 rounded-xl p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary-500/25 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-primary-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Complete your profile for better recommendations</p>
                <p className="text-xs text-white/50 mt-0.5">Add your council, title, and registration number.</p>
              </div>
              <Link
                to="/profile"
                className="flex-shrink-0 bg-primary-500 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary-600 transition-colors"
              >
                Update →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard
            title="Points Earned"
            value={cpdLoading ? '–' : `${cpd?.totalPoints ?? 0}`}
            subtitle={`of ${cpd?.requiredPoints ?? 12} required`}
            icon={<Award size={20} />}
            accent="teal"
            trend={
              (cpd?.totalPoints ?? 0) > 0
                ? { label: `${cpd?.totalPoints} earned this cycle`, direction: 'up' }
                : undefined
            }
          />
          <StatCard
            title="Points Needed"
            value={cpdLoading ? '–' : Math.max(0, (cpd?.requiredPoints ?? 12) - (cpd?.totalPoints ?? 0))}
            subtitle="to complete renewal"
            icon={<BookOpen size={20} />}
            accent="amber"
          />
          <StatCard
            title="Days to Renewal"
            value={daysLeft}
            subtitle={renewalDeadline.toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', year: 'numeric' })}
            icon={<Calendar size={20} />}
            accent={isUrgent ? 'red' : 'green'}
            trend={
              isUrgent
                ? { label: 'Deadline approaching', direction: 'down' }
                : { label: 'On track', direction: 'up' }
            }
          />
        </div>

        {/* Continue Learning */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-base font-bold text-slate-900">Continue Learning</h2>
            <Link to="/my-learning" className="text-sm font-semibold text-primary-600 hover:underline flex items-center gap-1">
              All courses <ArrowRight size={14} />
            </Link>
          </div>

          {inProgressLoading ? (
            <div className="px-6 pb-6 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !inProgress?.length ? (
            <div className="px-6 pb-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <BookOpen size={22} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-600">No courses in progress yet.</p>
              <Link to="/courses" className="text-sm text-primary-600 hover:underline mt-1 inline-block">
                Browse courses →
              </Link>
            </div>
          ) : (
            <div className="px-6 pb-6 space-y-2">
              {inProgress.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  to={`/courses/${enrollment.course.id}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div
                    className={`w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden ${
                      CATEGORY_COLOURS[enrollment.course.category] ?? 'bg-slate-100'
                    } flex items-center justify-center`}
                  >
                    {enrollment.course.thumbnailUrl ? (
                      <img src={enrollment.course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={20} className="text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{enrollment.course.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-700"
                          style={{ width: `${enrollment.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0 tabular-nums">
                        {enrollment.progressPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-primary-500 group-hover:translate-x-0.5 transition-transform">
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── AI-Powered Recommendations ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary-500" />
              <h2 className="text-lg font-bold text-slate-900">Recommended for You</h2>
              <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                AI-powered
              </span>
              {isProfileBased && !recsLoading && hasCourses && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  Based on your profile
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void refreshRecsMutation.mutate()}
              disabled={refreshRecsMutation.isPending || recsLoading}
              title="Refresh recommendations"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600 disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={13} className={refreshRecsMutation.isPending ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {recsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="aspect-video bg-slate-100 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-4/5 bg-slate-100 rounded animate-pulse" />
                    <div className="h-8 w-full bg-slate-100 rounded-lg animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {recsError && !recsLoading && (
            <p className="text-sm text-slate-400">Could not load recommendations right now.</p>
          )}

          {!recsLoading && hasCourses && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {recommendations!.courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}

          {!recsLoading && !recsError && !hasCourses && (
            <div className="bg-gradient-to-r from-primary-50 to-slate-50 border border-primary-100 rounded-2xl p-6 flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Sparkles size={22} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 mb-1">
                  Personalised recommendations are on their way
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {recommendations?.message ??
                    'Complete your council, title, and registration profile so we can surface the most relevant courses for your practice.'}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    Complete your profile →
                  </Link>
                  <span className="text-slate-300 text-xs">·</span>
                  <Link to="/courses" className="text-xs text-slate-500 hover:text-slate-700">
                    Browse all courses
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom row: Recent activity + WhatsApp shortcut */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">Recent Activity</h2>
            {!recentActivity?.length ? (
              <p className="text-sm text-slate-400">No activity yet — complete a quiz to earn points.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((activity) => (
                  <li key={activity.id} className="flex items-center gap-3 py-1">
                    <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Award size={15} className="text-primary-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {activity.course?.title ?? activity.activityType}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(activity.completedAt).toLocaleDateString('en-ZW')}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary-600 flex-shrink-0 tabular-nums">
                      +{activity.pointsEarned} pt{activity.pointsEarned !== 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* WhatsApp shortcut */}
          <div className="bg-gradient-to-br from-[#075e54] to-[#128c7e] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.098.544 4.071 1.494 5.785L.057 24l6.347-1.664A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.368l-.359-.213-3.72.976.993-3.63-.234-.372A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-white text-sm">Learn on WhatsApp</p>
                <p className="text-white/70 text-xs mt-1 leading-relaxed">
                  No app needed. Earn CPD points via micro-lessons delivered to your phone.
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/263771234567"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors border border-white/20"
            >
              Start learning on WhatsApp →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
