import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, TrendingUp, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { useCPDPoints } from '../../hooks/useCPDPoints';
import { StatCard } from '../../components/ui/StatCard';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { api } from '../../lib/api';

type CPDRecord = {
  id: string;
  activityType: string;
  pointsEarned: number;
  completedAt: string;
  cycleYear: number;
  course?: { title: string; category: string } | null;
};

const ACTIVITY_LABELS: Record<string, string> = {
  QUIZ_PASS: 'Quiz passed',
  COURSE_COMPLETE: 'Course completed',
  WEBINAR: 'Webinar attended',
  WORKSHOP: 'Workshop',
  MANUAL: 'Manual entry',
};

const ACTIVITY_COLOURS: Record<string, string> = {
  QUIZ_PASS: 'bg-teal-100 text-teal-700',
  COURSE_COMPLETE: 'bg-green-100 text-green-700',
  WEBINAR: 'bg-blue-100 text-blue-700',
  WORKSHOP: 'bg-violet-100 text-violet-700',
  MANUAL: 'bg-amber-100 text-amber-700',
};

export default function PointsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: summary, isLoading: summaryLoading } = useCPDPoints(selectedYear);

  const { data: records, isLoading: recordsLoading } = useQuery<CPDRecord[]>({
    queryKey: ['cpd-records', selectedYear],
    queryFn: () => api.get(`/api/points?year=${selectedYear}&limit=50`),
  });

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My CPD Points</h1>
          <p className="text-sm text-slate-500 mt-1">Track your continuing professional development progress.</p>
        </div>

        {/* Year picker */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                selectedYear === y
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center gap-3">
          {summaryLoading ? (
            <div className="w-32 h-32 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <ProgressRing
              value={summary?.percentComplete ?? 0}
              label={`${summary?.totalPoints ?? 0}`}
              sublabel={`/ ${summary?.requiredPoints ?? 12} pts`}
              size={128}
              strokeWidth={10}
            />
          )}
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {selectedYear} Cycle
          </p>
        </div>

        <StatCard
          title="Points Earned"
          value={summaryLoading ? '–' : `${summary?.totalPoints ?? 0}`}
          subtitle={`of ${summary?.requiredPoints ?? 12} required`}
          icon={<Award size={18} />}
          accent="teal"
        />
        <StatCard
          title="Activities"
          value={summaryLoading ? '–' : summary?.recordCount ?? 0}
          subtitle="logged this cycle"
          icon={<TrendingUp size={18} />}
          accent="blue"
        />
        <StatCard
          title="Points Still Needed"
          value={summaryLoading ? '–' : Math.max(0, (summary?.requiredPoints ?? 12) - (summary?.totalPoints ?? 0))}
          subtitle="to complete renewal"
          icon={<Calendar size={18} />}
          accent={
            (summary?.percentComplete ?? 0) >= 100
              ? 'green'
              : (summary?.percentComplete ?? 0) >= 75
              ? 'amber'
              : 'red'
          }
        />
      </div>

      {/* Activity log */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Activity Log — {selectedYear}</h2>
          <span className="text-xs text-slate-500">
            {recordsLoading ? '…' : `${records?.length ?? 0} activities`}
          </span>
        </div>

        {recordsLoading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-9 h-9 bg-slate-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-12" />
              </div>
            ))}
          </div>
        ) : !records?.length ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Award size={22} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">No activities recorded for {selectedYear}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((record) => (
              <div key={record.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                <div
                  className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                    ACTIVITY_COLOURS[record.activityType] ?? 'bg-slate-100 text-slate-600',
                  )}
                >
                  <Award size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {record.course?.title ?? ACTIVITY_LABELS[record.activityType] ?? record.activityType}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        ACTIVITY_COLOURS[record.activityType] ?? 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {ACTIVITY_LABELS[record.activityType] ?? record.activityType}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(record.completedAt).toLocaleDateString('en-ZW', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="text-sm font-bold text-primary-700">
                    +{record.pointsEarned}
                  </span>
                  <p className="text-xs text-slate-400">pt{record.pointsEarned !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
