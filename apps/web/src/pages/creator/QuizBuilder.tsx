import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronLeft,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

type QuestionOption = {
  id?: string;
  text: string;
  isCorrect: boolean;
};

type Question = {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  text: string;
  points: number;
  options: QuestionOption[];
};

type QuizResponse = {
  id: string;
  title: string;
  questions: Question[];
};

type QuestionDraft = {
  id?: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  text: string;
  points: number;
  options: QuestionOption[];
};

const EMPTY_DRAFT: QuestionDraft = {
  type: 'MULTIPLE_CHOICE',
  text: '',
  points: 1,
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
};

function normalizeDraft(draft: QuestionDraft): QuestionDraft {
  if (draft.type === 'TRUE_FALSE') {
    const correctAnswer = draft.options.find((option) => option.isCorrect)?.text === 'False' ? 'False' : 'True';
    return {
      ...draft,
      options: [
        { text: 'True', isCorrect: correctAnswer === 'True' },
        { text: 'False', isCorrect: correctAnswer === 'False' },
      ],
    };
  }

  const options = draft.options.length >= 2 ? draft.options.slice(0, 4) : EMPTY_DRAFT.options;
  return {
    ...draft,
    options,
  };
}

export default function QuizBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [sourceText, setSourceText] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<QuestionDraft[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(EMPTY_DRAFT);

  const { data: quiz, isLoading } = useQuery<QuizResponse>({
    queryKey: ['quiz-builder', id],
    queryFn: () => api.get(`/api/quizzes/${id}`),
    enabled: !!id,
  });

  const addQuestionMutation = useMutation({
    mutationFn: (payload: QuestionDraft) => api.post(`/api/quizzes/${id}/questions`, payload),
    onSuccess: () => {
      toast.success('Question added');
      queryClient.invalidateQueries({ queryKey: ['quiz-builder', id] });
      setQuestionDraft(EMPTY_DRAFT);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (payload: QuestionDraft) => api.patch(`/api/quizzes/${id}/questions/${payload.id}`, payload),
    onSuccess: () => {
      toast.success('Question updated');
      queryClient.invalidateQueries({ queryKey: ['quiz-builder', id] });
      setEditingQuestionId(null);
      setQuestionDraft(EMPTY_DRAFT);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => api.delete(`/api/quizzes/${id}/questions/${questionId}`),
    onSuccess: () => {
      toast.success('Question removed');
      queryClient.invalidateQueries({ queryKey: ['quiz-builder', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateAiQuestionsMutation = useMutation({
    mutationFn: (payload: { sourceText: string; count: number }) =>
      api.post<{ questions: QuestionDraft[] }>(`/api/quizzes/${id}/generate-questions`, payload),
    onSuccess: (response: { questions: QuestionDraft[] }) => {
      setDraftQuestions(response.questions);
      toast.success('Draft questions generated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!editingQuestionId) return;
    const current = quiz?.questions.find((question) => question.id === editingQuestionId);
    if (!current) return;
    setQuestionDraft(normalizeDraft(current));
  }, [editingQuestionId, quiz]);

  const hasValidQuestion = useMemo(() => {
    if (questionDraft.text.trim().length < 8) return false;
    if (questionDraft.points < 1) return false;
    const options = normalizeDraft(questionDraft).options;
    const filledOptions = options.filter((option) => option.text.trim().length > 0);
    const correctOptions = options.filter((option) => option.isCorrect);
    return filledOptions.length >= 2 && correctOptions.length === 1;
  }, [questionDraft]);

  const handleGenerate = () => {
    if (sourceText.trim().length < 50) {
      toast.error('Please provide at least 50 characters of source content.');
      return;
    }

    generateAiQuestionsMutation.mutate({ sourceText, count: 5 });
  };

  const handleSaveQuestion = () => {
    const payload = normalizeDraft(questionDraft);
    if (!hasValidQuestion) {
      toast.error('Add a question, at least two options, and exactly one correct answer.');
      return;
    }

    if (editingQuestionId) {
      updateQuestionMutation.mutate({ ...payload, id: editingQuestionId });
    } else {
      addQuestionMutation.mutate(payload);
    }
  };

  const handleEditExisting = (question: Question) => {
    setEditingQuestionId(question.id);
    setQuestionDraft(normalizeDraft(question));
  };

  const handleUseDraft = (index: number) => {
    const nextDraft = draftQuestions[index];
    setEditingQuestionId(null);
    setQuestionDraft(normalizeDraft(nextDraft));
  };

  const activeMutating = addQuestionMutation.isPending || updateQuestionMutation.isPending;

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-96 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{quiz?.title ?? 'Quiz Builder'}</h1>
            <p className="text-sm text-slate-500 mt-1">Author questions manually, refine AI drafts, and keep the assessment tied to your course content.</p>
          </div>
        </div>

        <button
          onClick={() => setIsAiPanelOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <Sparkles size={16} />
          {isAiPanelOpen ? 'Hide AI Assistant' : 'Show AI Assistant'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] gap-6">
        <section className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Questions</h2>
                <p className="text-sm text-slate-500 mt-1">{quiz?.questions.length ?? 0} question(s) currently in this quiz.</p>
              </div>
              <Badge variant="info">{quiz?.questions.length ?? 0} total</Badge>
            </div>

            {quiz?.questions.length ? (
              <div className="divide-y divide-slate-100">
                {quiz.questions.map((question, index) => (
                  <div key={question.id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Question {index + 1}</Badge>
                          <Badge variant="info">{question.type === 'TRUE_FALSE' ? 'True / False' : 'Multiple Choice'}</Badge>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-3">{question.text}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          {question.options.map((option, optionIndex) => (
                            <div
                              key={option.id ?? `${question.id}-${optionIndex}`}
                              className={clsx(
                                'rounded-xl border px-3 py-2.5 text-sm',
                                option.isCorrect
                                  ? 'border-green-200 bg-green-50 text-green-700'
                                  : 'border-slate-200 bg-white text-slate-600',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {option.isCorrect ? <CheckCircle2 size={14} /> : <span className="text-xs font-medium">{String.fromCharCode(65 + optionIndex)}</span>}
                                <span>{option.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditExisting(question)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteQuestionMutation.mutate(question.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<HelpCircle size={28} />}
                title="No questions yet"
                description="Use the editor to add your first question or generate drafts from course material."
              />
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingQuestionId ? 'Edit Question' : 'Add Question'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Manual editing is the source of truth before anything is saved to the quiz.</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Question text</label>
                  <textarea
                    value={questionDraft.text}
                    onChange={(event) => setQuestionDraft((current) => ({ ...current, text: event.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    placeholder="Write the assessment prompt here"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Question type</label>
                    <select
                      value={questionDraft.type}
                      onChange={(event) =>
                        setQuestionDraft((current) =>
                          normalizeDraft({ ...current, type: event.target.value as QuestionDraft['type'] }),
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    >
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Points</label>
                    <input
                      type="number"
                      min={1}
                      value={questionDraft.points}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({ ...current, points: Number(event.target.value) || 1 }))
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Answer options</h3>
                  <p className="text-xs text-slate-500">Mark exactly one correct answer.</p>
                </div>

                {normalizeDraft(questionDraft).options.map((option, index) => (
                  <div key={`${index}-${option.text}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <button
                      onClick={() =>
                        setQuestionDraft((current) => ({
                          ...current,
                          options: normalizeDraft(current).options.map((entry, optionIndex) => ({
                            ...entry,
                            isCorrect: optionIndex === index,
                          })),
                        }))
                      }
                      className={clsx(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
                        option.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-slate-300 text-slate-500',
                      )}
                    >
                      {option.isCorrect ? '✓' : String.fromCharCode(65 + index)}
                    </button>
                    <input
                      value={option.text}
                      onChange={(event) =>
                        setQuestionDraft((current) => {
                          const next = normalizeDraft(current).options.map((entry, optionIndex) =>
                            optionIndex === index ? { ...entry, text: event.target.value } : entry,
                          );
                          return { ...current, options: next };
                        })
                      }
                      disabled={questionDraft.type === 'TRUE_FALSE'}
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50"
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                {(editingQuestionId || questionDraft.text || draftQuestions.length > 0) ? (
                  <button
                    onClick={() => {
                      setEditingQuestionId(null);
                      setQuestionDraft(EMPTY_DRAFT);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  onClick={handleSaveQuestion}
                  disabled={activeMutating}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {activeMutating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {editingQuestionId ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className={clsx('space-y-6', !isAiPanelOpen && 'opacity-60')}>
          <div className="bg-white border border-violet-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-violet-100 bg-violet-50">
              <h2 className="text-base font-semibold text-violet-900">AI Question Generator</h2>
              <p className="text-sm text-violet-800/80 mt-1">Generate drafts from guidelines, lesson notes, or reading content.</p>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                rows={8}
                placeholder="Paste at least 50 characters of course material..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
              <button
                onClick={handleGenerate}
                disabled={generateAiQuestionsMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {generateAiQuestionsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Generate 5 Draft Questions
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Drafts for Review</h2>
              <p className="text-sm text-slate-500 mt-1">Send a draft into the editor before saving it to the quiz.</p>
            </div>

            {draftQuestions.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={28} />}
                title="No AI drafts yet"
                description="Generate questions from source text and they will appear here for review."
              />
            ) : (
              <div className="p-4 space-y-4">
                {draftQuestions.map((draft, index) => (
                  <div key={`${draft.text}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-900">{draft.text}</p>
                    <div className="space-y-2">
                      {draft.options.map((option, optionIndex) => (
                        <div
                          key={`${option.text}-${optionIndex}`}
                          className={clsx(
                            'rounded-lg px-3 py-2 text-xs',
                            option.isCorrect ? 'bg-green-100 text-green-700' : 'bg-white text-slate-600 border border-slate-200',
                          )}
                        >
                          {option.text}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUseDraft(index)}
                        className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        Edit Draft
                      </button>
                      <button
                        onClick={() => setDraftQuestions((current) => current.filter((_, draftIndex) => draftIndex !== index))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Need course context?</h3>
            <p className="text-sm text-slate-500 mt-1">Return to the creator portal to refine the linked section or module.</p>
            <Link to="/creator" className="inline-flex items-center gap-2 text-primary-600 hover:underline mt-3 text-sm font-medium">
              Back to Creator Portal
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
