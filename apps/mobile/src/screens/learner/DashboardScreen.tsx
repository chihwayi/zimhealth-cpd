import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { getOfflineModule, saveOfflineModule } from '../../lib/offlineDB';
import { useAuthStore } from '../../store/auth.store';
import type { AppTabParamList } from '../../navigation/types';
import { ProgressRing, HorizonRule, SkyHeader, StreakBars, AchievementBadge } from '../../components/ui/Horizon';
import {
  BG,
  SURFACE,
  SURFACE2,
  BORDER,
  TEXT,
  TEXT2,
  TEXT3,
  ACCENT_L,
  ACCENT_BG,
  DANGER,
  DANGER_BG,
  WHATSAPP,
  VIOLET_500,
  AMBER_400,
} from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type PointsData = {
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  cycleYear: number;
};

type RecommendedCourse = {
  id: string;
  title: string;
  category: string;
  cpdPoints: number;
  estimatedMinutes: number;
  difficulty: string;
};

type RecommendationsData = {
  courses: RecommendedCourse[];
  isProfileBased: boolean;
  message?: string;
};

type Enrollment = {
  id: string;
  progress: number;
  completedAt: string | null;
  course: { id: string; title: string; category: string; cpdPoints: number };
};

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
};

type Achievement = {
  code: string;
  title: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
};

type MeData = {
  council: { requiredPoints: number; renewalMonth: number; renewalDay: number } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CADRE_LABEL: Record<string, string> = {
  NURSE:            'Registered General Nurse',
  MIDWIFE:          'Registered Midwife',
  PHARMACIST:       'Pharmacist',
  CLINICAL_OFFICER: 'Clinical Officer',
  LAB_TECH:         'Laboratory Technician',
};

const ACHIEVEMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  FIRST_COURSE_COMPLETE: 'flag-outline',
  FIVE_COURSES_COMPLETE: 'trophy-outline',
  FIRST_QUIZ_PASS: 'checkmark-done-outline',
  STREAK_7_DAYS: 'flame-outline',
  STREAK_30_DAYS: 'rocket-outline',
  SPECIALTY_FOCUS_5: 'ribbon-outline',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function daysToRenewal(month: number, day: number): number {
  const now = new Date();
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target.getTime() < now.getTime()) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const WHATSAPP_LINK = 'https://wa.me/263771234567';

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();

  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ['points-summary'],
    queryFn: async () => {
      try {
        const data = await api.get<PointsData>('/api/points/summary');
        void saveOfflineModule('points-summary', data);
        return data;
      } catch {
        const cached = await getOfflineModule<PointsData>('points-summary');
        if (cached) return cached;
        return { totalPoints: 0, requiredPoints: 60, percentComplete: 0, cycleYear: new Date().getFullYear() };
      }
    },
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeData>('/api/auth/me'),
    staleTime: 1000 * 60 * 10,
  });

  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.get<StreakData>('/api/learners/me/streak'),
  });

  const { data: achievementsData } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get<{ achievements: Achievement[] }>('/api/learners/me/achievements'),
  });

  const {
    data: recs,
    isLoading: recsLoading,
    isError: recsError,
    refetch: refetchRecs,
  } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api.get<RecommendationsData>('/api/recommendations'),
    staleTime: 1000 * 60 * 30,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments-mine'],
    queryFn: async () => {
      try {
        const data = await api.get<Enrollment[]>('/api/enrollments');
        void saveOfflineModule('enrollments-mine', data);
        return data;
      } catch {
        const cached = await getOfflineModule<Enrollment[]>('enrollments-mine');
        return cached ?? [];
      }
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post('/api/recommendations/refresh', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const totalPoints    = pointsData?.totalPoints ?? 0;
  const targetPoints   = pointsData?.requiredPoints ?? 60;
  const progressPct    = Math.min(pointsData?.percentComplete ?? 0, 100);
  const inProgressList = (enrollments ?? []).filter((e) => !e.completedAt).slice(0, 3);
  const renewal        = me?.council ? daysToRenewal(me.council.renewalMonth, me.council.renewalDay) : null;
  const isUrgentRenewal = renewal !== null && renewal <= 60;

  const currentStreak = streak?.currentStreak ?? 0;
  const streakDays = Array.from({ length: 7 }).map((_, i) => {
    const lit = i < Math.min(currentStreak, 7);
    return { lit, h: lit ? 0.5 + (i % 3) * 0.2 : 0.35 };
  });

  const earnedAchievements = (achievementsData?.achievements ?? []).slice(0, 3);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={pointsLoading || recsLoading}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
              void queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
              void queryClient.invalidateQueries({ queryKey: ['streak'] });
              void queryClient.invalidateQueries({ queryKey: ['achievements'] });
              void refetchRecs();
            }}
            tintColor={ACCENT_L}
          />
        }
      >
        {/* ── Sky hero ── */}
        <SkyHeader style={s.hero}>
          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>{greeting()}</Text>
              <Text style={s.heroName} numberOfLines={1}>
                {user?.fullName?.split(' ')[0] ?? 'there'}
              </Text>
              {user?.cadre && (
                <View style={s.cadrePill}>
                  <Text style={s.cadreText}>{CADRE_LABEL[user.cadre] ?? user.cadre}</Text>
                </View>
              )}
            </View>
            <View style={s.heroIcon}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
            </View>
          </View>

          <View style={s.ringRow}>
            <ProgressRing size={116} strokeWidth={9} percent={progressPct}>
              <Text style={s.ringValue}>{totalPoints}</Text>
              <Text style={s.ringLabel}>of {targetPoints} pts</Text>
            </ProgressRing>
            <View style={{ flex: 1, marginLeft: 18 }}>
              {renewal !== null && (
                <View style={[s.renewalPill, isUrgentRenewal ? { backgroundColor: DANGER_BG, borderColor: 'rgba(225,29,72,0.4)' } : { backgroundColor: ACCENT_BG, borderColor: 'rgba(139,92,246,0.35)' }]}>
                  <View style={[s.renewalDot, { backgroundColor: isUrgentRenewal ? DANGER : VIOLET_500 }]} />
                  <Text style={[s.renewalText, isUrgentRenewal && { color: '#fecdd3' }]}>{renewal} days to renewal</Text>
                </View>
              )}
              <Text style={s.heroCaption}>
                {targetPoints - totalPoints > 0
                  ? `${targetPoints - totalPoints} points to go — keep it up.`
                  : 'Renewal requirement met!'}
              </Text>
            </View>
          </View>

          <HorizonRule style={{ marginTop: 22 }} />

          <View style={{ marginTop: 18 }}>
            <View style={s.streakHeaderRow}>
              <Text style={s.streakLabel}>{currentStreak}-day streak</Text>
              <Text style={s.streakBest}>best: {streak?.longestStreak ?? 0}</Text>
            </View>
            <StreakBars days={streakDays} />
          </View>
        </SkyHeader>

        <View style={{ paddingHorizontal: 16, marginTop: 20, gap: 22 }}>
          {progressPct >= 100 && (!user?.subscriptionTier || user.subscriptionTier === 'FREE') && (
            <Pressable style={s.upgradeCta} onPress={() => navigation.navigate('ProfileTab')}>
              <Ionicons name="ribbon-outline" size={14} color={AMBER_400} />
              <Text style={s.upgradeCtaText}>Upgrade to receive your CPD certificate →</Text>
            </Pressable>
          )}

          {/* ── Continue learning ── */}
          {inProgressList.length > 0 && (
            <View>
              <Text style={s.sectionLabel}>Continue learning</Text>
              <FlatList
                data={inProgressList}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <Pressable style={s.continueCard} onPress={() => navigation.navigate('CoursesTab')}>
                    <View style={s.continueThumb}>
                      <Ionicons name="play" size={20} color="#fff" />
                    </View>
                    <Text style={s.continueTitle} numberOfLines={2}>{item.course.title}</Text>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${Math.round(item.progress * 100)}%` as any }]} />
                    </View>
                    <Text style={s.cardMeta}>{Math.round(item.progress * 100)}% complete</Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          {/* ── Recommendations ── */}
          <View>
            <View style={[s.cardRow, { marginBottom: 10 }]}>
              <View>
                <Text style={s.sectionLabel}>Recommended for you</Text>
                {recs?.isProfileBased && <Text style={s.profileTag}>Based on your profile</Text>}
              </View>
              <Pressable onPress={() => refreshMutation.mutate()} hitSlop={10} disabled={refreshMutation.isPending}>
                {refreshMutation.isPending
                  ? <ActivityIndicator size="small" color={ACCENT_L} />
                  : <Ionicons name="refresh-outline" size={18} color={ACCENT_L} />}
              </Pressable>
            </View>

            {recsLoading ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[1, 2].map((i) => <View key={i} style={s.recCardSkeleton} />)}
              </View>
            ) : recsError ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Text style={s.cardMeta}>Could not load recommendations. Pull down to retry.</Text>
              </View>
            ) : recs?.courses.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Text style={s.cardMeta}>Complete your profile to get personalised suggestions.</Text>
              </View>
            ) : (
              <FlatList
                data={recs?.courses ?? []}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}
                renderItem={({ item }) => (
                  <View style={s.recCard}>
                    <View style={s.catPill}>
                      <Text style={s.catText}>{item.category}</Text>
                    </View>
                    <View style={{ marginTop: 'auto' as any }}>
                      <Text style={s.recTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.cardMeta}>{item.cpdPoints} pts · {item.estimatedMinutes} min</Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>

          {/* ── Badges ── */}
          {earnedAchievements.length > 0 && (
            <View>
              <Text style={s.sectionLabel}>Your badges</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {earnedAchievements.map((a) => (
                  <AchievementBadge
                    key={a.code}
                    earned={a.earned}
                    label={a.title}
                    icon={
                      <Ionicons
                        name={ACHIEVEMENT_ICONS[a.code] ?? 'star-outline'}
                        size={18}
                        color={a.earned ? '#fff' : TEXT3}
                      />
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable style={s.fab} onPress={() => Linking.openURL(WHATSAPP_LINK)}>
        <Ionicons name="logo-whatsapp" size={16} color="#fff" />
        <Text style={s.fabText}>WhatsApp</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 26 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greeting: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  heroName: { color: TEXT, fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  cadrePill: {
    marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  cadreText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  ringRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  ringValue: { color: TEXT, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, marginTop: 2 },

  renewalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: 100, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  renewalDot: { width: 6, height: 6, borderRadius: 3 },
  renewalText: { color: '#e9d5ff', fontSize: 11.5, fontWeight: '700' },
  heroCaption: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, marginTop: 10, lineHeight: 18 },

  streakHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  streakLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '700' },
  streakBest: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  upgradeCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.14)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)',
  },
  upgradeCtaText: { color: '#fdba74', fontSize: 12, fontWeight: '600', flex: 1 },

  card: { backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { color: TEXT3, fontSize: 12, marginTop: 3 },

  sectionLabel: { color: TEXT2, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  profileTag: { color: ACCENT_L, fontSize: 11, marginTop: 2 },

  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: '100%', backgroundColor: AMBER_400, borderRadius: 100 },

  continueCard: { width: 190, backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 14 },
  continueThumb: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  continueTitle: { color: TEXT, fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 8 },

  recCard: { width: 180, backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 14, height: 130 },
  recCardSkeleton: { width: 180, height: 130, backgroundColor: SURFACE2, borderRadius: 20 },
  catPill: { alignSelf: 'flex-start', backgroundColor: ACCENT_BG, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { color: ACCENT_L, fontSize: 10, fontWeight: '700' },
  recTitle: { color: TEXT, fontSize: 12, fontWeight: '600', lineHeight: 17, marginBottom: 4 },

  fab: {
    position: 'absolute', right: 16, bottom: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: WHATSAPP, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: WHATSAPP, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
