import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as WebBrowser from 'expo-web-browser';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../../lib/api';
import { getOfflineAsset, getOfflineModule, savePendingProgress, savePendingQuizAttempt } from '../../lib/offlineDB';
import { Button } from '../../components/ui/Button';
import type { CoursePlayerScreenProps } from '../../navigation/types';

// ── Quiz types ────────────────────────────────────────────────────────────────

type QuizOption = { id: string; text: string };
type QuizQuestion = {
  id: string;
  text: string;
  type: string;
  points: number;
  options: QuizOption[];
};
type QuizData = {
  id: string;
  title: string;
  passMark: number;
  attemptsRemaining: number;
  timeLimitMinutes: number | null;
  showAnswersAfter: boolean;
  questions: QuizQuestion[];
};
type QuizResult = {
  passed: boolean;
  score: number;
  pointsEarned: number;
  attemptsRemaining: number;
  feedback: Array<{ questionId: string; selectedOptionId: string | null; correctOptionId: string | null; isCorrect: boolean }>;
};

function useCachedUri(remoteUri: string | null | undefined): string | null {
  const { data } = useQuery({
    queryKey: ['offline-asset', remoteUri],
    queryFn: () => (remoteUri ? getOfflineAsset(remoteUri) : Promise.resolve(null)),
    enabled: !!remoteUri,
    staleTime: Infinity,
  });
  return data?.status === 'ready' ? data.localUri : remoteUri ?? null;
}

function CachedVideo({ uri }: { uri: string }) {
  const sourceUri = useCachedUri(uri);
  return (
    <View className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: 16 / 9 }}>
      {sourceUri ? (
        <Video
          source={{ uri: sourceUri }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          style={{ flex: 1 }}
          shouldPlay={false}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="play-circle" size={52} color="white" />
          <Text className="text-white text-xs mt-2 opacity-60">No video URL</Text>
        </View>
      )}
    </View>
  );
}

function CachedDocument({ uri }: { uri: string }) {
  const sourceUri = useCachedUri(uri);
  return (
    <View className="bg-slate-50 rounded-2xl border border-slate-200 p-6 items-center gap-y-4">
      <Ionicons name="document-text-outline" size={48} color="#2563eb" />
      <Text className="text-sm text-slate-600 text-center">PDF document</Text>
      {sourceUri ? (
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(sourceUri)}
          className="bg-primary-500 rounded-xl px-6 py-3"
        >
          <Text className="text-white font-semibold text-sm">Open PDF</Text>
        </Pressable>
      ) : (
        <Text className="text-xs text-slate-400">No document URL available</Text>
      )}
    </View>
  );
}

// ── Inline quiz player ────────────────────────────────────────────────────────

function QuizPlayer({ quizId, onPassed }: { quizId: string; onPassed: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quiz, isLoading, isError } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      try {
        return await api.get<QuizData>(`/api/quizzes/${quizId}`);
      } catch {
        const cached = await getOfflineModule<QuizData>(`quiz:${quizId}`);
        if (cached) return cached;
        throw new Error('Quiz not available offline');
      }
    },
    enabled: !!quizId,
  });

  const submitMutation = useMutation({
    mutationFn: async (submittedAnswers: Record<string, string>) => {
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;

      if (isOnline) {
        return api.post<QuizResult>(`/api/quizzes/${quizId}/attempt`, {
          answers: submittedAnswers,
        });
      }

      // Offline: queue the attempt and return a placeholder result.
      const localId = `${quizId}-${Date.now()}`;
      await savePendingQuizAttempt(localId, quizId, submittedAnswers);
      return {
        passed: false,
        score: 0,
        pointsEarned: 0,
        attemptsRemaining: 0,
        feedback: [],
        queued: true,
      } as QuizResult & { queued?: boolean };
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.passed) onPassed();
    },
  });

  if (isLoading) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator color="#3b82f6" />
        <Text className="text-slate-400 text-sm mt-2">Loading quiz…</Text>
      </View>
    );
  }

  if (isError || !quiz) {
    return (
      <View className="bg-red-50 border border-red-200 rounded-2xl p-6 items-center gap-y-2">
        <Ionicons name="alert-circle-outline" size={36} color="#ef4444" />
        <Text className="text-sm text-red-700 text-center">Quiz unavailable. Check your connection.</Text>
      </View>
    );
  }

  if (result) {
    const queued = (result as any).queued === true;
    return (
      <View className={`rounded-2xl border p-6 items-center gap-y-3 ${result.passed || queued ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <Ionicons
          name={queued ? 'time-outline' : result.passed ? 'checkmark-circle' : 'close-circle'}
          size={48}
          color={queued ? '#f59e0b' : result.passed ? '#16a34a' : '#ef4444'}
        />
        {queued ? (
          <>
            <Text className="text-base font-bold text-amber-800">Saved for later</Text>
            <Text className="text-sm text-amber-700 text-center">
              You are offline. Your answers have been queued and will be submitted when you reconnect.
            </Text>
          </>
        ) : result.passed ? (
          <>
            <Text className="text-base font-bold text-green-800">Passed! 🎉</Text>
            <Text className="text-sm text-green-700">
              Score: {Math.round(result.score)}% · {result.pointsEarned} CPD pts earned
            </Text>
          </>
        ) : (
          <>
            <Text className="text-base font-bold text-red-800">Not quite</Text>
            <Text className="text-sm text-red-700">
              Score: {Math.round(result.score)}% · Attempts remaining: {result.attemptsRemaining}
            </Text>
            {result.attemptsRemaining > 0 && (
              <Pressable
                onPress={() => { setResult(null); setAnswers({}); }}
                className="mt-2 bg-red-600 rounded-xl px-6 py-2"
              >
                <Text className="text-white font-semibold text-sm">Try again</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  const allAnswered = quiz.questions.every((q) => !!answers[q.id]);

  return (
    <View className="gap-y-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-slate-900">{quiz.title}</Text>
        <Text className="text-xs text-slate-400">Pass: {Math.round(quiz.passMark * 100)}%</Text>
      </View>

      {quiz.questions.map((q, idx) => (
        <View key={q.id} className="gap-y-2">
          <Text className="text-sm font-semibold text-slate-800">
            {idx + 1}. {q.text}
          </Text>
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                className={`flex-row items-center gap-x-3 rounded-xl border px-4 py-3 ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <View
                  className={`h-5 w-5 rounded-full border-2 items-center justify-center ${
                    selected ? 'border-primary-500' : 'border-slate-300'
                  }`}
                >
                  {selected && (
                    <View className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                  )}
                </View>
                <Text className={`text-sm flex-1 ${selected ? 'text-primary-700 font-medium' : 'text-slate-700'}`}>
                  {opt.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable
        onPress={() => submitMutation.mutate(answers)}
        disabled={!allAnswered || submitMutation.isPending}
        className="bg-primary-500 rounded-xl py-3 items-center mt-2 disabled:opacity-40"
      >
        <Text className="text-white font-semibold">
          {submitMutation.isPending ? 'Submitting…' : 'Submit Answers'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── ContentSection type ───────────────────────────────────────────────────────

type ContentSection = {
  id: string;
  title: string;
  type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'QUIZ_LINK';
  content: string;
  order: number;
};

type ModuleWithSections = {
  id: string;
  title: string;
  order: number;
  sections: ContentSection[];
};

type EnrollmentProgress = {
  id: string;
  completedSections: string[];
  progressPercent: number;
};

export default function CoursePlayerScreen({
  route,
  navigation,
}: CoursePlayerScreenProps) {
  const { enrollmentId, courseId } = route.params;
  const queryClient = useQueryClient();

  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  const { data: modules, isLoading } = useQuery({
    queryKey: ['course-modules', courseId],
    queryFn: async () => {
      try {
        return await api.get<ModuleWithSections[]>(`/api/courses/${courseId}/modules`);
      } catch (err) {
        const offlineModules = await getOfflineModule<ModuleWithSections[]>(`course:${courseId}`);
        if (offlineModules) return offlineModules;
        throw err;
      }
    },
  });

  const { data: enrollmentData } = useQuery({
    queryKey: ['enrollment-detail', enrollmentId],
    queryFn: () =>
      api
        .get<EnrollmentProgress[] | EnrollmentProgress>(`/api/enrollments?courseId=${courseId}`)
        .then((data) => (Array.isArray(data) ? data[0] : data)),
  });

  const completeMutation = useMutation({
    mutationFn: (sectionId: string) =>
      api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-detail', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
    },
  });

  if (isLoading || !modules) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['bottom']}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </SafeAreaView>
    );
  }

  const currentModule  = modules[activeModuleIdx];
  const sections       = currentModule?.sections ?? [];
  const currentSection = sections[activeSectionIdx];

  if (!currentModule || !currentSection) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['bottom']}>
        <Ionicons name="checkmark-circle" size={64} color="#3b82f6" />
        <Text className="text-xl font-bold text-slate-900 mt-4">Course Complete!</Text>
        <Text className="text-slate-500 text-sm mt-2 text-center px-8">
          All modules done. Your CPD points will be updated shortly.
        </Text>
        <Pressable className="mt-8" onPress={() => navigation.goBack()}>
          <Text className="text-primary-600 font-semibold">Back to course</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completedIds = enrollmentData?.completedSections ?? [];
  const isSectionDone = completedIds.includes(currentSection.id);
  const totalSections = modules.reduce((acc, m) => acc + m.sections.length, 0);
  const totalCompleted = completedIds.length;
  const overallPct = totalSections > 0 ? (totalCompleted / totalSections) * 100 : 0;

  function goNext() {
    if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx((i) => i + 1);
    } else if (activeModuleIdx < modules!.length - 1) {
      setActiveModuleIdx((i) => i + 1);
      setActiveSectionIdx(0);
    }
  }

  function goPrev() {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx((i) => i - 1);
    } else if (activeModuleIdx > 0) {
      setActiveModuleIdx((i) => i - 1);
      setActiveSectionIdx((modules![activeModuleIdx - 1]?.sections.length ?? 1) - 1);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* ── Progress bar ── */}
      <View className="h-1.5 bg-slate-100">
        <View className="h-full bg-primary-500" style={{ width: `${overallPct}%` }} />
      </View>

      {/* ── Module / section header ── */}
      <View className="px-4 py-3 border-b border-slate-100">
        <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
          Module {activeModuleIdx + 1}: {currentModule.title}
        </Text>
        <Text className="text-base font-bold text-slate-900 mt-0.5">{currentSection.title}</Text>
        <Text className="text-xs text-slate-400 mt-0.5">
          Section {activeSectionIdx + 1} of {sections.length}
        </Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        className="flex-1 px-5 py-4"
        showsVerticalScrollIndicator={false}
      >
        {currentSection.type === 'TEXT' ? (
          <Text className="text-sm text-slate-700 leading-7">{currentSection.content}</Text>
        ) : currentSection.type === 'VIDEO' ? (
          <CachedVideo uri={currentSection.content} />
        ) : currentSection.type === 'DOCUMENT' ? (
          <CachedDocument uri={currentSection.content} />
        ) : currentSection.type === 'QUIZ_LINK' ? (
          <QuizPlayer
            quizId={currentSection.content}
            onPassed={() => {
              if (!completedIds.includes(currentSection.id)) {
                completeMutation.mutate(currentSection.id);
              }
            }}
          />
        ) : (
          <View className="bg-slate-100 rounded-2xl h-48 items-center justify-center">
            <Ionicons name="image-outline" size={40} color="#94a3b8" />
          </View>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* ── Footer navigation ── */}
      <View className="px-4 py-4 border-t border-slate-100 gap-y-3">
        {!isSectionDone && (
          <Button
            label={completeMutation.isPending ? 'Saving…' : 'Mark as Complete'}
            onPress={async () => {
              const netState = await NetInfo.fetch();
              const isOnline =
                netState.isConnected === true && netState.isInternetReachable !== false;

              if (isOnline) {
                completeMutation.mutate(currentSection.id);
                return;
              }

              await savePendingProgress(enrollmentId, currentSection.id);
              queryClient.setQueryData<EnrollmentProgress | undefined>(
                ['enrollment-detail', enrollmentId],
                (old) => {
                  if (!old) {
                    return {
                      id: enrollmentId,
                      completedSections: [currentSection.id],
                      progressPercent: 0,
                    };
                  }
                  const completedSections = old.completedSections ?? [];
                  if (completedSections.includes(currentSection.id)) return old;
                  return {
                    ...old,
                    completedSections: [...completedSections, currentSection.id],
                  };
                },
              );
            }}
            loading={completeMutation.isPending}
          />
        )}

        <View className="flex-row gap-x-3">
          <Button
            label="← Prev"
            onPress={goPrev}
            variant="secondary"
            disabled={activeModuleIdx === 0 && activeSectionIdx === 0}
          />
          <Button
            label={
              activeModuleIdx === modules.length - 1 &&
              activeSectionIdx === sections.length - 1
                ? 'Finish'
                : 'Next →'
            }
            onPress={goNext}
            variant={isSectionDone ? 'primary' : 'ghost'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
