import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { QuizPlayer } from '../../components/course/QuizPlayer';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Play,
  Star,
  Trash2,
  Trophy,
  Volume2,
  WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import {
  saveModuleOffline,
  type OfflineQuiz,
  getOfflineModulesForCourse,
  deleteOfflineModule,
  isModuleOffline,
  queueProgressUpdate,
} from '../../lib/offlineDB';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentSection = {
  id: string;
  type: 'VIDEO' | 'READING' | 'AUDIO' | 'INTERACTIVE' | 'QUIZ';
  title: string;
  order: number;
  content: string;
  mediaUrl?: string | null;
};

type Quiz = {
  id: string;
  courseId?: string;
  moduleId?: string;
  title: string;
  passMark?: number;
  attemptLimit?: number;
  attemptsRemaining?: number;
  showAnswersAfter?: boolean;
  questions?: Array<{
    id: string;
    text: string;
    imageUrl?: string | null;
    correctOptionId?: string | null;
    options: Array<{ id: string; text: string }>;
  }>;
};

type Module = {
  id: string;
  title: string;
  order: number;
  isOfflineReady: boolean;
  sections: ContentSection[];
  quizzes?: Quiz[];
};

type CourseDetail = {
  id: string;
  title: string;
  subtitle?: string | null;
  description: string;
  thumbnailUrl?: string | null;
  cpdPoints: number;
  effectivePoints?: number | null;
  estimatedMinutes: number;
  category: string;
  difficulty: string;
  modules: Module[];
};

type EnrollmentRow = {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  progressPercent: number;
  completedSections: string[];
  enrolledAt: string;
  completedAt: string | null;
  course: {
    id: string;
    title: string;
    category: string;
    difficulty: string;
    thumbnailUrl: string | null;
    estimatedMinutes: number;
    cpdPoints: number;
  };
};

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={clsx(
              'transition-colors',
              (hovered || value) >= star ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300',
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Section Content Renderer ─────────────────────────────────────────────────

function SectionContent({
  section,
  activeQuizId,
  onQuizPass,
}: {
  section: ContentSection;
  activeQuizId: string | null;
  onQuizPass?: () => void;
}) {
  const mediaExt = (section.mediaUrl ?? '').split('?')[0].split('#')[0].toLowerCase();
  const isPdf = mediaExt.endsWith('.pdf');
  const isDocx = mediaExt.endsWith('.docx');
  const isPptx = mediaExt.endsWith('.pptx');

  if (section.type === 'VIDEO') {
    return section.mediaUrl ? (
      <div className="space-y-4">
        <video
          key={section.mediaUrl}
          controls
          className="w-full rounded-xl bg-slate-900 max-h-[480px]"
          src={section.mediaUrl}
        />
        {section.content && (
          <div
            className="prose prose-slate max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl gap-3">
        <Play size={36} className="text-slate-300" />
        <p className="text-sm text-slate-500">No video available for this section.</p>
      </div>
    );
  }

  if (section.type === 'AUDIO') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-5">
          <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Volume2 size={20} className="text-primary-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{section.title}</p>
            {section.mediaUrl ? (
              <audio controls className="w-full mt-2" src={section.mediaUrl} />
            ) : (
              <p className="text-xs text-slate-400 mt-1">No audio file attached.</p>
            )}
          </div>
        </div>
        {section.content && (
          <div
            className="prose prose-slate max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
      </div>
    );
  }

  if (section.type === 'READING') {
    return (
      <div className="space-y-4">
        {section.mediaUrl && isPdf ? (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">PDF document</div>
              <a
                href={section.mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={14} />
                Open in new tab
              </a>
            </div>
            <iframe title={section.title} src={section.mediaUrl} className="w-full h-[70vh] bg-white" />
          </div>
        ) : section.mediaUrl && (isDocx || isPptx) ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Document attachment</div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              This file type opens in your device’s document viewer.
            </p>
            <a
              href={section.mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Download size={16} />
              {isPptx ? 'Open PowerPoint (PPTX)' : 'Open Word document (DOCX)'}
            </a>
          </div>
        ) : null}

        {section.content ? (
          <div
            className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary-600"
            dangerouslySetInnerHTML={{ __html: section.content ?? '' }}
          />
        ) : null}
      </div>
    );
  }

  if (section.type === 'INTERACTIVE') {
    return (
      <div className="text-center space-y-5 py-10">
        <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
          <ExternalLink size={24} className="text-violet-500" />
        </div>
        {section.content && (
          <div
            className="prose prose-slate max-w-none text-sm text-left mb-4"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
        {section.mediaUrl ? (
          <a
            href={section.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-600 text-sm"
          >
            <ExternalLink size={14} />
            Open Interactive Content
          </a>
        ) : (
          <p className="text-sm text-slate-500">No link provided for this interactive section.</p>
        )}
      </div>
    );
  }

  if (section.type === 'QUIZ') {
    return activeQuizId ? (
      <QuizPlayer quizId={activeQuizId} onPass={onQuizPass} />
    ) : (
      <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-xl gap-3">
        <Lock size={28} className="text-slate-300" />
        <p className="text-sm text-slate-500">No quiz found for this section.</p>
      </div>
    );
  }

  return <p className="text-sm text-slate-500">Unknown section type.</p>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoursePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const user = useAuthStore((state) => state.user);
  // Creators and admins preview without enrolling — skip learner-only API calls
  const isPreviewMode = user?.role === 'CONTENT_MANAGER' || user?.role === 'ADMIN';

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [offlineModuleIds, setOfflineModuleIds] = useState<Set<string>>(new Set());
  const [downloadingModuleId, setDownloadingModuleId] = useState<string | null>(null);

  const { data: course, isLoading: courseLoading } = useQuery<CourseDetail>({
    queryKey: ['course', id],
    queryFn: () => api.get(`/api/courses/${id}`),
    enabled: !!id && isOnline,
  });

  const { data: enrollmentRows, isLoading: enrollmentLoading } = useQuery<EnrollmentRow[]>({
    queryKey: ['enrollment-course', id],
    queryFn: () => api.get(`/api/enrollments?courseId=${encodeURIComponent(id!)}`),
    enabled: !!id && isOnline && !isPreviewMode,
  });

  // ── Load offline data when offline ──
  const [offlineCourse, setOfflineCourse] = useState<CourseDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const modules = await getOfflineModulesForCourse(id);
      if (modules.length === 0) return;

      // Reconstruct a partial CourseDetail from cached modules
      const first = modules[0];
      const offlineDetail: CourseDetail = {
        id,
        title: first.courseTitle,
        description: '',
        cpdPoints: 0,
        estimatedMinutes: 0,
        category: '',
        difficulty: '',
        modules: modules
          .sort((a, b) => a.moduleOrder - b.moduleOrder)
          .map((m) => ({
            id: m.id,
            title: m.moduleTitle,
            order: m.moduleOrder,
            isOfflineReady: true,
            sections: m.sections,
            quizzes: m.quizzes,
          })),
      };
      setOfflineCourse(offlineDetail);
      setOfflineModuleIds(new Set(modules.map((m) => m.id)));
    })();
  }, [id]);

  // ── Track which modules are cached ──
  useEffect(() => {
    if (!course) return;
    void (async () => {
      const results = await Promise.all(course.modules.map((m) => isModuleOffline(m.id)));
      const ids = new Set(course.modules.filter((_, i) => results[i]).map((m) => m.id));
      setOfflineModuleIds(ids);
    })();
  }, [course]);

  // ── Sync back when reconnected ──
  useEffect(() => {
    if (!isOnline) return;
    const handler = () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-course', id] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    };
    const quizHandler = () => {
      void queryClient.invalidateQueries({ queryKey: ['cpd-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['cpd-records'] });
    };
    window.addEventListener('zimhealth:progress-synced', handler);
    window.addEventListener('zimhealth:quiz-attempts-synced', quizHandler);
    return () => {
      window.removeEventListener('zimhealth:progress-synced', handler);
      window.removeEventListener('zimhealth:quiz-attempts-synced', quizHandler);
    };
  }, [isOnline, id, queryClient]);

  // ── Download a module for offline ──
  const downloadModule = useCallback(async (moduleId: string) => {
    if (!course) return;
    const module = course.modules.find((m) => m.id === moduleId);
    if (!module) return;
    setDownloadingModuleId(moduleId);
    try {
      const quizzes = module.quizzes ?? [];
      const quizPayloads = await Promise.all(
        quizzes.map(async (q) => {
          try {
            return await api.get<{
              id: string;
              courseId: string;
              moduleId: string;
              title: string;
              passMark: number;
              attemptLimit: number;
              showAnswersAfter: boolean;
              questions: Array<{
                id: string;
                text: string;
                imageUrl?: string | null;
                correctOptionId?: string | null;
                options: Array<{ id: string; text: string }>;
              }>;
            }>(`/api/quizzes/${q.id}?offline=1`);
          } catch {
            return null;
          }
        }),
      );

      await saveModuleOffline({
        id: module.id,
        courseId: id!,
        courseTitle: course.title,
        moduleTitle: module.title,
        moduleOrder: module.order,
        sections: module.sections,
        quizzes: quizPayloads.filter(Boolean) as OfflineQuiz[],
        savedAt: Date.now(),
      });
      setOfflineModuleIds((prev) => new Set([...prev, moduleId]));
      // Best-effort telemetry (learner-only endpoint, skip in preview mode)
      if (!isPreviewMode) {
        void api.post('/api/telemetry/offline-download', { courseId: id, moduleId }).catch(() => null);
      }
    } finally {
      setDownloadingModuleId(null);
    }
  }, [course, id, isPreviewMode]);

  // ── Remove offline module ──
  const removeOfflineModule = useCallback(async (moduleId: string) => {
    await deleteOfflineModule(moduleId);
    setOfflineModuleIds((prev) => { const s = new Set(prev); s.delete(moduleId); return s; });
  }, []);

  const enrollment = enrollmentRows?.[0] ?? null;
  const completedSections = enrollment?.completedSections ?? [];
  const isEnrolled = isPreviewMode || !!enrollment;
  const isCompleted = enrollment?.status === 'COMPLETED';
  const progressPercent = enrollment?.progressPercent ?? 0;
  const isFreeLearner = user?.role === 'LEARNER' && (user.subscriptionTier ?? 'FREE') === 'FREE';

  // Use live course data when online, fall back to offline cache when not
  const effectiveCourse = isOnline ? course : (course ?? offlineCourse);
  const pointsLabel = (effectiveCourse?.effectivePoints ?? effectiveCourse?.cpdPoints ?? 0);

  const allSections = useMemo(() => {
    return (effectiveCourse?.modules ?? []).flatMap((m) =>
      m.sections.map((s) => ({ module: m, section: s })),
    );
  }, [effectiveCourse]);

  const totalSections = allSections.length;

  const active = useMemo(() => {
    if (!allSections.length) return null;
    const sectionId = activeSectionId ?? allSections[0].section.id;
    return allSections.find((x) => x.section.id === sectionId) ?? allSections[0];
  }, [allSections, activeSectionId]);

  const activeIndex = useMemo(
    () => (active ? allSections.findIndex((x) => x.section.id === active.section.id) : -1),
    [active, allSections],
  );

  const activeQuizId = useMemo(() => {
    if (!active || active.section.type !== 'QUIZ') return null;
    const quizzes = active.module.quizzes ?? [];
    if (!quizzes.length) return null;
    return quizzes.find((q) => q.id === active.section.content)?.id ?? quizzes[0].id;
  }, [active]);

  useEffect(() => {
    if (!activeSectionId && allSections.length) {
      setActiveSectionId(allSections[0].section.id);
    }
  }, [activeSectionId, allSections]);

  const enrollMutation = useMutation({
    mutationFn: () => api.post<EnrollmentRow>(`/api/courses/${id}/enroll`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-course', id] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });

  const markSectionCompleteMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      if (!enrollment) throw new Error('Not enrolled');
      if (!isOnline) {
        // Queue for later sync; optimistically update local state
        await queueProgressUpdate(enrollment.id, sectionId, totalSections);
        return;
      }
      return api.patch(`/api/enrollments/${enrollment.id}/progress`, { sectionId, totalSections });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['enrollment-course', id] });
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      if (activeIndex < allSections.length - 1) {
        setActiveSectionId(allSections[activeIndex + 1].section.id);
      }
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => {
      if (!enrollment) throw new Error('Not enrolled');
      return api.post(`/api/enrollments/${enrollment.id}/review`, {
        rating: reviewRating,
        ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
      });
    },
    onSuccess: () => setReviewSubmitted(true),
  });

  const isSectionDone = (sectionId: string) => completedSections.includes(sectionId);
  const activeSectionDone = active ? isSectionDone(active.section.id) : false;

  const isLoading = isOnline && (courseLoading || enrollmentLoading);
  const hasContent = !!effectiveCourse;

  // ── Loading skeleton ──
  if (isLoading && !hasContent) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-2/3 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 bg-slate-100 rounded-xl animate-pulse" />
          <div className="lg:col-span-4 h-96 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Offline with no cached content ──
  if (!isOnline && !hasContent) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
              <WifiOff size={28} className="text-amber-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">You're offline</h2>
          <p className="text-sm text-slate-500">
            This course hasn't been downloaded for offline use. Connect to the internet to access it.
          </p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!effectiveCourse) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-600 text-sm rounded-xl p-4">Course not found.</div>
      </div>
    );
  }

  // ── Enrollment gate ──
  if (!isEnrolled) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {effectiveCourse.thumbnailUrl && (
            <div className="h-52 overflow-hidden">
              <img src={effectiveCourse.thumbnailUrl} alt={effectiveCourse.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-semibold bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full">
                {effectiveCourse.category}
              </span>
              <span className="text-xs text-slate-500 capitalize">{effectiveCourse.difficulty?.toLowerCase()}</span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-500">{effectiveCourse.estimatedMinutes} min</span>
              <span className="text-slate-300 text-xs">·</span>
              <span
                className="text-xs font-semibold text-emerald-600"
                title="Council-assigned CPD points (approved by your council)"
              >
                <span className="tabular-nums">{pointsLabel}</span> Council CPD
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{effectiveCourse.title}</h1>
            {effectiveCourse.subtitle && <p className="text-base text-slate-600 mb-3">{effectiveCourse.subtitle}</p>}
            <p className="text-sm text-slate-500 line-clamp-4 mb-6">{effectiveCourse.description}</p>
            {isFreeLearner ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Free learners can still use WhatsApp CPD and micro-learning, but the full web course library is a premium feature.
                </div>
                <Link
                  to="/subscription"
                  className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors text-sm"
                >
                  <Lock size={16} />
                  Upgrade To Access Web Courses
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => enrollMutation.mutate()}
                  disabled={enrollMutation.isPending}
                  className="inline-flex items-center gap-2 bg-primary-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-colors text-sm"
                >
                  {enrollMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <BookOpen size={16} />
                  )}
                  {enrollMutation.isPending ? 'Enrolling…' : 'Enroll & Start Learning'}
                </button>
                {enrollMutation.isError && (
                  <p className="text-xs text-red-600">{(enrollMutation.error as Error).message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Completion screen ──
  if (isCompleted) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Trophy size={36} className="text-emerald-500" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Course Complete!</h1>
            <p className="text-slate-500 text-sm">
              You finished <span className="font-semibold text-slate-800">{effectiveCourse.title}</span>.
            </p>
            <p className="text-sm font-semibold text-emerald-600 mt-1">+{pointsLabel} CPD points earned</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Sections completed</span>
              <span className="font-semibold text-slate-800">{completedSections.length}/{totalSections}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {!reviewSubmitted ? (
            <div className="border border-slate-200 rounded-xl p-5 text-left space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Rate this course</h3>
              <StarRating value={reviewRating} onChange={setReviewRating} />
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience (optional)…"
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void submitReviewMutation.mutate()}
                  disabled={reviewRating === 0 || submitReviewMutation.isPending}
                  className="inline-flex items-center gap-2 bg-primary-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 disabled:opacity-50 text-sm"
                >
                  {submitReviewMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Star size={14} />
                  )}
                  Submit Review
                </button>
                <button
                  onClick={() => setReviewSubmitted(true)}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 text-emerald-700 text-sm font-medium rounded-xl p-4">
              Thank you for your review!
            </div>
          )}

          <Link
            to="/my-learning"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            View My Learning →
          </Link>
        </div>
      </div>
    );
  }

  // ── Main player ──
  const prevSection = activeIndex > 0 ? allSections[activeIndex - 1] : null;
  const nextSection = activeIndex < allSections.length - 1 ? allSections[activeIndex + 1] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Preview mode banner */}
      {isPreviewMode && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-semibold">Preview mode</span>
          <span className="text-amber-600">— learners see this after enrolling. Progress is not tracked.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{effectiveCourse.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="text-xs text-slate-500" title="Council-assigned CPD points (approved by your council)">
              <span className="tabular-nums">{pointsLabel}</span> Council CPD
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-500">{effectiveCourse.estimatedMinutes} min</span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-500">
              {completedSections.length}/{totalSections} sections complete
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right hidden sm:block">
          <div className="text-xs font-semibold text-slate-700 mb-1">{progressPercent}% done</div>
          <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Content area ── */}
        <div className="lg:col-span-8 space-y-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <span>{active?.module.title}</span>
                  <span>·</span>
                  <span className="capitalize">{active?.section.type?.toLowerCase()}</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 leading-snug">
                  {active?.section.title}
                </h2>
              </div>
              {activeSectionDone && (
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold flex-shrink-0 mt-1">
                  <CheckCircle2 size={15} />
                  Completed
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              {active ? (
                <SectionContent
                  section={active.section}
                  activeQuizId={activeQuizId}
                  onQuizPass={
                    active.section.type === 'QUIZ'
                      ? () => void markSectionCompleteMutation.mutate(active.section.id)
                      : undefined
                  }
                />
              ) : (
                <p className="text-sm text-slate-500">No content available.</p>
              )}
            </div>

            {/* Navigation + Mark complete */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={() => prevSection && setActiveSectionId(prevSection.section.id)}
                disabled={!prevSection}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {!isPreviewMode && !activeSectionDone && active?.section.type !== 'QUIZ' && (
                  <button
                    onClick={() => active && void markSectionCompleteMutation.mutate(active.section.id)}
                    disabled={markSectionCompleteMutation.isPending}
                    className="inline-flex items-center gap-2 bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    {markSectionCompleteMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Mark as Complete
                  </button>
                )}
                {nextSection && (
                  <button
                    onClick={() => setActiveSectionId(nextSection.section.id)}
                    className="inline-flex items-center gap-2 bg-primary-500 text-white font-semibold px-4 py-2 rounded-xl hover:bg-primary-600 text-sm"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Course Content</h3>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-slate-400">
                  {completedSections.length} of {totalSections} complete
                </p>
                <span className="text-xs font-semibold text-primary-600">{progressPercent}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {(effectiveCourse.modules ?? []).map((m) => (
                <div key={m.id}>
                  <div className="px-4 py-2.5 bg-slate-50 sticky top-0 z-10 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
                      {m.order}. {m.title}
                    </p>
                    {/* Offline download / remove button — only shown when online */}
                    {isOnline && (
                      offlineModuleIds.has(m.id) ? (
                        <button
                          type="button"
                          title="Remove offline copy"
                          onClick={() => void removeOfflineModule(m.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Download for offline"
                          onClick={() => void downloadModule(m.id)}
                          disabled={downloadingModuleId === m.id}
                          className="text-slate-400 hover:text-primary-600 transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {downloadingModuleId === m.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Download size={13} />
                          )}
                        </button>
                      )
                    )}
                    {!isOnline && offlineModuleIds.has(m.id) && (
                      <span className="text-xs text-emerald-600 font-medium">saved</span>
                    )}
                  </div>
                  {m.sections.map((s) => {
                    const isActive = active?.section.id === s.id;
                    const isDone = isSectionDone(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveSectionId(s.id)}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-2',
                          isActive
                            ? 'bg-primary-50 border-l-primary-500'
                            : 'hover:bg-slate-50 border-l-transparent',
                        )}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {isDone ? (
                            <CheckCircle2 size={15} className="text-emerald-500" />
                          ) : (
                            <div
                              className={clsx(
                                'w-[15px] h-[15px] rounded-full border-2 flex-shrink-0',
                                isActive ? 'border-primary-500' : 'border-slate-300',
                              )}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={clsx(
                              'text-xs font-medium leading-snug',
                              isActive
                                ? 'text-primary-800'
                                : isDone
                                  ? 'text-slate-400'
                                  : 'text-slate-700',
                            )}
                          >
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 capitalize">
                            {s.type.toLowerCase()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
