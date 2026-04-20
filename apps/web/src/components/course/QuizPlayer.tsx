import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ProgressRing } from '../ui/ProgressRing';

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
    onSuccess: (res) => setResult(res),
  });

  const q = quiz?.questions[index];
  const selected = q ? answers[q.id] : undefined;

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
    return <div className="h-40 bg-slate-50 border border-slate-200 rounded-xl animate-pulse" />;
  }

  if (error) {
    return <div className="text-sm text-red-600">{(error as Error).message}</div>;
  }

  if (!quiz) {
    return <div className="text-sm text-slate-600">Quiz not found.</div>;
  }

  if (result) {
    const canRetake = result.attemptsRemaining > 0 && !result.passed;
    return (
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex items-center gap-6">
          <ProgressRing
            value={Math.round(result.score)}
            label={`${Math.round(result.score)}%`}
            sublabel={result.passed ? 'Passed' : 'Not passed'}
            size={120}
            strokeWidth={10}
            color={result.passed ? '#16a34a' : '#ef4444'}
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{result.passed ? 'Great job!' : 'Try again'}</h3>
            <p className="text-sm text-slate-600 mt-1">
              Pass mark: {Math.round(quiz.passMark * 100)}%. Attempts remaining: {result.attemptsRemaining}.
            </p>
            {result.passed ? (
              <div className="inline-flex mt-3 items-center rounded-full bg-green-100 text-green-800 text-xs font-medium px-3 py-1">
                Points earned: {result.pointsEarned}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            {canRetake ? (
              <button
                onClick={onRetake}
                className="bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-50"
              >
                Retake
              </button>
            ) : (
              <button
                disabled
                className="bg-white border border-slate-200 text-slate-500 text-sm font-medium px-4 py-2 rounded-lg opacity-60"
              >
                Retake unavailable
              </button>
            )}
            <button
              onClick={() => setResult(null)}
              className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600"
            >
              Continue
            </button>
          </div>
        </div>

        {quiz.showAnswersAfter && result.feedback.length ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Review</h4>
            {quiz.questions.map((question, i) => {
              const fb = feedbackByQuestion.get(question.id);
              return (
                <div key={question.id} className="border border-slate-200 rounded-xl p-4">
                  <div className="text-sm font-medium text-slate-900">
                    {i + 1}. {question.text}
                  </div>
                  <div className="mt-3 space-y-2">
                    {question.options.map((opt) => {
                      const isSelected = fb?.selectedOptionId === opt.id;
                      const isCorrect = fb?.correctOptionId === opt.id;
                      const base = 'w-full text-left px-3 py-2 rounded-lg border text-sm';
                      const cls = isCorrect
                        ? 'border-green-300 bg-green-50 text-green-900'
                        : isSelected
                          ? 'border-red-300 bg-red-50 text-red-900'
                          : 'border-slate-200 bg-white text-slate-700';
                      return (
                        <div key={opt.id} className={`${base} ${cls}`}>
                          {opt.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (!q) {
    return <div className="text-sm text-slate-600">No questions in this quiz.</div>;
  }

  const total = quiz.questions.length;
  const isLast = index === total - 1;
  const canSubmit = quiz.attemptsRemaining > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">
            Question {index + 1} of {total}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mt-1">{quiz.title}</h3>
        </div>
        <div className="text-xs text-slate-500">Attempts remaining: {quiz.attemptsRemaining}</div>
      </div>

      <div className="border border-slate-200 rounded-xl p-5">
        <div className="text-sm font-medium text-slate-900">{q.text}</div>
        {q.imageUrl ? <img src={q.imageUrl} alt="" className="mt-3 rounded-lg max-h-64" /> : null}
        <div className="mt-4 space-y-2">
          {q.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                selected === opt.id
                  ? 'border-primary-300 bg-primary-50 text-primary-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        {isLast ? (
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-40"
          >
            {submitMutation.isPending ? 'Submitting…' : canSubmit ? 'Submit' : 'Attempt limit reached'}
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            disabled={!selected}
            className="bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-40"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

