import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Search, Filter } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

interface MyCourse {
  id: string;
  title: string;
  status: string;
  cpdPoints: number;
  updatedAt?: string;
  _count: { enrollments: number };
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'warning' | 'default'> = {
    PUBLISHED: 'success',
    UNDER_REVIEW: 'warning',
    DRAFT: 'default',
    ARCHIVED: 'default',
  };
  return <Badge variant={map[status] ?? 'default'}>{formatLabel(status)}</Badge>;
}

export default function CreatorCourses() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED'>('ALL');

  const coursesQuery = useQuery<{ courses: MyCourse[] }>({
    queryKey: ['creator-courses'],
    queryFn: () => api.get('/api/creator/courses'),
  });

  const filtered = useMemo(() => {
    const courses = coursesQuery.data?.courses ?? [];
    return courses.filter((c) => {
      if (status !== 'ALL' && c.status !== status) return false;
      if (!q.trim()) return true;
      const term = q.trim().toLowerCase();
      return c.title.toLowerCase().includes(term);
    });
  }, [coursesQuery.data, q, status]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Courses</h1>
          <p className="text-sm text-slate-500 mt-1">Create drafts, submit for review, and manage published content.</p>
        </div>
        <Link
          to="/creator/courses/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <Plus size={16} /> New Course
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by course title…"
            className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-500"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen size={18} className="text-violet-600" />
            Courses
          </div>
          <div className="text-xs text-slate-500">{filtered.length} shown</div>
        </div>

        {coursesQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : coursesQuery.isError ? (
          <div className="p-6">
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load courses.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BookOpen size={28} />}
              title="No courses found"
              description="Try a different search or create a new course."
              action={
                <Link to="/creator/courses/new" className="text-violet-700 hover:underline text-sm font-semibold">
                  Create a new course
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((course) => (
              <div key={course.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{course.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge status={course.status} />
                    <span>{course.cpdPoints} points</span>
                    <span>•</span>
                    <span>{course._count.enrollments} enrollments</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/creator/courses/${course.id}/edit`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

