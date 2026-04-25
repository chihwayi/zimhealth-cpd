import {
  ActivityIndicator,
  FlatList,
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
import { BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3, ACCENT, ACCENT_L, ACCENT_BG, HERO_BG, WARN } from '../../theme';

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
  completedAt: string | null;
  course: { id: string; title: string; category: string; cpdPoints: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const CADRE_LABEL: Record<string, string> = {
  NURSE:            'Registered General Nurse',
  MIDWIFE:          'Registered Midwife',
  PHARMACIST:       'Pharmacist',
  CLINICAL_OFFICER: 'Clinical Officer',
  LAB_TECH:         'Laboratory Technician',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

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
  const completedCount = enrollments?.filter((e) => e.completedAt).length ?? 0;
  const inProgress     = enrollments?.find((e) => !e.completedAt);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={
          <RefreshControl
            refreshing={pointsLoading || recsLoading}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
              void queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
              void refetchRecs();
            }}
            tintColor={ACCENT_L}
          />
        }
      >
        {/* ── Hero greeting ── */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting()},</Text>
            <Text style={s.heroName} numberOfLines={1}>
              {user?.fullName?.split(' ')[0] ?? 'Doctor'}
            </Text>
            {user?.cadre && (
              <View style={s.cadrePill}>
                <Text style={s.cadreText}>{CADRE_LABEL[user.cadre] ?? user.cadre}</Text>
              </View>
            )}
          </View>
          <View style={s.heroIcon}>
            <Ionicons name="pulse" size={28} color={ACCENT_L} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16, marginTop: 20 }}>
          {/* ── CPD Progress card ── */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardTitle}>CPD Progress {pointsData?.cycleYear ?? ''}</Text>
              <Text style={s.progressLabel}>{totalPoints} / {targetPoints} pts</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <Text style={s.progressCaption}>
              {progressPct >= 100
                ? 'Renewal requirement met!'
                : `${Math.round(100 - progressPct)}% remaining for this cycle`}
            </Text>
            {progressPct >= 100 && (!user?.subscriptionTier || user.subscriptionTier === 'FREE') && (
              <Pressable
                style={s.upgradeCta}
                onPress={() => navigation.navigate('ProfileTab')}
              >
                <Ionicons name="ribbon-outline" size={14} color={WARN} />
                <Text style={s.upgradeCtaText}>Upgrade to receive your CPD certificate →</Text>
              </Pressable>
            )}
          </View>

          {/* ── Quick stats ── */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { icon: 'checkmark-circle-outline' as const, label: 'Completed', value: completedCount },
              { icon: 'star-outline'              as const, label: 'Points',    value: totalPoints    },
              { icon: 'flame-outline'             as const, label: 'Streak',    value: '—'            },
            ].map((stat) => (
              <View key={stat.label} style={[s.card, s.statCard]}>
                <Ionicons name={stat.icon} size={22} color={ACCENT_L} />
                <Text style={s.statValue}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Continue learning ── */}
          {inProgress && (
            <View>
              <Text style={s.sectionLabel}>Continue Learning</Text>
              <Pressable
                style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                onPress={() => navigation.navigate('CoursesTab')}
              >
                <View style={s.continueBadge}>
                  <Ionicons name="play-circle" size={26} color={ACCENT_L} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { fontSize: 13 }]} numberOfLines={2}>
                    {inProgress.course.title}
                  </Text>
                  <Text style={s.cardMeta}>{inProgress.course.cpdPoints} CPD pts</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TEXT3} />
              </Pressable>
            </View>
          )}

          {/* ── Recommendations ── */}
          <View>
            <View style={[s.cardRow, { marginBottom: 10 }]}>
              <View>
                <Text style={s.sectionLabel}>Recommended for You</Text>
                {recs?.isProfileBased && (
                  <Text style={s.profileTag}>Based on your profile</Text>
                )}
              </View>
              <Pressable
                onPress={() => refreshMutation.mutate()}
                hitSlop={10}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <Ionicons name="refresh-outline" size={18} color={ACCENT_L} />
                }
              </Pressable>
            </View>

            {recsLoading ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[1, 2].map((i) => (
                  <View key={i} style={[s.recCardSkeleton]} />
                ))}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Hero
  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: { color: ACCENT_L, fontSize: 13, fontWeight: '600' },
  heroName:  { color: TEXT, fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroIcon:  {
    width: 52, height: 52,
    borderRadius: 18,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadrePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cadreText: { color: ACCENT_L, fontSize: 11, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  cardMeta:  { color: TEXT3, fontSize: 12, marginTop: 3 },

  // Progress
  progressLabel:   { color: TEXT2, fontSize: 12, fontWeight: '600' },
  progressTrack:   { height: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, overflow: 'hidden', marginTop: 12 },
  progressFill:    { height: '100%', backgroundColor: ACCENT, borderRadius: 100 },
  progressCaption: { color: TEXT3, fontSize: 12, marginTop: 8 },
  upgradeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  upgradeCtaText: { color: '#f59e0b', fontSize: 12, fontWeight: '600', flex: 1 },

  // Stats
  statCard:  { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: TEXT, fontSize: 20, fontWeight: '800', marginTop: 4 },
  statLabel: { color: TEXT3, fontSize: 11 },

  // Section labels
  sectionLabel: { color: TEXT2, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  profileTag:   { color: ACCENT_L, fontSize: 11, marginTop: 2 },

  // Continue
  continueBadge: {
    width: 48, height: 48,
    borderRadius: 16,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rec cards
  recCard: {
    width: 180,
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    height: 130,
  },
  recCardSkeleton: {
    width: 180,
    height: 130,
    backgroundColor: SURFACE2,
    borderRadius: 20,
  },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText:  { color: ACCENT_L, fontSize: 10, fontWeight: '700' },
  recTitle: { color: TEXT, fontSize: 12, fontWeight: '600', lineHeight: 17, marginBottom: 4 },
});
