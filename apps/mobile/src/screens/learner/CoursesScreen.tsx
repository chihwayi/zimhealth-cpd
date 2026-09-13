import { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { cacheCourseOffline, shouldWarnForLargeDownload } from '../../lib/offlineDownload';
import { getCourseDownloadStatus, getOfflineCourseList, saveOfflineCourseList } from '../../lib/offlineDB';
import { useModal } from '../../context/ModalContext';
import type { CoursesListScreenProps } from '../../navigation/types';
import {
  BG, SURFACE, SURFACE2, BORDER, BORDER_FOCUS, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, WARN,
} from '../../theme';

type Course = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  difficulty: string;
  cpdPoints: number;
  estimatedMinutes: number;
  status: string;
  _count?: { modules: number };
};

type Enrollment = { id: string; course: { id: string } };

const CATEGORIES = ['ALL', 'CLINICAL', 'PHARMACOLOGY', 'MATERNAL', 'PAEDIATRICS', 'MENTAL_HEALTH'];

const DIFF_COLOR: Record<string, string> = {
  BEGINNER:     '#22c55e',
  INTERMEDIATE: '#f59e0b',
  ADVANCED:     '#ef4444',
};

export default function CoursesScreen({ navigation }: CoursesListScreenProps) {
  const { showToast } = useModal();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [searchFocused, setSearchFocused] = useState(false);
  const [preparingOffline, setPreparingOffline] = useState(false);
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);

  const { data: courses, isLoading, refetch } = useQuery({
    queryKey: ['courses', category, search],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'PUBLISHED' });
      if (category !== 'ALL') params.set('category', category);
      if (search.trim())      params.set('q', search.trim());
      try {
        const data = await api.get<Course[]>(`/api/courses?${params.toString()}`);
        setUsingOfflineCache(false);
        if (category === 'ALL' && !search.trim()) {
          void saveOfflineCourseList(data);
        }
        return data;
      } catch {
        const cached = await getOfflineCourseList<Course>();
        if (cached.length > 0) {
          setUsingOfflineCache(true);
          return cached.filter((c) => {
            const matchCat = category === 'ALL' || c.category === category;
            const matchQ = !search.trim() || c.title.toLowerCase().includes(search.toLowerCase());
            return matchCat && matchQ;
          });
        }
        setUsingOfflineCache(false);
        return [];
      }
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments-mine'],
    queryFn: () => api.get<Enrollment[]>('/api/enrollments'),
  });

  const { data: offlineStatusByCourse } = useQuery({
    queryKey: ['offline-status-map', enrollments?.map((e) => e.course.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        (enrollments ?? []).map(async (e) => [e.course.id, await getCourseDownloadStatus(e.course.id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, 'downloaded' | 'partial' | 'not_downloaded'>;
    },
    enabled: !!enrollments && enrollments.length > 0,
  });

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      {/* ── Search + offline button ── */}
      <View style={s.searchWrap}>
        <View style={[s.searchBar, searchFocused && s.searchBarFocused]}>
          <Ionicons name="search-outline" size={18} color={TEXT3} />
          <TextInput
            style={s.searchInput}
            placeholder="Search courses…"
            placeholderTextColor={TEXT3}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={TEXT3} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[s.offlineBtn, preparingOffline && s.offlineBtnDisabled]}
          disabled={preparingOffline}
          onPress={async () => {
            const ids = [...new Set((enrollments ?? []).map((e) => e.course.id))];
            if (ids.length === 0) {
              showToast({ message: 'Enroll in a course before preparing an offline pack.', type: 'warning' });
              return;
            }
            setPreparingOffline(true);
            try {
              if (await shouldWarnForLargeDownload()) {
                showToast({ message: 'You are on mobile data. Preparing an offline pack may use a lot of data.', type: 'warning', duration: 4000 });
              }
              for (const id of ids) await cacheCourseOffline(id);
              showToast({ message: 'Offline pack prepared for your enrolled courses.', type: 'success' });
            } catch {
              showToast({ message: 'Could not prepare the full offline pack. Please try again on Wi-Fi.', type: 'danger' });
            } finally {
              setPreparingOffline(false);
            }
          }}
        >
          <Ionicons name="cloud-download-outline" size={16} color={ACCENT_L} />
          <Text style={s.offlineBtnText}>
            {preparingOffline ? 'Preparing…' : 'Offline pack'}
          </Text>
        </Pressable>
      </View>

      {/* ── Category chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {cat === 'ALL' ? 'All' : cat.replace('_', ' ')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {usingOfflineCache && (
        <View style={s.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={13} color={WARN} />
          <Text style={s.offlineNoticeText}>Showing downloaded courses — reconnect for latest</Text>
        </View>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 4 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={s.skeleton} />
          ))}
        </View>
      ) : (
        <FlatList
          data={courses ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="book-outline" size={48} color={TEXT3} />
              <Text style={s.emptyText}>
                No courses found.{'\n'}Try a different search or category.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={s.courseCard}
              onPress={() => navigation.navigate('CourseDetail', { courseId: item.id })}
            >
              <View style={s.courseIconWrap}>
                <Ionicons name="document-text" size={24} color={ACCENT_L} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.courseTitle} numberOfLines={2}>{item.title}</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <View style={s.catTag}>
                    <Text style={s.catTagText}>{item.category}</Text>
                  </View>
                  <View style={[s.diffTag, { backgroundColor: `${DIFF_COLOR[item.difficulty] ?? TEXT3}1a` }]}>
                    <Text style={[s.diffTagText, { color: DIFF_COLOR[item.difficulty] ?? TEXT3 }]}>
                      {item.difficulty}
                    </Text>
                  </View>
                  {offlineStatusByCourse?.[item.id] === 'downloaded' && (
                    <View style={[s.diffTag, { backgroundColor: 'rgba(34,197,94,0.12)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="cloud-done-outline" size={11} color="#22c55e" />
                      <Text style={[s.diffTagText, { color: '#22c55e' }]}>Available offline</Text>
                    </View>
                  )}
                  {offlineStatusByCourse?.[item.id] === 'partial' && (
                    <View style={[s.diffTag, { backgroundColor: 'rgba(245,158,11,0.12)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="cloud-outline" size={11} color={WARN} />
                      <Text style={[s.diffTagText, { color: WARN }]}>Partially offline</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star-outline" size={12} color={TEXT3} />
                    <Text style={s.metaText}>{item.cpdPoints} pts</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={12} color={TEXT3} />
                    <Text style={s.metaText}>{item.estimatedMinutes} min</Text>
                  </View>
                  {item._count?.modules != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="layers-outline" size={12} color={TEXT3} />
                      <Text style={s.metaText}>{item._count.modules} modules</Text>
                    </View>
                  )}
                </View>
              </View>

              <Ionicons name="chevron-forward" size={16} color={TEXT3} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchBarFocused: { borderColor: BORDER_FOCUS, backgroundColor: 'rgba(96,165,250,0.05)' },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },

  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT_BG,
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
  },
  offlineBtnDisabled: { opacity: 0.45 },
  offlineBtnText:     { color: ACCENT_L, fontSize: 13, fontWeight: '600' },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineNoticeText: { color: '#f59e0b', fontSize: 11, fontWeight: '600', flex: 1 },

  // Chips
  chip: {
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  chipActive:     { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText:       { color: TEXT2, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // Skeleton
  skeleton: { height: 90, backgroundColor: SURFACE, borderRadius: 18 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { color: TEXT3, fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 20 },

  // Course card
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  courseIconWrap: {
    width: 52, height: 52,
    borderRadius: 16,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  courseTitle: { color: TEXT, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  catTag: {
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catTagText:  { color: ACCENT_L, fontSize: 10, fontWeight: '700' },
  diffTag: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  diffTagText: { fontSize: 10, fontWeight: '700' },
  metaText:    { color: TEXT3, fontSize: 11 },
});
