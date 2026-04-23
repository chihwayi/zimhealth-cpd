import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, List, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../../lib/api';
import { CourseCard } from '../../components/course/CourseCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../store/auth.store';

type CourseSummary = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  thumbnailUrl?: string | null;
  estimatedMinutes: number;
  cpdPoints: number;
  averageRating?: number | null;
  reviewCount?: number | null;
  creatorName?: string | null;
  modules?: Array<{ isOfflineReady: boolean }>;
};

type CoursesResponse = {
  courses: CourseSummary[];
  total: number;
  page: number;
  totalPages: number;
};

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'points_desc' | 'rating_desc' | 'duration_asc';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  points_desc: 'Most CPD points',
  rating_desc: 'Highest rated',
  duration_asc: 'Shortest first',
};

function sortCourses(courses: CourseSummary[], sort: SortOption): CourseSummary[] {
  return [...courses].sort((a, b) => {
    if (sort === 'points_desc') return b.cpdPoints - a.cpdPoints;
    if (sort === 'rating_desc') return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    if (sort === 'duration_asc') return a.estimatedMinutes - b.estimatedMinutes;
    return 0; // newest: server order preserved
  });
}

export default function CoursesPage() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortOption>('newest');

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

  const sortedCourses = useMemo(
    () =>
      sortCourses(data?.courses ?? [], sort).map((course) => ({
        ...course,
        locked: user?.role === 'LEARNER' && (user.subscriptionTier ?? 'FREE') === 'FREE',
      })),
    [data?.courses, sort, user?.role, user?.subscriptionTier],
  );

  const activeFiltersCount = [search, category, difficulty].filter(Boolean).length;

  function clearFilters() {
    setSearch('');
    setCategory('');
    setDifficulty('');
    setPage(1);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start gap-6">
        {/* Sidebar filters */}
        <aside className="w-64 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-5 space-y-5 sticky top-6 self-start">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <SlidersHorizontal size={15} />
              Refine eligible courses
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
              >
                <X size={12} />
                Clear {activeFiltersCount}
              </button>
            )}
          </div>

          <div>
            <label htmlFor="course-search" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Search
            </label>
            <input
              id="course-search"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="e.g. IPC, ethics..."
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="course-category" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Category
            </label>
            <select
              id="course-category"
              value={category}
              onChange={(e) => { setPage(1); setCategory(e.target.value); }}
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="">All categories</option>
              <option value="CLINICAL">Clinical</option>
              <option value="MANAGEMENT">Management</option>
              <option value="ETHICS">Ethics</option>
              <option value="RESEARCH">Research</option>
            </select>
          </div>

          <div>
            <label htmlFor="course-difficulty" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Difficulty
            </label>
            <select
              id="course-difficulty"
              value={difficulty}
              onChange={(e) => { setPage(1); setDifficulty(e.target.value); }}
              className="mt-2 w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="">All levels</option>
              <option value="FOUNDATION">Foundation</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <ShieldCheck size={15} />
              Matched to your profile
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Showing courses allowed for {user?.professionalTitle ?? 'your professional title'} under your council.
            </p>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Your Eligible Courses</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {isLoading ? 'Loading…' : data ? `${data.total} course${data.total === 1 ? '' : 's'} found` : ''}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort courses"
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white text-slate-700"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
                  <option key={k} value={k}>{SORT_LABELS[k]}</option>
                ))}
              </select>

              {/* View toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    view === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setView('list')}
                  aria-label="List view"
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {search && (
                <span className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">
                  "{search}"
                  <button onClick={() => { setSearch(''); setPage(1); }} aria-label="Remove search filter">
                    <X size={11} />
                  </button>
                </span>
              )}
              {category && (
                <span className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">
                  {category.charAt(0) + category.slice(1).toLowerCase()}
                  <button onClick={() => { setCategory(''); setPage(1); }} aria-label="Remove category filter">
                    <X size={11} />
                  </button>
                </span>
              )}
              {difficulty && (
                <span className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">
                  {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
                  <button onClick={() => { setDifficulty(''); setPage(1); }} aria-label="Remove difficulty filter">
                    <X size={11} />
                  </button>
                </span>
              )}
            </div>
          )}

          {error ? (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl p-4">{(error as Error).message}</div>
          ) : isLoading ? (
            <div className={clsx(view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={clsx('bg-white rounded-xl border border-slate-200 animate-pulse', view === 'grid' ? 'h-72' : 'h-24')} />
              ))}
            </div>
          ) : sortedCourses.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} />}
              title="No courses found"
              description="No eligible courses match your search. Clear filters, or ask your council/admin to publish content for your title."
              action={
                <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline">
                  Clear all filters
                </button>
              }
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCourses.map((course) => (
                <ListCourseRow key={course.id} course={course} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <div className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{data.page}</span> of{' '}
                <span className="font-medium text-slate-900">{data.totalPages}</span>
              </div>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={data.page >= data.totalPages}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Compact list-mode row
function ListCourseRow({ course }: { course: CourseSummary }) {
  return (
    <a
      href={`/courses/${course.id}`}
      className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all duration-150 hover:-translate-y-px group"
    >
      <div className="w-20 h-14 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100">
            <BookOpen size={20} className="text-primary-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{course.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {course.category} · {course.estimatedMinutes} min
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-primary-700">{course.cpdPoints} pts</div>
        <div className="text-xs text-slate-400 mt-0.5">{course.difficulty?.toLowerCase()}</div>
      </div>
    </a>
  );
}
