import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Award, ArrowRight, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

type EnrollmentSummary = {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  progressPercent: number;
  enrolledAt: string;
  completedAt?: string | null;
  course: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    thumbnailUrl?: string | null;
    estimatedMinutes: number;
    cpdPoints: number;
  };
};

type StatusTab = 'IN_PROGRESS' | 'COMPLETED';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

const CATEGORY_BG: Record<string, string> = {
  CLINICAL: 'from-blue-50 to-blue-100',
  MANAGEMENT: 'from-violet-50 to-violet-100',
  ETHICS: 'from-orange-50 to-orange-100',
  RESEARCH: 'from-teal-50 to-teal-100',
};

export default function MyLearningPage() {
  const [tab, setTab] = useState<StatusTab>('IN_PROGRESS');

  const { data, isLoading } = useQuery<EnrollmentSummary[]>({
    queryKey: ['enrollments', tab],
    queryFn: () => api.get(`/api/enrollments?status=${tab}&limit=20`),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Learning</h1>
        <p className="text-sm text-slate-600 mt-1">Track your enrolled courses and progress.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="bg-white border border-slate-200 rounded-2xl">
          <EmptyState
            icon={<BookOpen size={28} />}
            title={tab === 'IN_PROGRESS' ? 'No courses in progress' : 'No completed courses yet'}
            description={
              tab === 'IN_PROGRESS'
                ? 'Browse the course catalogue and enrol to get started.'
                : 'Complete an enrolled course to see it here.'
            }
            action={
              tab === 'IN_PROGRESS' ? (
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Browse courses <ArrowRight size={14} />
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((enrollment) => (
            <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: EnrollmentSummary }) {
  const { course } = enrollment;
  const isComplete = enrollment.status === 'COMPLETED';
  const catBg = CATEGORY_BG[course.category] ?? 'from-slate-50 to-slate-100';
  const categoryVariant = (course.category.toLowerCase() as 'clinical' | 'management' | 'ethics' | 'research') ?? 'default';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        {/* Thumbnail */}
        <div className={clsx('w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden bg-gradient-to-br', catBg)}>
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={22} className="text-slate-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{course.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant={categoryVariant}>
                  {course.category.charAt(0) + course.category.slice(1).toLowerCase()}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={11} />
                  {course.estimatedMinutes} min
                </span>
                <span className="flex items-center gap-1 text-xs text-primary-700 font-medium">
                  <Award size={11} />
                  {course.cpdPoints} pts
                </span>
              </div>
            </div>

            {isComplete ? (
              <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0">
                <CheckCircle2 size={12} />
                Completed
              </div>
            ) : (
              <Link
                to={`/courses/${course.id}`}
                className="flex items-center gap-1.5 bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors flex-shrink-0"
              >
                Continue <ArrowRight size={12} />
              </Link>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-700',
                  isComplete ? 'bg-green-500' : 'bg-primary-500',
                )}
                style={{ width: `${enrollment.progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 tabular-nums flex-shrink-0">
              {enrollment.progressPercent}%
            </span>
          </div>

          <p className="text-xs text-slate-400 mt-2">
            Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString('en-ZW')}
            {enrollment.completedAt &&
              ` · Completed ${new Date(enrollment.completedAt).toLocaleDateString('en-ZW')}`}
          </p>
        </div>
      </div>
    </div>
  );
}
