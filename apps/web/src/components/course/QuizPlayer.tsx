import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { ProgressRing } from '../ui/ProgressRing';
import { toast } from '../ui/Toast';

type Quiz = {
  id: string;
  title: string;
  passMark: number; // 0..1
  attemptLimit: number;
  attemptsRemaining: number;
  showAnswersAfter: boolean;
  questions: Array<{
    id: string;
    text: string;
    imageUrl?: string | null;
    options: Array<{ id: string; text: string }>;
  }>;
};

type AttemptResult = {
  attemptId: string;
  passed: boolean;
  score: number; // 0..100
  pointsEarned: number;
  correctAnswers: string[];
  feedback: Array<{
    questionId: string;
    selectedOptionId: string | null;
    correctOptionId: string | null;
    isCorrect: boolean;
  }>;
  attemptsRemaining: number;
};

export function QuizPlayer({ quizId }: { quizId: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);

  const { data: quiz, isLoading, error, refetch } = useQuery<Quiz>({
    queryKey: ['quiz', quizId],
    queryFn: () => api.get(`/api/quizzes/${quizId}`),
    enabled: !!quizId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => api.post<AttemptResult>(`/api/quizzes/${quizId}/attempt`, { answers }),
    onSuccess: (res) => {
      setResult(res);
      if (res.passed) {
        toast.success(`Quiz passed! You earned ${res.pointsEarned} CPD point${res.pointsEarned !== 1 ? 's' : ''}.`);
      } else {
        toast.info(`Score: ${Math.round(res.score)}%. Pass mark is ${quiz ? Math.round(quiz.passMark * 100) : '–'}%.`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Could not submit quiz.');
    },
  });

  const feedbackByQuestion = useMemo(() => {
    const map = new Map<string, AttemptResult['feedback'][number]>();
    for (const f of result?.feedback ?? []) map.set(f.questionId, f);
    return map;
  }, [result]);

  const onRetake = async () => {
    setResult(null);
    setAnswers({});
    setIndex(0);
    await refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-3 bg-slate-200 rounded-full w-1/3" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="h-10 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (error) return <div className="text-sm text-red-600 p-3 bg-red-50 rounded-xl">{(error as Error).message}</div>;
  if (!quiz) return <div className="text-sm text-slate-500">Quiz not found.</div>;

  if (result) {
    const canRetake = result.attemptsRemaining > 0 && !result.passed;
    return (
      <div className="space-y-5">
        {/* Result summary card */}
        <div
          className={clsx(
            'rounded-2xl border p-6 flex items-center gap-6',
            result.passed
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200',
          )}
        >
          <ProgressRing
            value={Math.round(result.score)}
            label={`${Math.round(result.score)}%`}
            sublabel={result.passed ? 'Passed ✓' : 'Not passed'}
            size={120}
            strokeWidth={10}
            color={result.passed ? '#16a34a' : '#ef4444'}
          />
          <div className="flex-1 min-w-0">
            <h3 className={clsx('text-lg font-bold', result.passed ? 'text-green-900' : 'text-red-900')}>
              {result.passed ? 'Well done!' : 'Not quite there'}
            </h3>
            <p className="text-sm mt-1 text-slate-600">
              Pass mark: <span className="font-medium">{Math.round(quiz.passMark * 100)}%</span>
              {result.attemptsRemaining > 0
                ? ` · ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? 's' : ''} remaining`
                : ' · No attempts remaining'}
            </p>
            {result.passed && result.pointsEarned > 0 && (
              <div className="inline-flex items-center gap-1.5 mt-3 bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                <CheckCircle2 size={14} />
                +{result.pointsEarned} CPD point{result.pointsEarned !== 1 ? 's' : ''} earned
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {canRetake && (
              <button
                onClick={onRetake}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Retake quiz
              </button>
            )}
            <button
              onClick={() => setResult(null)}
              className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>

        {/* Answer review */}
        {quiz.showAnswersAfter && result.feedback.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Answer Review</h4>
            {quiz.questions.map((question, i) => {
              const fb = feedbackByQuestion.get(question.id);
              const isCorrect = fb?.isCorrect;
              return (
                <div
                  key={question.id}
                  className={clsx(
                    'border rounded-xl p-4',
                    isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium text-slate-900">
                      {i + 1}. {question.text}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2 ml-6">
                    {question.options.map((opt) => {
                      const isSelected = fb?.selectedOptionId === opt.id;
                      const isCorrectOpt = fb?.correctOptionId === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={clsx(
                            'px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2',
                            isCorrectOpt
                              ? 'border-green-300 bg-green-100 text-green-900 font-medium'
                              : isSelected
                              ? 'border-red-300 bg-red-100 text-red-900'
                              : 'border-slate-200 bg-white text-slate-600',
                          )}
                        >
                          <span>{opt.text}</span>
                          {isCorrectOpt && <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />}
                          {isSelected && !isCorrectOpt && <XCircle size={13} className="text-red-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const q = quiz.questions[index];
  if (!q) return <div className="text-sm text-slate-500">No questions in this quiz.</div>;

  const total = quiz.questions.length;
  const isLast = index === total - 1;
  const selected = answers[q.id];
  const answeredCount = Object.keys(answers).length;
  const canSubmit = quiz.attemptsRemaining > 0 && answeredCount === total;

  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">{quiz.title}</h3>
          <span className="text-xs text-slate-500">
            {answeredCount}/{total} answered · {quiz.attemptsRemaining} attempt{quiz.attemptsRemaining !== 1 ? 's' : ''} left
          </span>
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {quiz.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to question ${i + 1}`}
              type="button"
              className={clsx(
                'h-1.5 rounded-full transition-all duration-200',
                i === index
                  ? 'bg-primary-500 w-5'
                  : answers[quiz.questions[i].id]
                  ? 'bg-primary-300 w-1.5'
                  : 'bg-slate-200 w-1.5',
              )}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs text-slate-400 mb-2">Question {index + 1} of {total}</p>
        <p className="text-sm font-medium text-slate-900 leading-relaxed">{q.text}</p>
        {q.imageUrl && (
          <img src={q.imageUrl} alt="" className="mt-3 rounded-xl max-h-64 object-cover" />
        )}

        <div className="mt-4 space-y-2">
          {q.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
              type="button"
              className={clsx(
                'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500',
                selected === opt.id
                  ? 'border-primary-400 bg-primary-50 text-primary-900 font-medium shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700',
              )}
            >
              <span
                className={clsx(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3',
                  selected === opt.id ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {String.fromCharCode(65 + q.options.indexOf(opt))}
              </span>
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} /> Previous
        </button>

        {isLast ? (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send size={14} />
            {submitMutation.isPending
              ? 'Submitting…'
              : quiz.attemptsRemaining === 0
              ? 'Attempt limit reached'
              : answeredCount < total
              ? `Answer all questions (${total - answeredCount} left)`
              : 'Submit Quiz'}
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
          >
            Next <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
