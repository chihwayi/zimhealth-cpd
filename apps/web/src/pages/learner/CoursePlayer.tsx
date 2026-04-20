import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';

type ContentSection = {
  id: string;
  type: 'VIDEO' | 'READING' | 'AUDIO' | 'INTERACTIVE' | 'QUIZ';
  title: string;
  order: number;
  content: string;
  mediaUrl?: string | null;
};

type Module = {
  id: string;
  title: string;
  order: number;
  isOfflineReady: boolean;
  sections: ContentSection[];
};

type CourseDetail = {
  id: string;
  title: string;
  description: string;
  modules: Module[];
};

type Enrollment = {
  id: string;
  progress: number;
};

export default function CoursePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const { data: course, isLoading } = useQuery<CourseDetail>({
    queryKey: ['course', id],
    queryFn: () => api.get(`/api/courses/${id}`),
    enabled: !!id,
  });

  const allSections = useMemo(() => {
    const modules = course?.modules ?? [];
    return modules.flatMap((m) => m.sections.map((s) => ({ module: m, section: s })));
  }, [course]);

  const active = useMemo(() => {
    if (!allSections.length) return null;
    const sectionId = activeSectionId ?? allSections[0].section.id;
    return allSections.find((x) => x.section.id === sectionId) ?? allSections[0];
  }, [allSections, activeSectionId]);

  useEffect(() => {
    if (!activeSectionId && allSections.length) {
      setActiveSectionId(allSections[0].section.id);
    }
  }, [activeSectionId, allSections]);

  const enrollMutation = useMutation({
    mutationFn: async () => api.post<Enrollment>(`/api/courses/${id}/enroll`),
    onSuccess: (res) => setEnrollment(res),
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error('Not enrolled');
      return api.patch(`/api/enrollments/${enrollment.id}/progress`, { progress: 1 });
    },
    onSuccess: () => setEnrollment((e) => (e ? { ...e, progress: 1 } : e)),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 w-2/3 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-sm text-slate-600">Course not found.</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{course.title}</h1>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{course.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => enrollMutation.mutate()}
            disabled={enrollMutation.isPending || !!enrollment}
            className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-40"
          >
            {enrollment ? 'Enrolled' : enrollMutation.isPending ? 'Enrolling…' : 'Enroll'}
          </button>
          <button
            onClick={() => markCompleteMutation.mutate()}
            disabled={!enrollment || markCompleteMutation.isPending}
            className="bg-white text-slate-700 border border-slate-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            {markCompleteMutation.isPending ? 'Saving…' : 'Mark as Complete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main content */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          {active ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{active.section.title}</h2>
              <div className="mt-4">
                {active.section.type === 'VIDEO' && active.section.mediaUrl ? (
                  <video controls className="w-full rounded-lg" src={active.section.mediaUrl} />
                ) : null}

                {active.section.type === 'AUDIO' && active.section.mediaUrl ? (
                  <audio controls className="w-full" src={active.section.mediaUrl} />
                ) : null}

                {active.section.type === 'READING' ? (
                  <div
                    className="prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ __html: active.section.content ?? '' }}
                  />
                ) : null}

                {active.section.type === 'INTERACTIVE' ? (
                  <div className="text-sm text-slate-600">
                    Interactive content: {active.section.mediaUrl ? (
                      <a className="text-primary-600 hover:underline" href={active.section.mediaUrl} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    ) : (
                      'No link provided.'
                    )}
                  </div>
                ) : null}

                {active.section.type === 'QUIZ' ? (
                  <div className="text-sm text-slate-600">Quiz section (Sprint 10 implements quiz player).</div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-600">No sections available.</div>
          )}
        </div>

        {/* Progress sidebar */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Modules</h3>
          <div className="space-y-4">
            {(course.modules ?? []).map((m) => (
              <div key={m.id}>
                <div className="text-sm font-medium text-slate-800">
                  {m.order}. {m.title}
                </div>
                <div className="mt-2 space-y-1">
                  {m.sections.map((s) => {
                    const isActive = active?.section.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveSectionId(s.id)}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                          isActive
                            ? 'border-primary-300 bg-primary-50 text-primary-800'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {s.order}. {s.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {enrollment ? (
            <div className="mt-4 text-xs text-slate-500">Progress: {Math.round(enrollment.progress * 100)}%</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

