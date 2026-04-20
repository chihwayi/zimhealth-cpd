import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CourseCard } from '../../components/course/CourseCard';

type CourseSummary = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  thumbnailUrl?: string | null;
  estimatedMinutes: number;
  cpdPoints: number;
  modules?: Array<{ isOfflineReady: boolean }>;
};

type CoursesResponse = {
  courses: CourseSummary[];
  total: number;
  page: number;
  totalPages: number;
};

export default function CoursesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (difficulty) params.set('difficulty', difficulty);
    params.set('page', String(page));
    params.set('limit', '12');
    return params.toString();
  }, [search, category, difficulty, page]);

  const { data, isLoading, error } = useQuery<CoursesResponse>({
    queryKey: ['courses', queryString],
    queryFn: () => api.get(`/api/courses?${queryString}`),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start gap-6">
        {/* Filters */}
        <aside className="w-72 bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Search</h2>
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="e.g. IPC, ethics..."
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Category</h2>
            <select
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="CLINICAL">Clinical</option>
              <option value="MANAGEMENT">Management</option>
              <option value="ETHICS">Ethics</option>
              <option value="RESEARCH">Research</option>
            </select>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">Difficulty</h2>
            <select
              value={difficulty}
              onChange={(e) => {
                setPage(1);
                setDifficulty(e.target.value);
              }}
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="FOUNDATION">Foundation</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
        </aside>

        {/* Results */}
        <section className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-slate-900">Browse Courses</h1>
            <p className="text-sm text-slate-500">
              {data ? `${data.total} course${data.total === 1 ? '' : 's'}` : '–'}
            </p>
          </div>

          {error ? <div className="text-sm text-red-600">{(error as Error).message}</div> : null}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(data?.courses ?? []).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!data || data.page <= 1}
            >
              Previous
            </button>
            <div className="text-sm text-slate-500">
              Page {data?.page ?? page} of {data?.totalPages ?? 1}
            </div>
            <button
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || data.page >= data.totalPages}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

