import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ProgressRing, SkyHeader, Chip } from '../../components/ui/Horizon';
import {
  BG,
  SURFACE,
  BORDER,
  TEXT,
  TEXT2,
  TEXT3,
  ACCENT_L,
  VIOLET_600,
  AMBER_600,
  CYAN,
  ROSE,
  WHATSAPP,
} from '../../theme';

type PointsData = {
  totalPoints: number;
  requiredPoints: number;
  percentComplete: number;
  cycleYear: number;
};

type CPDRecord = {
  id: string;
  activityType: 'VIDEO_WATCH' | 'QUIZ_PASS' | 'READING' | 'WEBINAR' | 'WHATSAPP_QUIZ';
  pointsEarned: number;
  completedAt: string;
  course: { title: string; effectivePoints: number | null } | null;
};

const ACTIVITY_LABEL: Record<CPDRecord['activityType'], string> = {
  VIDEO_WATCH: 'Video watched',
  QUIZ_PASS: 'Quiz passed',
  READING: 'Reading completed',
  WEBINAR: 'Webinar attended',
  WHATSAPP_QUIZ: 'Answered on WhatsApp',
};

const ACTIVITY_COLOR: Record<CPDRecord['activityType'], string> = {
  VIDEO_WATCH: VIOLET_600,
  QUIZ_PASS: AMBER_600,
  READING: CYAN,
  WEBINAR: ROSE,
  WHATSAPP_QUIZ: WHATSAPP,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function PointsScreen() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const { data: pointsData, isLoading: summaryLoading } = useQuery({
    queryKey: ['points-summary', year],
    queryFn: () => api.get<PointsData>(`/api/points/summary?year=${year}`),
  });

  const {
    data: records,
    isLoading: recordsLoading,
    refetch,
  } = useQuery({
    queryKey: ['points-records', year],
    queryFn: () => api.get<CPDRecord[]>(`/api/points/records?year=${year}&limit=50`),
  });

  const totalPoints = pointsData?.totalPoints ?? 0;
  const targetPoints = pointsData?.requiredPoints ?? 60;
  const progressPct = Math.min(pointsData?.percentComplete ?? 0, 100);
  const activityCount = records?.length ?? 0;
  const stillNeeded = Math.max(targetPoints - totalPoints, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <SkyHeader style={s.hero}>
        <Text style={s.heroTitle}>CPD points</Text>
        <View style={s.ringRow}>
          <ProgressRing size={86} strokeWidth={11} percent={progressPct}>
            <Text style={s.ringPct}>{Math.round(progressPct)}%</Text>
          </ProgressRing>
          <View style={s.statsRow}>
            <View style={s.statCol}>
              <Text style={s.statValue}>{summaryLoading ? '–' : totalPoints}</Text>
              <Text style={s.statLabel}>earned</Text>
            </View>
            <View style={s.statCol}>
              <Text style={s.statValue}>{recordsLoading ? '–' : activityCount}</Text>
              <Text style={s.statLabel}>activities</Text>
            </View>
            <View style={s.statCol}>
              <Text style={s.statValue}>{summaryLoading ? '–' : stillNeeded}</Text>
              <Text style={s.statLabel}>still needed</Text>
            </View>
          </View>
        </View>
      </SkyHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} tintColor={ACCENT_L} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {years.map((y) => (
            <Chip key={y} label={y === currentYear ? `${y} cycle` : String(y)} active={y === year} onPress={() => setYear(y)} />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <Text style={s.sectionLabel}>Activity</Text>

          {recordsLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={s.rowSkeleton} />)}
            </View>
          ) : !records?.length ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No CPD activity logged for {year} yet.</Text>
            </View>
          ) : (
            <View style={s.card}>
              <FlatList
                data={records}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={s.separator} />}
                renderItem={({ item }) => (
                  <View style={s.activityRow}>
                    <View style={[s.dot, { backgroundColor: ACTIVITY_COLOR[item.activityType] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.activityTitle} numberOfLines={1}>
                        {item.course?.title ?? ACTIVITY_LABEL[item.activityType]}
                      </Text>
                      <Text style={s.activityMeta}>
                        {ACTIVITY_LABEL[item.activityType]} · {formatDate(item.completedAt)}
                      </Text>
                    </View>
                    <Text style={[s.activityPoints, { color: ACTIVITY_COLOR[item.activityType] }]}>
                      +{item.pointsEarned}
                    </Text>
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroTitle: { color: TEXT, fontSize: 24, fontWeight: '800' },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 20 },
  ringPct: { color: TEXT, fontSize: 15, fontWeight: '800' },
  statsRow: { flex: 1, flexDirection: 'row', gap: 10 },
  statCol: { flex: 1 },
  statValue: { color: TEXT, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  sectionLabel: { color: TEXT2, fontSize: 15, fontWeight: '700', marginBottom: 10 },

  card: { backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14 },
  rowSkeleton: { height: 54, backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  emptyCard: { backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 24, alignItems: 'center' },
  emptyText: { color: TEXT3, fontSize: 13, textAlign: 'center' },

  separator: { height: 1, backgroundColor: BORDER },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  activityTitle: { color: TEXT, fontSize: 13.5, fontWeight: '600' },
  activityMeta: { color: TEXT3, fontSize: 11.5, marginTop: 2 },
  activityPoints: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
