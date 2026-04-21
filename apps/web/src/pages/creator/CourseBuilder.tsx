import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FileText,
  HelpCircle,
  Image,
  Layout,
  Loader2,
  Play,
  Plus,
  Save,
  Send,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CPDCategory, ContentType, Difficulty, Language } from '@nursepro/types';
import clsx from 'clsx';

const TARGET_CADRES = ['NURSE', 'MIDWIFE', 'PHARMACIST', 'CLINICAL_OFFICER', 'LAB_TECH'] as const;

const courseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  subtitle: z.string().max(200).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.nativeEnum(CPDCategory),
  difficulty: z.nativeEnum(Difficulty),
  language: z.nativeEnum(Language),
  cpdPoints: z.number().int().min(1).max(50),
  estimatedMinutes: z.number().int().min(5),
  targetCadres: z.array(z.string()).min(1, 'Select at least one cadre'),
  tags: z.array(z.string()).default([]),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  specialtyArea: z.string().max(100).optional(),
  accreditationBody: z.string().max(200).optional(),
});

type CourseFormData = z.infer<typeof courseSchema>;

type Section = {
  id: string;
  title: string;
  type: ContentType;
  order: number;
  content: string;
  mediaUrl?: string | null;
};

type QuizRow = {
  id: string;
  title: string;
  moduleId: string | null;
};

type Module = {
  id: string;
  title: string;
  order: number;
  sections: Section[];
  quizzes?: QuizRow[];
};

type CourseResponse = CourseFormData & {
  id: string;
  status: string;
  modules: Module[];
};

type SectionDraft = {
  title: string;
  type: ContentType;
  content: string;
  mediaUrl: string;
};

const DEFAULT_VALUES: CourseFormData = {
  title: '',
  subtitle: '',
  description: '',
  category: CPDCategory.CLINICAL,
  difficulty: Difficulty.FOUNDATION,
  language: Language.ENGLISH,
  cpdPoints: 1,
  estimatedMinutes: 30,
  targetCadres: [],
  tags: [],
  thumbnailUrl: '',
  specialtyArea: '',
  accreditationBody: '',
};

const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: ContentType.READING, label: 'Reading' },
  { value: ContentType.VIDEO, label: 'Video' },
  { value: ContentType.QUIZ, label: 'Quiz' },
  { value: ContentType.AUDIO, label: 'Audio' },
  { value: ContentType.INTERACTIVE, label: 'Interactive' },
];

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sectionIcon(type: ContentType) {
  if (type === ContentType.VIDEO) return <Video size={14} />;
  if (type === ContentType.QUIZ) return <HelpCircle size={14} />;
  return <FileText size={14} />;
}

function mediaUploadAccept(sectionType: ContentType): string {
  if (sectionType === ContentType.VIDEO) return 'video/*';
  if (sectionType === ContentType.AUDIO) return 'audio/*';
  return 'video/*,audio/*,application/pdf,.pdf,.zip,.html';
}

export default function CourseBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';
  const token = useAuthStore((s) => s.accessToken);
  const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') as string;
  const mediaFileRef = useRef<HTMLInputElement>(null);

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState<SectionDraft | null>(null);
  const [rightPanel, setRightPanel] = useState<'content' | 'settings'>('settings');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const thumbnailFileRef = useRef<HTMLInputElement>(null);
  const [tagInputValue, setTagInputValue] = useState('');

  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const watchedValues = watch();

  const { data: course, isLoading } = useQuery<CourseResponse>({
    queryKey: ['course-builder', id],
    queryFn: () => api.get(`/api/courses/${id}`),
    enabled: !!id && !isNew,
  });

  const { data: courseQuizzesPayload } = useQuery<{ quizzes: QuizRow[] }>({
    queryKey: ['course-quizzes', id],
    queryFn: () => api.get(`/api/courses/${id}/quizzes`),
    enabled: !!id && !isNew,
  });

  const courseQuizOptions = courseQuizzesPayload?.quizzes ?? [];

  useEffect(() => {
    if (!course) return;
    reset({
      title: course.title,
      subtitle: course.subtitle ?? '',
      description: course.description,
      category: course.category,
      difficulty: course.difficulty,
      language: course.language,
      cpdPoints: course.cpdPoints,
      estimatedMinutes: course.estimatedMinutes,
      targetCadres: course.targetCadres,
      tags: course.tags ?? [],
      thumbnailUrl: course.thumbnailUrl ?? '',
      specialtyArea: course.specialtyArea ?? '',
      accreditationBody: course.accreditationBody ?? '',
    });
  }, [course, reset]);

  const createCourseMutation = useMutation({
    mutationFn: (payload: CourseFormData) => api.post<CourseResponse>('/api/courses', payload),
    onSuccess: (createdCourse) => {
      setLastSaved(new Date());
      setSaveState('saved');
      toast.success('Draft course created');
      queryClient.invalidateQueries({ queryKey: ['creator-courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-builder'] });
      navigate(`/creator/courses/${createdCourse.id}/edit`, { replace: true });
    },
    onError: (error: Error) => {
      setSaveState('idle');
      toast.error(error.message);
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: (payload: Partial<CourseFormData>) => api.patch<CourseResponse>(`/api/courses/${id}`, payload),
    onSuccess: () => {
      setLastSaved(new Date());
      setSaveState('saved');
      queryClient.invalidateQueries({ queryKey: ['creator-courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
    },
    onError: (error: Error) => {
      setSaveState('idle');
      toast.error(error.message);
    },
  });

  const createModuleMutation = useMutation({
    mutationFn: (payload: { title: string; order: number }) => api.post(`/api/courses/${id}/modules`, payload),
    onSuccess: () => {
      setNewModuleTitle('');
      toast.success('Module added');
      queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createSectionMutation = useMutation({
    mutationFn: (payload: { moduleId: string; type: ContentType; order: number }) =>
      api.post(`/api/courses/${id}/modules/${payload.moduleId}/sections`, {
        type: payload.type,
        title: `${formatLabel(payload.type)} section`,
        order: payload.order,
        content: '',
      }),
    onSuccess: (createdSection: any) => {
      toast.success('Section added');
      queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
      if (createdSection?.id) {
        setSelectedSectionId(createdSection.id);
        setRightPanel('content');
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateSectionMutation = useMutation({
    mutationFn: (payload: { moduleId: string; sectionId: string; data: Partial<SectionDraft> }) =>
      api.patch(`/api/courses/${id}/modules/${payload.moduleId}/sections/${payload.sectionId}`, payload.data),
    onSuccess: () => {
      setLastSaved(new Date());
      toast.success('Section updated');
      queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitForReviewMutation = useMutation({
    mutationFn: () => api.post(`/api/courses/${id}/submit-review`),
    onSuccess: () => {
      toast.success('Course submitted for review');
      queryClient.invalidateQueries({ queryKey: ['creator-courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-builder', id] });
      navigate('/creator');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ── AI content generation state ──
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiGuidelineText, setAiGuidelineText] = useState('');
  const [aiTargetCadre, setAiTargetCadre] = useState('Registered General Nurse');

  const aiGenerateMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string; moduleIds: string[]; preview: { moduleCount: number } }>(
        `/api/courses/${id}/ai-generate-content`,
        { guidelineText: aiGuidelineText, targetCadre: aiTargetCadre },
      ),
    onSuccess: (data) => {
      toast.success(`AI generated ${data.preview.moduleCount} module(s). Check the curriculum panel.`);
      setShowAiPanel(false);
      setAiGuidelineText('');
      void queryClient.invalidateQueries({ queryKey: ['course', id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createQuizMutation = useMutation({
    mutationFn: (payload: { moduleId: string; title: string }) =>
      api.post<QuizRow>('/api/quizzes', {
        courseId: id,
        moduleId: payload.moduleId,
        title: payload.title,
        passMark: 0.8,
        attemptLimit: 3,
        randomiseQuestions: false,
        showAnswersAfter: true,
      }),
    onSuccess: async (quiz, variables) => {
      if (!activeSection) return;
      await updateSectionMutation.mutateAsync({
        moduleId: variables.moduleId,
        sectionId: activeSection.id,
        data: { content: quiz.id },
      });
      queryClient.invalidateQueries({ queryKey: ['course-quizzes', id] });
      toast.success('Quiz created and linked. Open Quiz Builder when you are ready to add questions.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!isDirty || !isValid) return;
    if (createCourseMutation.isPending || updateCourseMutation.isPending) return;

    const timeout = window.setTimeout(() => {
      setSaveState('saving');
      if (isNew) {
        createCourseMutation.mutate(watchedValues);
      } else {
        updateCourseMutation.mutate(watchedValues);
      }
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [
    createCourseMutation,
    isDirty,
    isNew,
    isValid,
    updateCourseMutation,
    watchedValues,
  ]);

  const modules = course?.modules ?? [];

  useEffect(() => {
    if (!modules.length) {
      setSelectedSectionId(null);
      return;
    }

    const allSections = modules.flatMap((module) => module.sections);
    if (!allSections.length) {
      setSelectedSectionId(null);
      return;
    }

    if (!selectedSectionId || !allSections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(allSections[0].id);
    }
  }, [modules, selectedSectionId]);

  const activeSelection = useMemo(() => {
    for (const module of modules) {
      const section = module.sections.find((item) => item.id === selectedSectionId);
      if (section) return { module, section };
    }
    return null;
  }, [modules, selectedSectionId]);

  const activeModule = activeSelection?.module ?? null;
  const activeSection = activeSelection?.section ?? null;

  useEffect(() => {
    if (!activeSection) {
      setSectionDraft(null);
      return;
    }

    setSectionDraft({
      title: activeSection.title,
      type: activeSection.type,
      content: activeSection.content ?? '',
      mediaUrl: activeSection.mediaUrl ?? '',
    });
    setRightPanel('content');
  }, [activeSection]);

  const linkedQuiz = useMemo(() => {
    if (!activeSection || activeSection.type !== ContentType.QUIZ) return null;
    const raw = activeSection.content?.trim();
    if (!raw) return null;
    const fromCourse = courseQuizOptions.find((q) => q.id === raw);
    const fromModule = activeModule?.quizzes?.find((q) => q.id === raw);
    return fromCourse ?? fromModule ?? ({ id: raw, title: 'Linked quiz', moduleId: activeModule?.id ?? null } satisfies QuizRow);
  }, [activeModule, activeSection, courseQuizOptions]);

  const handleManualSave = handleSubmit((values) => {
    setSaveState('saving');
    if (isNew) {
      createCourseMutation.mutate(values);
    } else {
      updateCourseMutation.mutate(values);
    }
  });

  const handleAddModule = () => {
    if (!id || isNew) {
      toast.info('Finish the course basics first so we can create the draft.');
      return;
    }

    const title = newModuleTitle.trim();
    if (!title) {
      toast.error('Enter a module title first');
      return;
    }

    createModuleMutation.mutate({
      title,
      order: modules.length + 1,
    });
  };

  const handleAddSection = (moduleId: string, type: ContentType, sectionCount: number) => {
    if (!id || isNew) {
      toast.info('Create the course draft before adding sections.');
      return;
    }

    createSectionMutation.mutate({
      moduleId,
      type,
      order: sectionCount + 1,
    });
  };

  const handleSectionSave = async () => {
    if (!activeSection || !activeModule || !sectionDraft) return;
    if (sectionDraft.title.trim().length < 2) {
      toast.error('Section title must be at least 2 characters');
      return;
    }

    await updateSectionMutation.mutateAsync({
      moduleId: activeModule.id,
      sectionId: activeSection.id,
      data: {
        title: sectionDraft.title.trim(),
        type: sectionDraft.type,
        content: sectionDraft.content,
        mediaUrl: sectionDraft.mediaUrl || undefined,
      },
    });
  };

  const handleSectionMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !token || !sectionDraft) return;
    const endpoint =
      sectionDraft.type === ContentType.VIDEO ? '/api/media/video' : '/api/media/document';
    setMediaUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          typeof body.error === 'string' ? body.error : `Upload failed (${res.status})`;
        throw new Error(msg);
      }
      const json = (await res.json()) as { url?: string; originalUrl?: string };
      const url =
        sectionDraft.type === ContentType.VIDEO
          ? json.originalUrl ?? json.url
          : json.url ?? json.originalUrl;
      if (!url) throw new Error('Upload response missing URL');
      setSectionDraft((current) => (current ? { ...current, mediaUrl: url } : current));
      toast.success('Uploaded. Save the section to persist the media URL.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleThumbnailUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !token) return;
    setThumbnailUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'thumbnails');
      const res = await fetch(`${baseUrl}/api/media/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === 'string' ? body.error : `Upload failed (${res.status})`);
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error('Upload response missing URL');
      setValue('thumbnailUrl', json.url, { shouldDirty: true, shouldValidate: true });
      toast.success('Thumbnail uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setThumbnailUploading(false);
    }
  };

  const handleAddTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    const current = watchedValues.tags ?? [];
    if (!current.includes(tag)) {
      setValue('tags', [...current, tag], { shouldDirty: true, shouldValidate: true });
    }
    setTagInputValue('');
  };

  const handleRemoveTag = (tag: string) => {
    setValue('tags', (watchedValues.tags ?? []).filter((t) => t !== tag), { shouldDirty: true });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/creator')}
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="m-0 min-w-0 flex-1 text-2xl font-bold text-slate-900 leading-tight">
                <label htmlFor="course-builder-title" className="sr-only">
                  Course title
                </label>
                <input
                  id="course-builder-title"
                  value={watchedValues.title}
                  onChange={(e) => setValue('title', e.target.value, { shouldDirty: true, shouldValidate: true })}
                  placeholder="Name your course…"
                  className={clsx(
                    'w-full bg-transparent rounded-lg px-2 py-1 -mx-2 font-bold text-inherit placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary-100',
                    errors.title ? 'ring-2 ring-red-100' : 'hover:bg-slate-50',
                  )}
                />
              </h1>
              <Badge variant={course?.status === 'UNDER_REVIEW' ? 'warning' : course?.status === 'PUBLISHED' ? 'success' : 'default'}>
                {formatLabel(course?.status ?? 'DRAFT')}
              </Badge>
            </div>
            {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title.message}</p> : null}
            <p className="text-sm text-slate-500 mt-1">
              Build the curriculum, tune the learning experience, and submit when the draft is ready.
            </p>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
              {saveState === 'saving' ? (
                <>
                  <Loader2 size={12} className="animate-spin text-primary-500" />
                  Saving changes...
                </>
              ) : saveState === 'saved' && lastSaved ? (
                <>
                  <CheckCircle2 size={12} className="text-green-500" />
                  Saved {lastSaved.toLocaleTimeString()}
                </>
              ) : (
                <>
                  <Save size={12} className="text-slate-400" />
                  {isDirty ? 'Unsaved changes' : 'Ready'}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => course?.id && window.open(`/courses/${course.id}`, '_blank', 'noopener,noreferrer')}
            disabled={!course?.id}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Play size={16} />
            Preview
          </button>
          <button
            onClick={() => void handleManualSave()}
            disabled={createCourseMutation.isPending || updateCourseMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createCourseMutation.isPending || updateCourseMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save now
          </button>
          <button
            onClick={() => submitForReviewMutation.mutate()}
            disabled={!course?.id || submitForReviewMutation.isPending || course?.status !== 'DRAFT'}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
          >
            <Send size={16} />
            Submit for Review
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <aside className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden self-start">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Curriculum</h2>
              <p className="text-xs text-slate-500 mt-1">Modules and learning sections</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="AI Generate from guideline"
                onClick={() => setShowAiPanel((v) => !v)}
                disabled={!course?.id}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
                  showAiPanel
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700',
                )}
              >
                <Wand2 size={13} />
                AI Generate
              </button>
              <Layout size={18} className="text-violet-500" />
            </div>
          </div>

          {/* ── AI Generate panel ── */}
          {showAiPanel && course?.id && (
            <div className="border-b border-slate-100 bg-violet-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-violet-800">Generate from guideline text</p>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Target cadre</label>
                <select
                  value={aiTargetCadre}
                  onChange={(e) => setAiTargetCadre(e.target.value)}
                  className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-400 focus:outline-none"
                >
                  <option>Registered General Nurse</option>
                  <option>Registered Midwife</option>
                  <option>Enrolled Nurse</option>
                  <option>Community Health Nurse</option>
                  <option>Clinical Nurse Specialist</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Paste guideline / protocol text
                </label>
                <textarea
                  value={aiGuidelineText}
                  onChange={(e) => setAiGuidelineText(e.target.value)}
                  rows={6}
                  placeholder="Paste text from an EDLIZ section, MOHCC protocol, or any clinical guideline…"
                  className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-violet-400 focus:outline-none resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{aiGuidelineText.length} chars (min 50)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void aiGenerateMutation.mutate()}
                  disabled={aiGuidelineText.trim().length < 50 || aiGenerateMutation.isPending}
                  className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-violet-700 disabled:opacity-50"
                >
                  {aiGenerateMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Wand2 size={13} />
                  )}
                  {aiGenerateMutation.isPending ? 'Generating…' : 'Generate Modules'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiPanel(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
              {aiGenerateMutation.isError && (
                <p className="text-xs text-red-600">{(aiGenerateMutation.error as Error).message}</p>
              )}
            </div>
          )}

          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">New module</label>
              <input
                value={newModuleTitle}
                onChange={(event) => setNewModuleTitle(event.target.value)}
                placeholder="e.g. Module 1: Assessment"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
              <button
                onClick={handleAddModule}
                disabled={createModuleMutation.isPending || !course?.id}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-primary-600 hover:border-primary-500 hover:bg-primary-50 disabled:opacity-50"
              >
                {createModuleMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add Module
              </button>
            </div>

            {modules.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50">
                <EmptyState
                  icon={<BookOpen size={28} />}
                  title="No modules yet"
                  description="Create the draft, then add your first module to start building the course flow."
                />
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((module) => (
                  <div key={module.id} className="rounded-xl border border-slate-200 p-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Module {module.order}</p>
                      <h3 className="text-sm font-semibold text-slate-900 mt-1">{module.title}</h3>
                    </div>

                    <div className="space-y-2">
                      {module.sections.length === 0 ? (
                        <p className="text-xs text-slate-500">No sections yet.</p>
                      ) : (
                        module.sections.map((section) => {
                          const isSelected = selectedSectionId === section.id;
                          return (
                            <button
                              key={section.id}
                              onClick={() => setSelectedSectionId(section.id)}
                              className={clsx(
                                'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                                isSelected
                                  ? 'border-violet-500 bg-violet-50 text-violet-900'
                                  : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {sectionIcon(section.type)}
                                <span className="font-medium">{section.title}</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{formatLabel(section.type)}</div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleAddSection(module.id, ContentType.READING, module.sections.length)}
                        className="rounded-lg bg-slate-100 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Reading
                      </button>
                      <button
                        onClick={() => handleAddSection(module.id, ContentType.VIDEO, module.sections.length)}
                        className="rounded-lg bg-slate-100 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Video
                      </button>
                      <button
                        onClick={() => handleAddSection(module.id, ContentType.QUIZ, module.sections.length)}
                        className="rounded-lg bg-slate-100 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Quiz
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRightPanel('content')}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-semibold border',
                rightPanel === 'content'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
              )}
            >
              Section Editor
            </button>
            <button
              type="button"
              onClick={() => setRightPanel('settings')}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-semibold border',
                rightPanel === 'settings'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
              )}
            >
              Course Settings
            </button>
          </div>

          {rightPanel === 'content' ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Section Editor</h2>
                <p className="text-sm text-slate-500 mt-1">Select a section from the curriculum to edit its content.</p>
              </div>

              <div className="p-6">
                {!activeSection || !activeModule || !sectionDraft ? (
                  <EmptyState
                    icon={<Layout size={28} />}
                    title="Select a section"
                    description="Pick a section from the left panel, or add a module and content block to begin."
                  />
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">Module {activeModule.order}</Badge>
                      <Badge variant="info">{formatLabel(sectionDraft.type)}</Badge>
                      <span className="text-xs text-slate-500">{activeModule.title}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Section title</label>
                        <input
                          value={sectionDraft.title}
                          onChange={(event) =>
                            setSectionDraft((current) => (current ? { ...current, title: event.target.value } : current))
                          }
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Content type</label>
                        <select
                          value={sectionDraft.type}
                          onChange={(event) =>
                            setSectionDraft((current) =>
                              current ? { ...current, type: event.target.value as ContentType } : current,
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        >
                          {CONTENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(sectionDraft.type === ContentType.VIDEO ||
                      sectionDraft.type === ContentType.AUDIO ||
                      sectionDraft.type === ContentType.INTERACTIVE) ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Media URL</label>
                        <input
                          value={sectionDraft.mediaUrl}
                          onChange={(event) =>
                            setSectionDraft((current) => (current ? { ...current, mediaUrl: event.target.value } : current))
                          }
                          placeholder="https://..."
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                        <input
                          ref={mediaFileRef}
                          type="file"
                          accept={mediaUploadAccept(sectionDraft.type)}
                          className="hidden"
                          onChange={(e) => void handleSectionMediaUpload(e)}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => mediaFileRef.current?.click()}
                            disabled={mediaUploading || !token}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {mediaUploading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Upload size={16} />
                            )}
                            Upload file
                          </button>
                          <span className="text-xs text-slate-500">
                            {sectionDraft.type === ContentType.VIDEO
                              ? 'Videos are uploaded then transcoded when processing is enabled.'
                              : sectionDraft.type === ContentType.AUDIO
                                ? 'Upload audio (MP3, AAC, etc.) via the document pipeline.'
                                : 'Upload PDFs, packages, or other lesson assets.'}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {sectionDraft.type === ContentType.QUIZ ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-4">
                        <div className="flex items-center gap-2 text-violet-900">
                          <Wand2 size={16} />
                          <p className="text-sm font-semibold">Quiz section</p>
                        </div>
                        <p className="text-sm text-slate-600">
                          Link an existing quiz for this course or create a new one, then save the section. The section&apos;s
                          content field stores the quiz id.
                        </p>
                        <div>
                          <label className="block text-sm font-semibold text-slate-900 mb-1.5">Link existing quiz</label>
                          <select
                            value={sectionDraft.content}
                            onChange={(event) =>
                              setSectionDraft((current) =>
                                current ? { ...current, content: event.target.value } : current,
                              )
                            }
                            className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                          >
                            <option value="">Select a quiz…</option>
                            {courseQuizOptions.map((quiz) => (
                              <option key={quiz.id} value={quiz.id}>
                                {quiz.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              createQuizMutation.mutate({
                                moduleId: activeModule.id,
                                title: `${activeModule.title} Quiz`,
                              })
                            }
                            disabled={createQuizMutation.isPending}
                            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                          >
                            {createQuizMutation.isPending ? 'Creating quiz…' : 'Create new quiz'}
                          </button>
                          {linkedQuiz ? (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate(`/creator/quizzes/${linkedQuiz.id}`)}
                                className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100"
                              >
                                Open Quiz Builder
                              </button>
                              <span className="text-xs text-violet-800">
                                Linked: <span className="font-mono">{linkedQuiz.id}</span> · {linkedQuiz.title}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-violet-800">No quiz linked yet.</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                          {sectionDraft.type === ContentType.READING ? 'Reading content' : 'Section content'}
                        </label>
                        {sectionDraft.type === ContentType.READING ? (
                          <ReadingContentEditor
                            value={sectionDraft.content}
                            onChange={(value) =>
                              setSectionDraft((current) => (current ? { ...current, content: value } : current))
                            }
                          />
                        ) : (
                          <textarea
                            value={sectionDraft.content}
                            onChange={(event) =>
                              setSectionDraft((current) =>
                                current ? { ...current, content: event.target.value } : current,
                              )
                            }
                            rows={6}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                            placeholder="Add supporting text or embed references for this section."
                          />
                        )}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => void handleSectionSave()}
                        disabled={updateSectionMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {updateSectionMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Section
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {rightPanel === 'settings' ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Course Settings</h2>
              <p className="text-sm text-slate-500 mt-1">Metadata used across the learner and admin experience.</p>
            </div>

            <form onSubmit={handleManualSave} className="p-6 space-y-6">

              {/* Thumbnail */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Course Thumbnail</label>
                <div className="flex items-start gap-4">
                  <div className="w-32 h-20 rounded-xl border border-slate-200 overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary-50 to-slate-100 flex items-center justify-center">
                    {watchedValues.thumbnailUrl ? (
                      <img src={watchedValues.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <Image size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={thumbnailFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => void handleThumbnailUpload(e)}
                    />
                    <button
                      type="button"
                      onClick={() => thumbnailFileRef.current?.click()}
                      disabled={thumbnailUploading}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {thumbnailUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {watchedValues.thumbnailUrl ? 'Replace thumbnail' : 'Upload thumbnail'}
                    </button>
                    {watchedValues.thumbnailUrl ? (
                      <button
                        type="button"
                        onClick={() => setValue('thumbnailUrl', '', { shouldDirty: true })}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 transition-colors"
                      >
                        <X size={12} /> Remove
                      </button>
                    ) : null}
                    <p className="text-xs text-slate-400">JPEG, PNG or WebP · 16:9 recommended · max 5 MB</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Title</label>
                  <input
                    {...register('title')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="Enter the course title"
                  />
                  {errors.title ? <p className="mt-1 text-xs text-red-500">{errors.title.message}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Subtitle</label>
                  <input
                    {...register('subtitle')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="A concise summary of what learners will gain"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Description</label>
                  <CourseDescriptionEditor
                    value={watchedValues.description}
                    onChange={(value) => setValue('description', value, { shouldDirty: true, shouldValidate: true })}
                  />
                  {errors.description ? <p className="mt-1 text-xs text-red-500">{errors.description.message}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Category</label>
                  <select
                    {...register('category')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    {Object.values(CPDCategory).map((value) => (
                      <option key={value} value={value}>{formatLabel(value)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Specialty Area <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    {...register('specialtyArea')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="e.g. ICU, Paediatrics, Maternal Health"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Difficulty</label>
                  <select
                    {...register('difficulty')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    {Object.values(Difficulty).map((value) => (
                      <option key={value} value={value}>{formatLabel(value)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Language</label>
                  <select
                    {...register('language')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    {Object.values(Language).map((value) => (
                      <option key={value} value={value}>{formatLabel(value)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">CPD Points</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    {...register('cpdPoints', { valueAsNumber: true })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Estimated Duration (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    {...register('estimatedMinutes', { valueAsNumber: true })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Accreditation Body <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input
                    {...register('accreditationBody')}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="e.g. NCZ, MCAZ, Ministry of Health"
                  />
                  <p className="mt-1 text-xs text-slate-400">The body that has accredited this course for CPD purposes.</p>
                </div>
              </div>

              {/* Tags — chip input */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-slate-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 bg-white min-h-[48px]">
                  {(watchedValues.tags ?? []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-primary-500 hover:text-primary-800">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        handleAddTag(tagInputValue);
                      } else if (e.key === 'Backspace' && !tagInputValue && (watchedValues.tags ?? []).length > 0) {
                        const tags = watchedValues.tags ?? [];
                        handleRemoveTag(tags[tags.length - 1]);
                      }
                    }}
                    onBlur={() => { if (tagInputValue.trim()) handleAddTag(tagInputValue); }}
                    className="flex-1 min-w-[120px] text-sm text-slate-900 outline-none bg-transparent"
                    placeholder={(watchedValues.tags ?? []).length === 0 ? 'Type a tag and press Enter…' : 'Add another tag…'}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">Press Enter or comma to add each tag. Tags help learners discover this course.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Target Cadres <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {TARGET_CADRES.map((cadre) => {
                    const active = watchedValues.targetCadres.includes(cadre);
                    return (
                      <button
                        key={cadre}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? watchedValues.targetCadres.filter((value) => value !== cadre)
                            : [...watchedValues.targetCadres, cadre];
                          setValue('targetCadres', next, { shouldDirty: true, shouldValidate: true });
                        }}
                        className={clsx(
                          'rounded-full px-3 py-1.5 text-sm font-medium border transition-colors',
                          active
                            ? 'bg-primary-100 text-primary-700 border-primary-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {active ? <span className="mr-1">✓</span> : null}
                        {formatLabel(cadre)}
                      </button>
                    );
                  })}
                </div>
                {errors.targetCadres ? <p className="mt-1 text-xs text-red-500">{errors.targetCadres.message}</p> : null}
              </div>
            </form>
          </div>
          ) : null}

        </section>
      </div>
    </div>
  );
}

function ReadingContentEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', false);
  }, [editor, value]);

  return (
    <div className="rounded-xl border border-slate-300 overflow-hidden focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
      <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-[260px] px-4 py-3 text-slate-900" />
    </div>
  );
}

function CourseDescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', false);
  }, [editor, value]);

  return (
    <div className="rounded-xl border border-slate-300 overflow-hidden focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
      <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-[180px] px-4 py-3 text-slate-900" />
    </div>
  );
}
