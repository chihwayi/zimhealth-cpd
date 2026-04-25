import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT_L, ACCENT_BG, SUCCESS, WARN, DANGER,
} from '../../theme';

type Course = {
  id: string;
  title: string;
  status: string;
  category: string;
  cpdPoints: number;
  _count?: { enrollments: number };
};

type CoursesResponse = { courses: Course[] };

const STATUS_COLOR: Record<string, string> = {
  PUBLISHED: SUCCESS,
  DRAFT:     WARN,
  PENDING:   '#a855f7',
  REJECTED:  DANGER,
};

export default function CreatorCoursesScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['creator-courses'],
    queryFn: () => api.get<CoursesResponse>('/api/creator/courses'),
  });
  const courses = data?.courses;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>My Courses</Text>
        <Text style={s.subtitle}>Read-only preview · Manage on web</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.body}>
          {isLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={s.skeleton} />)}
            </View>
          ) : !courses || courses.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="library-outline" size={48} color={TEXT3} />
              <Text style={s.emptyTitle}>No courses yet</Text>
              <Text style={s.emptyDesc}>
                Use the web portal to create and publish your first course.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {courses.map((course) => (
                <View key={course.id} style={s.courseCard}>
                  <View style={s.courseTop}>
                    <View style={s.iconWrap}>
                      <Ionicons name="document-text-outline" size={22} color={ACCENT_L} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.courseTitle} numberOfLines={2}>{course.title}</Text>
                      <Text style={s.courseMeta}>{course.category}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: `${STATUS_COLOR[course.status] ?? TEXT3}1a` }]}>
                      <Text style={[s.statusText, { color: STATUS_COLOR[course.status] ?? TEXT3 }]}>
                        {course.status}
                      </Text>
                    </View>
                  </View>
                  <View style={s.divider} />
                  <View style={s.courseStats}>
                    <View style={s.courseStat}>
                      <Ionicons name="people-outline" size={13} color={TEXT3} />
                      <Text style={s.courseStatText}>
                        {course._count?.enrollments ?? 0} enrolled
                      </Text>
                    </View>
                    <View style={s.courseStat}>
                      <Ionicons name="ribbon-outline" size={13} color={TEXT3} />
                      <Text style={s.courseStatText}>{course.cpdPoints} CPD pts</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title:    { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: TEXT3, fontSize: 12, marginTop: 3 },

  body: { paddingHorizontal: 16, paddingTop: 20 },

  skeleton: { height: 100, backgroundColor: SURFACE2, borderRadius: 18, marginBottom: 2 },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '700' },
  emptyDesc:  { color: TEXT3, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  courseCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  courseTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  courseTitle: { color: TEXT, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  courseMeta:  { color: TEXT3, fontSize: 11, marginTop: 3 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText:  { fontSize: 10, fontWeight: '700' },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },

  courseStats: { flexDirection: 'row', gap: 16 },
  courseStat:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  courseStatText: { color: TEXT3, fontSize: 12 },
});
