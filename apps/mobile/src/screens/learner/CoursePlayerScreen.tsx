import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../../lib/api';
import { getOfflineAsset, getOfflineModule, savePendingProgress, savePendingQuizAttempt } from '../../lib/offlineDB';
import { useModal } from '../../context/ModalContext';
import type { CoursePlayerScreenProps } from '../../navigation/types';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG,
  SUCCESS, SUCCESS_BG, DANGER, DANGER_BG, WARN, WARN_BG,
} from '../../theme';

// ── Quiz types ────────────────────────────────────────────────────────────────

type QuizOption   = { id: string; text: string };
type QuizQuestion = { id: string; text: string; type: string; points: number; options: QuizOption[] };
type QuizData = {
  id: string; title: string; passMark: number; attemptsRemaining: number;
  timeLimitMinutes: number | null; showAnswersAfter: boolean; questions: QuizQuestion[];
};
type QuizResult = {
  passed: boolean; score: number; pointsEarned: number; attemptsRemaining: number;
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
    <View style={s.videoWrap}>
      {sourceUri ? (
        <Video
          source={{ uri: sourceUri }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          style={{ flex: 1 }}
          shouldPlay={false}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={52} color={ACCENT_L} />
          <Text style={[s.metaText, { marginTop: 8 }]}>No video URL</Text>
        </View>
      )}
    </View>
  );
}

function CachedDocument({ uri }: { uri: string }) {
  const { showToast } = useModal();
  const sourceUri = useCachedUri(uri);

  const isLocal = sourceUri?.startsWith('file://') ?? false;

  async function openDocument() {
    if (!sourceUri) return;
    if (isLocal) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(sourceUri, { mimeType: 'application/pdf' });
      } else {
        showToast({ message: 'Cannot open PDF on this device.', type: 'warning' });
      }
    } else {
      void WebBrowser.openBrowserAsync(sourceUri);
    }
  }

  return (
    <View style={s.docWrap}>
      <Ionicons name="document-text-outline" size={48} color={ACCENT_L} />
      <Text style={s.metaText}>PDF document</Text>
      {sourceUri ? (
        <Pressable style={s.btnSmall} onPress={() => void openDocument()}>
          <Text style={s.btnSmallText}>{isLocal ? 'Open / Share PDF' : 'Open PDF'}</Text>
        </Pressable>
      ) : (
        <Text style={s.metaText}>Document not available offline</Text>
      )}
    </View>
  );
}

// ── Minimal HTML content renderer ──────────────────────────────────────────
// Course text sections are authored as simple HTML (only <h2>, <p>, <b> are
// ever used — see prisma/seed-courses.ts) rather than a rich-text tree, so a
// tiny bespoke parser avoids pulling in a full HTML-rendering dependency.

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(<b>.*?<\/b>)/g).filter(Boolean);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^<b>(.*?)<\/b>$/);
    return (
      <Text key={`${keyPrefix}-${i}`} style={boldMatch ? { fontWeight: '700' } : undefined}>
        {boldMatch ? boldMatch[1] : part}
      </Text>
    );
  });
}

function HtmlContent({ html }: { html: string }) {
  const blocks = html.split(/(<h2>.*?<\/h2>|<p>.*?<\/p>)/g).filter((b) => b.trim());
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((block, i) => {
        const h2Match = block.match(/^<h2>(.*?)<\/h2>$/);
        const pMatch  = block.match(/^<p>(.*?)<\/p>$/);
        if (h2Match) {
          return <Text key={i} style={s.contentHeading}>{renderInline(h2Match[1], `h${i}`)}</Text>;
        }
        if (pMatch) {
          return <Text key={i} style={s.bodyText}>{renderInline(pMatch[1], `p${i}`)}</Text>;
        }
        return <Text key={i} style={s.bodyText}>{renderInline(block, `t${i}`)}</Text>;
      })}
    </View>
  );
}

function CachedImage({ uri }: { uri: string }) {
  const sourceUri = useCachedUri(uri);
  if (!sourceUri) {
    return (
      <View style={s.imagePlaceholder}>
        <Ionicons name="image-outline" size={40} color={TEXT3} />
        <Text style={[s.metaText, { marginTop: 8 }]}>Image not available</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: sourceUri }}
      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }}
      resizeMode="contain"
    />
  );
}

// ── Inline quiz player ────────────────────────────────────────────────────────

function QuizPlayer({
  quizId,
  enrollmentId,
  sectionId,
  onPassed,
}: {
  quizId: string;
  enrollmentId: string;
  sectionId: string;
  onPassed: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result,  setResult]  = useState<QuizResult | null>(null);

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
        return api.post<QuizResult>(`/api/quizzes/${quizId}/attempt`, { answers: submittedAnswers });
      }

      const localId = `${quizId}-${Date.now()}`;
      await savePendingQuizAttempt(localId, quizId, enrollmentId, sectionId, submittedAnswers);
      return {
        passed: false, score: 0, pointsEarned: 0, attemptsRemaining: 0, feedback: [], queued: true,
      } as QuizResult & { queued?: boolean };
    },
    onSuccess: (data) => {
      setResult(data);
      const queued = (data as any).queued === true;
      if (data.passed || queued) onPassed();
    },
  });

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48 }}>
        <ActivityIndicator color={ACCENT} />
        <Text style={[s.metaText, { marginTop: 8 }]}>Loading quiz…</Text>
      </View>
    );
  }

  if (isError || !quiz) {
    return (
      <View style={[s.resultBox, { backgroundColor: DANGER_BG, borderColor: `${DANGER}44` }]}>
        <Ionicons name="alert-circle-outline" size={36} color={DANGER} />
        <Text style={[s.resultTitle, { color: DANGER }]}>Quiz unavailable</Text>
        <Text style={s.metaText}>Check your connection and try again.</Text>
      </View>
    );
  }

  if (result) {
    const queued = (result as any).queued === true;
    const bg     = queued ? WARN_BG    : result.passed ? SUCCESS_BG : DANGER_BG;
    const accent = queued ? WARN        : result.passed ? SUCCESS    : DANGER;
    const icon   = queued ? 'time-outline' : result.passed ? 'checkmark-circle' : 'close-circle';
    return (
      <View style={[s.resultBox, { backgroundColor: bg, borderColor: `${accent}44` }]}>
        <Ionicons name={icon} size={48} color={accent} />
        {queued ? (
          <>
            <Text style={[s.resultTitle, { color: WARN }]}>Saved for later</Text>
            <Text style={s.metaText}>You are offline. Your answers will be submitted when you reconnect.</Text>
          </>
        ) : result.passed ? (
          <>
            <Text style={[s.resultTitle, { color: SUCCESS }]}>Passed!</Text>
            <Text style={s.metaText}>Score: {Math.round(result.score)}% · {result.pointsEarned} CPD pts earned</Text>
          </>
        ) : (
          <>
            <Text style={[s.resultTitle, { color: DANGER }]}>Not quite</Text>
            <Text style={s.metaText}>Score: {Math.round(result.score)}% · Attempts remaining: {result.attemptsRemaining}</Text>
            {result.attemptsRemaining > 0 && (
              <Pressable
                style={[s.btnSmall, { backgroundColor: DANGER, marginTop: 8 }]}
                onPress={() => { setResult(null); setAnswers({}); }}
              >
                <Text style={s.btnSmallText}>Try again</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  const allAnswered = quiz.questions.every((q) => !!answers[q.id]);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={s.sectionTitle}>{quiz.title}</Text>
        <Text style={s.metaText}>Pass: {Math.round(quiz.passMark * 100)}%</Text>
      </View>

      {quiz.questions.map((q, idx) => (
        <View key={q.id} style={{ gap: 8 }}>
          <Text style={s.questionText}>{idx + 1}. {q.text}</Text>
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                style={[s.optionRow, selected && s.optionRowSelected]}
              >
                <View style={[s.optionDot, selected && s.optionDotSelected]}>
                  {selected && <View style={s.optionDotInner} />}
                </View>
                <Text style={[s.optionText, selected && s.optionTextSelected]}>{opt.text}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable
        style={[s.btnPrimary, (!allAnswered || submitMutation.isPending) && s.btnDisabled]}
        onPress={() => submitMutation.mutate(answers)}
        disabled={!allAnswered || submitMutation.isPending}
      >
        <Text style={s.btnText}>
          {submitMutation.isPending ? 'Submitting…' : 'Submit Answers'}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type ContentSection = {
  id: string; title: string;
  type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'QUIZ_LINK';
  content: string; order: number;
};
type ModuleWithSections = { id: string; title: string; order: number; sections: ContentSection[] };
type EnrollmentProgress = { id: string; completedSections: string[]; progressPercent: number };

export default function CoursePlayerScreen({ route, navigation }: CoursePlayerScreenProps) {
  const { enrollmentId, courseId } = route.params;
  const queryClient = useQueryClient();

  const [activeModuleIdx,  setActiveModuleIdx]  = useState(0);
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

  const { data: completedCourse } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<{ cpdPoints: number; title: string }>(`/api/courses/${courseId}`),
    enabled: !modules?.[activeModuleIdx]?.sections?.[activeSectionIdx],
  });

  const completeMutation = useMutation({
    mutationFn: (sectionId: string) =>
      api.patch(`/api/enrollments/${enrollmentId}/progress`, { sectionId }),
    onMutate: async (sectionId) => {
      await queryClient.cancelQueries({ queryKey: ['enrollment-detail', enrollmentId] });
      const prev = queryClient.getQueryData<EnrollmentProgress>(['enrollment-detail', enrollmentId]);
      queryClient.setQueryData<EnrollmentProgress | undefined>(
        ['enrollment-detail', enrollmentId],
        (old) => {
          if (!old) return old;
          if (old.completedSections?.includes(sectionId)) return old;
          return { ...old, completedSections: [...(old.completedSections ?? []), sectionId] };
        },
      );
      return { prev };
    },
    onError: (_err, _sectionId, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['enrollment-detail', enrollmentId], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-detail', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
    },
  });

  if (isLoading || !modules) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const currentModule  = modules[activeModuleIdx];
  const sections       = currentModule?.sections ?? [];
  const currentSection = sections[activeSectionIdx];

  if (!currentModule || !currentSection) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.completeIcon]}>
            <Ionicons name="checkmark-circle" size={56} color={SUCCESS} />
          </View>
          <Text style={[s.sectionTitle, { fontSize: 22, marginTop: 20 }]}>Course Complete!</Text>
          {completedCourse?.cpdPoints != null && (
            <Text style={[s.metaText, { textAlign: 'center', marginTop: 6, fontSize: 15 }]}>
              You've earned <Text style={{ color: SUCCESS, fontWeight: '800' }}>{completedCourse.cpdPoints} CPD points</Text>
            </Text>
          )}
          <View style={[s.resultBox, { backgroundColor: SUCCESS_BG, borderColor: `${SUCCESS}44`, marginTop: 16, width: '100%' }]}>
            <Ionicons name="ribbon" size={28} color={SUCCESS} />
            <Text style={[s.metaText, { color: SUCCESS, fontWeight: '700' }]}>Certificate Pending</Text>
            <Text style={[s.metaText, { textAlign: 'center' }]}>
              Your certificate will appear in the Certificates tab once points are recorded.
            </Text>
          </View>
          <Pressable style={[s.btnPrimary, { marginTop: 24, paddingHorizontal: 32 }]} onPress={() => navigation.goBack()}>
            <Text style={s.btnText}>Back to course</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const completedIds  = enrollmentData?.completedSections ?? [];
  const isSectionDone = completedIds.includes(currentSection.id);
  const totalSections = modules.reduce((acc, m) => acc + m.sections.length, 0);
  const overallPct    = totalSections > 0 ? (completedIds.length / totalSections) * 100 : 0;

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

  const isFirst = activeModuleIdx === 0 && activeSectionIdx === 0;
  const isLast  = activeModuleIdx === modules.length - 1 && activeSectionIdx === sections.length - 1;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* ── Progress bar ── */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${overallPct}%` as any }]} />
      </View>

      {/* ── Module / section header ── */}
      <View style={s.header}>
        <Text style={s.moduleName} numberOfLines={1}>
          {currentModule.title}
        </Text>
        <Text style={s.sectionTitle}>{currentSection.title}</Text>
        <Text style={s.metaText}>
          Section {activeSectionIdx + 1} of {sections.length}
        </Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {currentSection.type === 'TEXT' ? (
          <HtmlContent html={currentSection.content} />
        ) : currentSection.type === 'VIDEO' ? (
          <CachedVideo uri={currentSection.content} />
        ) : currentSection.type === 'DOCUMENT' ? (
          <CachedDocument uri={currentSection.content} />
        ) : currentSection.type === 'IMAGE' ? (
          <CachedImage uri={currentSection.content} />
        ) : currentSection.type === 'QUIZ_LINK' ? (
          <QuizPlayer
            quizId={currentSection.content}
            enrollmentId={enrollmentId}
            sectionId={currentSection.id}
            onPassed={() => {
              if (!completedIds.includes(currentSection.id)) {
                completeMutation.mutate(currentSection.id);
              }
            }}
          />
        ) : (
          <CachedImage uri={currentSection.content} />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Footer navigation ── */}
      <View style={s.footer}>
        {!isSectionDone && (
          <Pressable
            style={[s.btnPrimary, completeMutation.isPending && s.btnDisabled]}
            onPress={async () => {
              const netState = await NetInfo.fetch();
              const isOnline = netState.isConnected === true && netState.isInternetReachable !== false;

              if (isOnline) {
                completeMutation.mutate(currentSection.id);
                return;
              }

              await savePendingProgress(enrollmentId, currentSection.id);
              queryClient.setQueryData<EnrollmentProgress | undefined>(
                ['enrollment-detail', enrollmentId],
                (old) => {
                  if (!old) return { id: enrollmentId, completedSections: [currentSection.id], progressPercent: 0 };
                  if (old.completedSections?.includes(currentSection.id)) return old;
                  return { ...old, completedSections: [...(old.completedSections ?? []), currentSection.id] };
                },
              );
            }}
            disabled={completeMutation.isPending}
          >
            <Ionicons name={completeMutation.isPending ? 'hourglass-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
            <Text style={s.btnText}>{completeMutation.isPending ? 'Saving…' : 'Mark as Complete'}</Text>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={[s.btnSecondary, { flex: 1 }, isFirst && s.btnDisabled]}
            onPress={goPrev}
            disabled={isFirst}
          >
            <Ionicons name="chevron-back" size={16} color={TEXT2} />
            <Text style={s.btnSecondaryText}>Prev</Text>
          </Pressable>
          <Pressable
            style={[isSectionDone ? s.btnPrimary : s.btnGhost, { flex: 1 }]}
            onPress={goNext}
          >
            <Text style={isSectionDone ? s.btnText : s.btnGhostText}>
              {isLast ? 'Finish' : 'Next'}
            </Text>
            {!isLast && <Ionicons name="chevron-forward" size={16} color={isSectionDone ? '#fff' : ACCENT_L} />}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  progressTrack: { height: 3, backgroundColor: SURFACE2 },
  progressFill:  { height: '100%', backgroundColor: ACCENT },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 2,
  },
  moduleName: { color: ACCENT_L, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: '700', marginTop: 2 },
  metaText:  { color: TEXT3, fontSize: 12 },
  bodyText:  { color: TEXT2, fontSize: 14, lineHeight: 26 },
  contentHeading: { color: TEXT, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  questionText: { color: TEXT, fontSize: 14, fontWeight: '600', lineHeight: 22 },

  videoWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
  },
  docWrap: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  imagePlaceholder: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quiz options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRowSelected: {
    borderColor: `${ACCENT}88`,
    backgroundColor: ACCENT_BG,
  },
  optionDot: {
    width: 20, height: 20, borderRadius: 100,
    borderWidth: 2, borderColor: TEXT3,
    alignItems: 'center', justifyContent: 'center',
  },
  optionDotSelected: { borderColor: ACCENT_L },
  optionDotInner:    { width: 10, height: 10, borderRadius: 100, backgroundColor: ACCENT_L },
  optionText:         { flex: 1, color: TEXT2, fontSize: 13 },
  optionTextSelected: { color: ACCENT_L, fontWeight: '500' },

  // Result box
  resultBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: { fontSize: 18, fontWeight: '800' },

  // Complete state
  completeIcon: {
    width: 100, height: 100,
    borderRadius: 32,
    backgroundColor: SUCCESS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Buttons
  btnPrimary: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  btnSecondary: {
    backgroundColor: SURFACE2,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  btnText:          { color: '#fff',  fontSize: 14, fontWeight: '700' },
  btnSecondaryText: { color: TEXT2,   fontSize: 14, fontWeight: '600' },
  btnGhostText:     { color: ACCENT_L, fontSize: 14, fontWeight: '600' },
  btnSmall: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnSmallText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    gap: 10,
  },
});
