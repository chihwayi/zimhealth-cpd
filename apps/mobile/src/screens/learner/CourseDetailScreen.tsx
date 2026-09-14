import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { cacheCourseContent, cacheCourseOffline, retryFailedDownloads, shouldWarnForLargeDownload } from '../../lib/offlineDownload';
import { getCourseDownloadStatus, getOfflineCourseDetail, saveOfflineCourseDetail } from '../../lib/offlineDB';
import { useModal } from '../../context/ModalContext';
import type { CourseDetailScreenProps } from '../../navigation/types';
import { SkyHeader } from '../../components/ui/Horizon';
import {
  BG, SURFACE, SURFACE2, BORDER, BORDER2, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, SUCCESS, SUCCESS_BG, WARN,
} from '../../theme';

type Module = {
  id: string;
  title: string;
  order: number;
  _count?: { sections: number };
};

type CourseDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string;
  difficulty: string;
  cpdPoints: number;
  estimatedMinutes: number;
  modules: Module[];
  _count?: { enrollments: number };
};

type Enrollment = {
  id: string;
  completedAt: string | null;
  course: { id: string };
};

export default function CourseDetailScreen({ route, navigation }: CourseDetailScreenProps) {
  const { showToast } = useModal();
  const { courseId } = route.params;
  const queryClient  = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      try {
        const data = await api.get<CourseDetail>(`/api/courses/${courseId}`);
        void saveOfflineCourseDetail(courseId, data);
        return data;
      } catch {
        const cached = await getOfflineCourseDetail<CourseDetail>(courseId);
        if (cached) return cached;
        throw new Error('Course not available offline. Download it first.');
      }
    },
  });

  const { data: downloadStatus, refetch: refetchDownloadStatus } = useQuery({
    queryKey: ['download-status', courseId],
    queryFn: () => getCourseDownloadStatus(courseId),
    staleTime: Infinity,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments-mine'],
    queryFn: () => api.get<Enrollment[]>('/api/enrollments'),
  });

  const enrollment = enrollments?.find((e) => e.course.id === courseId);

  const enrollMutation = useMutation({
    mutationFn: () => api.post<Enrollment>(`/api/courses/${courseId}/enroll`, {}),
    onSuccess: (newEnrollment) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
      // Cache module/quiz text immediately so the course is readable and
      // quizzable offline right away — heavy media stays an opt-in download
      // (the "Download for offline use" button below) to protect data plans.
      void cacheCourseContent(courseId).then(() => refetchDownloadStatus());
      navigation.navigate('CoursePlayer', { enrollmentId: newEnrollment.id, courseId });
    },
  });

  if (isLoading || !course) {
    return (
      <SafeAreaView style={s.safe} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: TEXT3 }}>Loading course…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero banner ── */}
        <SkyHeader style={s.hero}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{course.category}</Text>
            </View>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>{course.difficulty}</Text>
            </View>
          </View>
          <Text style={s.heroTitle}>{course.title}</Text>
          {course.subtitle && (
            <Text style={s.heroSub}>{course.subtitle}</Text>
          )}
        </SkyHeader>

        <View style={{ paddingHorizontal: 16, paddingBottom: 40, gap: 20, marginTop: -16 }}>
          {/* ── Stats row ── */}
          <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18 }]}>
            {[
              { icon: 'star-outline'   as const, label: `${course.cpdPoints} CPD pts`              },
              { icon: 'time-outline'   as const, label: `${course.estimatedMinutes} min`             },
              { icon: 'layers-outline' as const, label: `${course.modules.length} modules`           },
              { icon: 'people-outline' as const, label: `${course._count?.enrollments ?? 0} enrolled` },
            ].map((stat) => (
              <View key={stat.label} style={{ alignItems: 'center', gap: 5 }}>
                <Ionicons name={stat.icon} size={20} color={ACCENT_L} />
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Description ── */}
          <View>
            <Text style={s.sectionTitle}>About this course</Text>
            <Text style={s.bodyText}>{course.description}</Text>
          </View>

          {/* ── Modules list ── */}
          <View>
            <Text style={s.sectionTitle}>
              Course modules ({course.modules.length})
            </Text>
            <View style={{ gap: 8 }}>
              {course.modules.map((mod, idx) => (
                <View key={mod.id} style={s.moduleRow}>
                  <View style={s.moduleNum}>
                    <Text style={s.moduleNumText}>{idx + 1}</Text>
                  </View>
                  <Text style={s.moduleTitle}>{mod.title}</Text>
                  {mod._count?.sections != null && (
                    <Text style={s.moduleSections}>{mod._count.sections} sec</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── CTA ── */}
          {enrollment ? (
            <Pressable
              style={enrollment.completedAt ? s.btnSuccess : s.btnPrimary}
              onPress={() =>
                navigation.navigate('CoursePlayer', {
                  enrollmentId: enrollment.id,
                  courseId,
                })
              }
            >
              <Ionicons
                name={enrollment.completedAt ? 'checkmark-circle' : 'play-circle'}
                size={18}
                color="#fff"
              />
              <Text style={s.btnText}>
                {enrollment.completedAt ? 'Completed — Review' : 'Continue Learning'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.btnPrimary, enrollMutation.isPending && s.btnDisabled]}
              onPress={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
            >
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={s.btnText}>
                {enrollMutation.isPending ? 'Enrolling…' : 'Enrol Now — Free'}
              </Text>
            </Pressable>
          )}

          {enrollment && (
            <>
              <Pressable
                style={[
                  s.offlineBtn,
                  (downloading || downloadStatus === 'downloaded') && s.offlineBtnDisabled,
                ]}
                disabled={downloading || downloadStatus === 'downloaded'}
                onPress={async () => {
                  if (!course) return;
                  setDownloading(true);
                  try {
                    if (await shouldWarnForLargeDownload()) {
                      showToast({ message: 'You are on mobile data. Course text and quiz data will be saved, but large media may take longer.', type: 'warning', duration: 4000 });
                    }
                    await cacheCourseOffline(courseId);
                    void refetchDownloadStatus();
                  } catch {
                    showToast({ message: 'Could not download this course for offline use. Please try again on Wi-Fi.', type: 'danger' });
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                <Ionicons
                  name={
                    downloadStatus === 'downloaded'
                      ? 'checkmark-circle'
                      : downloading
                        ? 'hourglass-outline'
                        : 'cloud-download-outline'
                  }
                  size={16}
                  color={downloadStatus === 'downloaded' ? SUCCESS : ACCENT_L}
                />
                <Text style={[s.offlineBtnText, downloadStatus === 'downloaded' && { color: SUCCESS }]}>
                  {downloadStatus === 'downloaded'
                    ? 'Downloaded for offline use'
                    : downloading
                      ? 'Downloading…'
                      : 'Download for offline use'}
                </Text>
              </Pressable>

              {downloadStatus === 'partial' && (
                <Pressable
                  style={[s.retryBtn, retrying && s.offlineBtnDisabled]}
                  disabled={retrying}
                  onPress={async () => {
                    setRetrying(true);
                    try {
                      await retryFailedDownloads(courseId);
                      void refetchDownloadStatus();
                    } catch {
                      showToast({ message: 'Some files could not be downloaded. Check your connection and try again.', type: 'danger' });
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  <Ionicons
                    name={retrying ? 'hourglass-outline' : 'refresh-circle-outline'}
                    size={16}
                    color={WARN}
                  />
                  <Text style={s.retryBtnText}>
                    {retrying ? 'Retrying…' : 'Some media failed — tap to retry'}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  heroBadge: {
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  heroBadgeText: { color: ACCENT_L, fontSize: 11, fontWeight: '700' },
  heroTitle: { color: TEXT, fontSize: 22, fontWeight: '800', lineHeight: 30, letterSpacing: -0.3 },
  heroSub:   { color: TEXT2, fontSize: 13, marginTop: 6 },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  statLabel: { color: TEXT2, fontSize: 11, fontWeight: '600' },

  sectionTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  bodyText:     { color: TEXT2, fontSize: 13, lineHeight: 22 },

  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  moduleNum:      { width: 28, height: 28, borderRadius: 100, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center' },
  moduleNumText:  { color: ACCENT_L, fontSize: 12, fontWeight: '700' },
  moduleTitle:    { flex: 1, color: TEXT, fontSize: 13, fontWeight: '500' },
  moduleSections: { color: TEXT3, fontSize: 11 },

  btnPrimary: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btnSuccess: {
    backgroundColor: SUCCESS,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },

  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  offlineBtnDisabled: { opacity: 0.5 },
  offlineBtnText: { color: ACCENT_L, fontSize: 13, fontWeight: '500' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryBtnText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
});
