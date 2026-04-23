import { BookOpen, Clock, Award, Wifi, Star, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Badge } from '../ui/Badge';

type CourseCardCourse = {
  id: string;
  title: string;
  category: string;
  difficulty?: string;
  thumbnailUrl?: string | null;
  estimatedMinutes: number;
  cpdPoints: number;
  effectivePoints?: number | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  creatorName?: string | null;
  modules?: Array<{ isOfflineReady: boolean }>;
  enrollmentProgress?: number | null; // 0–100, present if enrolled
  aiReason?: string | null;
  aiReasonCategories?: string[];
  locked?: boolean;
};

const CATEGORY_VARIANT: Record<string, 'clinical' | 'management' | 'ethics' | 'research' | 'default'> = {
  CLINICAL: 'clinical',
  MANAGEMENT: 'management',
  ETHICS: 'ethics',
  RESEARCH: 'research',
};

const DIFFICULTY_COLOURS: Record<string, string> = {
  FOUNDATION: 'text-green-600 bg-green-50',
  INTERMEDIATE: 'text-amber-600 bg-amber-50',
  ADVANCED: 'text-red-600 bg-red-50',
};

function StarRating({ value, count }: { value: number; count?: number | null }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={clsx(
            i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200',
          )}
        />
      ))}
      <span className="text-xs text-slate-500 ml-0.5">
        {value.toFixed(1)}
        {count ? ` (${count})` : ''}
      </span>
    </div>
  );
}

export function CourseCard({ course }: { course: CourseCardCourse }) {
  const isEnrolled = course.enrollmentProgress != null;
  const isOffline = course.modules?.some((m) => m.isOfflineReady);
  const categoryVariant = CATEGORY_VARIANT[course.category] ?? 'default';
  const isLocked = Boolean(course.locked);
  const points = course.effectivePoints ?? course.cpdPoints;

  return (
    <Link
      to={isLocked ? '/subscription' : `/courses/${course.id}`}
      className="block group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-xl"
      aria-label={isLocked ? `${course.title} (locked)` : course.title}
    >
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full flex flex-col">
        {/* Thumbnail */}
        <div className="aspect-video bg-slate-100 relative overflow-hidden flex-shrink-0">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100">
              <BookOpen className="text-primary-300" size={36} />
            </div>
          )}

          {/* Offline badge */}
          {isOffline && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 text-xs font-medium text-slate-600 shadow-sm">
              <Wifi size={10} />
              Offline
            </div>
          )}

          {/* Difficulty pill */}
          {course.difficulty && (
            <div
              className={clsx(
                'absolute bottom-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full',
                DIFFICULTY_COLOURS[course.difficulty] ?? 'text-slate-600 bg-white/80',
              )}
            >
              {course.difficulty.charAt(0) + course.difficulty.slice(1).toLowerCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5 flex flex-col flex-1">
          {/* Category */}
          <Badge variant={categoryVariant}>
            {course.category.charAt(0) + course.category.slice(1).toLowerCase()}
          </Badge>

          {/* Title */}
          <h3 className="font-semibold text-slate-900 line-clamp-2 leading-snug text-sm flex-1">
            {course.title}
          </h3>

          {/* Rating */}
          {course.averageRating != null && course.averageRating > 0 && (
            <StarRating value={course.averageRating} count={course.reviewCount} />
          )}

          {/* Creator */}
          {course.creatorName && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <User size={10} className="text-primary-600" />
              </div>
              <span className="truncate">{course.creatorName}</span>
            </div>
          )}

          {course.aiReason && (
            <div className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Recommended for you</p>
              <p className="mt-1 text-xs text-primary-800 leading-relaxed">{course.aiReason}</p>
              {course.aiReasonCategories?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {course.aiReasonCategories.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full bg-white/80 border border-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700"
                    >
                      {c.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {course.estimatedMinutes} min
            </span>
            <span
              className="flex items-center gap-1 text-primary-700 font-medium"
              title="Council-assigned CPD points (approved by your council)"
            >
              <Award size={12} />
              <span className="tabular-nums">{points}</span>
              <span className="text-slate-400 font-medium">Council CPD</span>
            </span>
          </div>

          {/* Progress bar or CTA */}
          {isEnrolled ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span className="font-medium text-slate-700">{course.enrollmentProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${course.enrollmentProgress}%` }}
                />
              </div>
              <div className="text-xs font-medium text-primary-700 group-hover:underline">
                Continue →
              </div>
            </div>
          ) : (
            <div className="mt-auto pt-1">
              {isLocked ? (
                <div className="w-full bg-slate-900 text-white text-sm font-semibold py-2 rounded-lg text-center group-hover:bg-slate-800 transition-colors">
                  Locked — Upgrade
                </div>
              ) : (
                <div className="w-full bg-primary-500 text-white text-sm font-medium py-2 rounded-lg text-center group-hover:bg-primary-600 transition-colors">
                  Enrol Now
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
