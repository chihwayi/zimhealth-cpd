import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Eye, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

interface MyCourse {
  id: string; title: string; status: string; cpdPoints: number;
  _count: { enrollments: number };
}

export default function CreatorDashboard() {
  const { data, isLoading } = useQuery<{ courses: MyCourse[] }>({
    queryKey: ['creator-courses'],
    queryFn: () => api.get('/api/creator/courses'),
  });

  const courses = data?.courses ?? [];
  const published = courses.filter((c) => c.status === 'PUBLISHED').length;
  const drafts = courses.filter((c) => c.status === 'DRAFT').length;
  const underReview = courses.filter((c) => c.status === 'UNDER_REVIEW').length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Creator Portal</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your CPD courses</p>
        </div>
        <Link to="/creator/courses/new" className="flex items-center gap-2 bg-primary-700 text-white font-bold px-4 py-2.5 rounded-lg hover:bg-primary-700 transition-colors shadow-sm text-sm">
          <Plus size={16} /> New Course
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Courses" value={courses.length} icon={<BookOpen size={20} />} accent="teal" />
        <StatCard title="Published" value={published} icon={<CheckCircle size={20} />} accent="green" />
        <StatCard title="Under Review" value={underReview} icon={<Clock size={20} />} accent="amber" />
        <StatCard title="Drafts" value={drafts} icon={<Eye size={20} />} accent="blue" />
      </div>

      {/* Course list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">My Courses</h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={28} />}
            title="No courses yet"
            description="Create your first course draft to start building your creator catalog."
            action={<Link to="/creator/courses/new" className="text-primary-700 hover:underline text-sm font-bold">Create your first course</Link>}
          />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{course.title}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-6 py-4 text-slate-600">{course._count.enrollments}</td>
                  <td className="px-6 py-4">
                    <Link to={`/creator/courses/${course.id}/edit`} className="text-primary-700 hover:underline text-sm font-bold">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'warning' | 'default'> = {
    PUBLISHED: 'success',
    UNDER_REVIEW: 'warning',
    DRAFT: 'default',
    ARCHIVED: 'default',
  };
  return (
    <Badge variant={map[status] ?? 'default'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}
