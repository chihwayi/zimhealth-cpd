import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, BookOpen, Calendar, CheckCircle, Star, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

type SummaryResponse = {
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  avgRating: number;
};

type TimeseriesPoint = {
  name: string;
  enrollments: number;
  completions: number;
};

type CourseAnalytics = {
  id: string;
  title: string;
  category: string;
  status: string;
  enrollmentCount: number;
  completionRate: number;
  avgQuizScore: number;
  passRate: number;
  avgRating: number;
};

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function CreatorAnalytics() {
  const { data: summary, isLoading: isSummaryLoading } = useQuery<SummaryResponse>({
    queryKey: ['creator-analytics-summary'],
    queryFn: () => api.get('/api/creator/analytics/summary'),
  });

  const { data: timeseries, isLoading: isTimeseriesLoading } = useQuery<TimeseriesPoint[]>({
    queryKey: ['creator-analytics-timeseries'],
    queryFn: () => api.get('/api/creator/analytics/timeseries'),
  });

  const { data: courseAnalytics, isLoading: isCoursesLoading } = useQuery<{ courses: CourseAnalytics[] }>({
    queryKey: ['creator-analytics-courses'],
    queryFn: () => api.get('/api/creator/analytics/courses'),
  });

  const isLoading = isSummaryLoading || isTimeseriesLoading || isCoursesLoading;
  const courses = courseAnalytics?.courses ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Creator Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Real enrollment, completion, and assessment performance for your courses.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
          <Calendar size={16} />
          Last 6 months
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard title="Total Enrollments" value={summary?.totalEnrollments ?? 0} icon={<Users size={20} />} accent="teal" />
        <StatCard title="Completion Rate" value={`${Math.round((summary?.completionRate ?? 0) * 100)}%`} icon={<CheckCircle size={20} />} accent="green" />
        <StatCard title="Average Rating" value={(summary?.avgRating ?? 0).toFixed(1)} icon={<Star size={20} />} accent="amber" />
        <StatCard title="Total Courses" value={summary?.totalCourses ?? 0} icon={<BookOpen size={20} />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Enrollment Trend</h2>
            <p className="text-sm text-slate-500 mt-1">Monthly enrollments and completions from actual learner activity.</p>
          </div>
          <div className="p-6 h-[320px]">
            {isLoading ? (
              <div className="h-full w-full rounded-xl bg-slate-100 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseries ?? []}>
                  <defs>
                    <linearGradient id="creator-enrollments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="creator-completions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.16} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Area type="monotone" dataKey="enrollments" stroke="#14b8a6" fill="url(#creator-enrollments)" strokeWidth={3} />
                  <Area type="monotone" dataKey="completions" stroke="#22c55e" fill="url(#creator-completions)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Quality Snapshot</h2>
            <p className="text-sm text-slate-500 mt-1">How the catalog is performing right now.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">Average course rating</p>
              <div className="mt-2 flex items-center gap-2 text-slate-900">
                <Star size={18} className="text-amber-400" fill="currentColor" />
                <span className="text-2xl font-bold tabular-nums">{(summary?.avgRating ?? 0).toFixed(1)}</span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">Course completion benchmark</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{Math.round((summary?.completionRate ?? 0) * 100)}%</p>
              <p className="mt-1 text-sm text-slate-600">Based on all creator-owned course enrollments.</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">Courses with live learners</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {courses.filter((course) => course.enrollmentCount > 0).length}
              </p>
              <p className="mt-1 text-sm text-slate-600">Useful for spotting which drafts are ready for deeper iteration.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Per-Course Performance</h2>
          <p className="text-sm text-slate-500 mt-1">Completion, quiz scores, pass rate, and ratings by course.</p>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={28} />}
            title="No creator analytics yet"
            description="Publish a course and start getting enrollments to populate this view."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Enrollments</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Completion</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Avg Quiz Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Pass Rate</th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Rating</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{course.title}</div>
                      <div className="text-xs text-slate-500">{formatLabel(course.category)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={course.status === 'PUBLISHED' ? 'success' : course.status === 'UNDER_REVIEW' ? 'warning' : 'default'}>
                        {formatLabel(course.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center font-medium tabular-nums">{course.enrollmentCount}</td>
                    <td className="px-6 py-4 text-center font-medium tabular-nums">{Math.round(course.completionRate * 100)}%</td>
                    <td className="px-6 py-4 text-center font-medium tabular-nums">{Math.round(course.avgQuizScore)}%</td>
                    <td className="px-6 py-4 text-center font-medium tabular-nums">{Math.round(course.passRate * 100)}%</td>
                    <td className="px-6 py-4 text-center font-medium tabular-nums">{course.avgRating.toFixed(1)}</td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/creator/courses/${course.id}/edit`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                      >
                        Open
                        <ArrowUpRight size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
