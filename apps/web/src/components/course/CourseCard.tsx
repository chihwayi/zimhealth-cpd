import { BookOpen, Clock, Award, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';

type CourseCardCourse = {
  id: string;
  title: string;
  category: string;
  thumbnailUrl?: string | null;
  estimatedMinutes: number;
  cpdPoints: number;
  modules?: Array<{ isOfflineReady: boolean }>;
};

const CATEGORY_COLOURS: Record<string, string> = {
  CLINICAL: 'bg-blue-100 text-blue-700',
  MANAGEMENT: 'bg-violet-100 text-violet-700',
  ETHICS: 'bg-orange-100 text-orange-700',
  RESEARCH: 'bg-teal-100 text-teal-700',
};

export function CourseCard({ course }: { course: CourseCardCourse }) {
  return (
    <Link to={`/courses/${course.id}`} className="block group">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
        {/* Thumbnail */}
        <div className="aspect-video bg-slate-100 relative overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="text-slate-300" size={40} />
            </div>
          )}
          {/* Offline badge */}
          {course.modules?.some((m) => m.isOfflineReady) && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Wifi size={10} /> Offline
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Category */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              CATEGORY_COLOURS[course.category] ?? 'bg-slate-100 text-slate-600'
            }`}
          >
            {course.category}
          </span>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 line-clamp-2 leading-snug text-sm">{course.title}</h3>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {course.estimatedMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Award size={12} />
              {course.cpdPoints} CPD pts
            </span>
          </div>

          {/* CTA */}
          <button className="w-full bg-primary-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-600 transition-colors">
            Enrol Now
          </button>
        </div>
      </div>
    </Link>
  );
}

