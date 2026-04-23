import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

// ── Types ─────────────────────────────────────────────────────────────────────

type PointsData = {
  total: number;
  target: number;
  entries: Array<{ id: string; points: number; reason: string; createdAt: string }>;
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
  NURSE:           'Registered General Nurse',
  MIDWIFE:         'Registered Midwife',
  PHARMACIST:      'Pharmacist',
  CLINICAL_OFFICER:'Clinical Officer',
  LAB_TECH:        'Laboratory Technician',
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

  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ['points'],
    queryFn: () => api.get<PointsData>('/api/points/my'),
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
    queryFn: () => api.get<Enrollment[]>('/api/enrollments'),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.post('/api/recommendations/refresh', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const totalPoints   = pointsData?.total ?? 0;
  const targetPoints  = pointsData?.target ?? 60;
  const progressPct   = Math.min((totalPoints / targetPoints) * 100, 100);
  const completedCount = enrollments?.filter((e) => e.completedAt).length ?? 0;

  const inProgress = enrollments?.find((e) => !e.completedAt);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={pointsLoading || recsLoading}
            onRefresh={() => {
              void queryClient.invalidateQueries({ queryKey: ['points'] });
              void queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
              void refetchRecs();
            }}
            tintColor="#14b8a6"
          />
        }
      >
        {/* ── Hero greeting card ── */}
        <View className="bg-primary-500 px-5 pt-6 pb-8">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-primary-200 text-sm font-medium">{greeting()},</Text>
              <Text className="text-white text-2xl font-bold mt-0.5" numberOfLines={1}>
                {user?.fullName?.split(' ')[0] ?? 'Nurse'} 👋
              </Text>
              {user?.cadre && (
                <Badge
                  label={CADRE_LABEL[user.cadre] ?? user.cadre}
                  variant="white"
                />
              )}
            </View>
            <View className="h-12 w-12 bg-white/20 rounded-2xl items-center justify-center">
              <Text className="text-2xl">🏥</Text>
            </View>
          </View>
        </View>

        <View className="px-4 -mt-4 gap-y-4">
          {/* ── CPD Progress ── */}
          <Card className="pt-5 pb-4 px-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-slate-900">CPD Progress</Text>
              <Text className="text-xs text-slate-500 font-medium">
                {totalPoints} / {targetPoints} pts
              </Text>
            </View>
            {/* Progress bar */}
            <View className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </View>
            <Text className="text-xs text-slate-400 mt-2">
              {progressPct >= 100
                ? '✅ Renewal requirement met!'
                : `${Math.round(100 - progressPct)}% remaining for this cycle`}
            </Text>
          </Card>

          {/* ── Quick stats ── */}
          <View className="flex-row gap-x-3">
            {[
              { icon: 'checkmark-circle-outline' as const, label: 'Completed', value: completedCount },
              { icon: 'star-outline'              as const, label: 'Points',    value: totalPoints    },
              { icon: 'flame-outline'             as const, label: 'Streak',   value: '—'            },
            ].map((stat) => (
              <Card key={stat.label} className="flex-1 items-center py-4">
                <Ionicons name={stat.icon} size={22} color="#0d9488" />
                <Text className="text-xl font-bold text-slate-900 mt-1">{stat.value}</Text>
                <Text className="text-xs text-slate-400 mt-0.5">{stat.label}</Text>
              </Card>
            ))}
          </View>

          {/* ── Continue learning ── */}
          {inProgress && (
            <View>
              <Text className="text-sm font-bold text-slate-700 mb-2 px-1">Continue Learning</Text>
              <Card className="flex-row items-center gap-x-3">
                <View className="h-12 w-12 bg-primary-100 rounded-2xl items-center justify-center">
                  <Ionicons name="play-circle" size={24} color="#0d9488" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
                    {inProgress.course.title}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-0.5">
                    {inProgress.course.cpdPoints} CPD pts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </Card>
            </View>
          )}

          {/* ── Recommendations ── */}
          <View>
            <View className="flex-row items-center justify-between px-1 mb-2">
              <View>
                <Text className="text-sm font-bold text-slate-700">Recommended for You</Text>
                {recs?.isProfileBased && (
                  <Text className="text-xs text-primary-600 mt-0.5">Based on your profile</Text>
                )}
              </View>
              <Pressable
                onPress={() => refreshMutation.mutate()}
                hitSlop={8}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? (
                  <ActivityIndicator size="small" color="#0d9488" />
                ) : (
                  <Ionicons name="refresh-outline" size={18} color="#0d9488" />
                )}
              </Pressable>
            </View>

            {recsLoading ? (
              <View className="flex-row gap-x-3">
                {[1, 2].map((i) => (
                  <View key={i} className="w-48 h-32 bg-slate-200 rounded-3xl animate-pulse" />
                ))}
              </View>
            ) : recsError ? (
              <Card variant="slate" className="items-center py-6">
                <Text className="text-slate-500 text-sm text-center">
                  Could not load recommendations.{'\n'}Pull down to retry.
                </Text>
              </Card>
            ) : recs?.courses.length === 0 ? (
              <Card variant="slate" className="py-6 items-center">
                <Text className="text-slate-500 text-sm text-center mb-2">
                  Complete your profile to get personalised suggestions.
                </Text>
                <Badge label="Go to Profile →" variant="teal" />
              </Card>
            ) : (
              <FlatList
                data={recs?.courses ?? []}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}
                renderItem={({ item }) => (
                  <Pressable className="w-48">
                    <Card className="h-32 justify-between">
                      <Badge label={item.category} variant="teal" />
                      <View>
                        <Text className="text-sm font-semibold text-slate-900 leading-5" numberOfLines={2}>
                          {item.title}
                        </Text>
                        <Text className="text-xs text-slate-400 mt-1">
                          {item.cpdPoints} pts · {item.estimatedMinutes} min
                        </Text>
                      </View>
                    </Card>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
