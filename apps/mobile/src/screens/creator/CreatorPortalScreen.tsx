import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useModal } from '../../context/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api, API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG,
  SUCCESS, SUCCESS_BG, WARN, WARN_BG, DANGER_BG, DANGER,
} from '../../theme';

type CreatorSummary = {
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  avgRating: number;
};

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

const ROLE_LABEL: Record<string, string> = {
  ADMIN:           'Platform Administrator',
  CONTENT_MANAGER: 'Content Creator',
};

export default function CreatorPortalScreen() {
  const { showConfirm } = useModal();
  const user     = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['creator-summary'],
    queryFn: () => api.get<CreatorSummary>('/api/creator/analytics/summary'),
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['creator-courses'],
    queryFn: () => api.get<CoursesResponse>('/api/creator/courses'),
  });
  const courses = coursesData?.courses;

  function handleLogout() {
    showConfirm({
      type: 'danger',
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      onConfirm: () => void clearAuth(),
    });
  }

  const completionPct = summary ? Math.round(summary.completionRate * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.name} numberOfLines={1}>{user?.fullName}</Text>
            <View style={s.rolePill}>
              <Ionicons name="create-outline" size={11} color={ACCENT_L} style={{ marginRight: 4 }} />
              <Text style={s.roleText}>
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
              </Text>
            </View>
          </View>
          <Pressable style={s.logoutBtn} onPress={handleLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={TEXT3} />
          </Pressable>
        </View>

        <View style={s.body}>
          {/* ── Web portal CTA ── */}
          <Pressable
            style={s.webCta}
            onPress={() => void WebBrowser.openBrowserAsync(API_BASE_URL)}
          >
            <View style={s.webCtaLeft}>
              <Ionicons name="desktop-outline" size={22} color="#fff" />
              <View>
                <Text style={s.webCtaTitle}>Open Creator Portal</Text>
                <Text style={s.webCtaDesc}>Build courses, manage media, review submissions</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>

          {/* ── Stats grid ── */}
          <Text style={s.sectionLabel}>Overview</Text>
          {summaryLoading ? (
            <View style={s.statsGrid}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={s.statSkeleton} />)}
            </View>
          ) : (
            <View style={s.statsGrid}>
              {[
                { icon: 'library-outline'       as const, label: 'Courses',       value: summary?.totalCourses ?? 0,        color: ACCENT_L   },
                { icon: 'people-outline'         as const, label: 'Enrollments',   value: summary?.totalEnrollments ?? 0,    color: SUCCESS    },
                { icon: 'checkmark-done-outline' as const, label: 'Completion',    value: `${completionPct}%`,               color: '#a855f7'  },
                { icon: 'star-outline'           as const, label: 'Avg Rating',    value: summary?.avgRating ? summary.avgRating.toFixed(1) : '—', color: WARN },
              ].map((stat) => (
                <View key={stat.label} style={s.statCard}>
                  <View style={[s.statIconWrap, { backgroundColor: `${stat.color}1a` }]}>
                    <Ionicons name={stat.icon} size={20} color={stat.color} />
                  </View>
                  <Text style={s.statValue}>{stat.value}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── My courses ── */}
          <Text style={s.sectionLabel}>My Courses</Text>
          {coursesLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3].map((i) => <View key={i} style={s.rowSkeleton} />)}
            </View>
          ) : !courses || courses.length === 0 ? (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
              <Ionicons name="library-outline" size={36} color={TEXT3} />
              <Text style={[s.statLabel, { marginTop: 10, textAlign: 'center' }]}>
                No courses yet.{'\n'}Use the web portal to create your first course.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {courses.map((course) => (
                <View key={course.id} style={s.courseRow}>
                  <View style={s.courseIconWrap}>
                    <Ionicons name="document-text-outline" size={20} color={ACCENT_L} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.title}</Text>
                    <Text style={s.courseCategory}>{course.category} · {course.cpdPoints} CPD pts</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: `${STATUS_COLOR[course.status] ?? TEXT3}1a` }]}>
                    <Text style={[s.statusText, { color: STATUS_COLOR[course.status] ?? TEXT3 }]}>
                      {course.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Quick links ── */}
          <Text style={s.sectionLabel}>Quick Actions</Text>
          <View style={{ gap: 8 }}>
            {[
              { icon: 'add-circle-outline'  as const, label: 'Create new course',   path: '/creator' },
              { icon: 'analytics-outline'   as const, label: 'View analytics',       path: '/creator/analytics' },
              { icon: 'images-outline'      as const, label: 'Media library',         path: '/creator/media' },
              { icon: 'help-circle-outline' as const, label: 'Quiz builder',           path: '/creator/quizzes' },
            ].map((item) => (
              <Pressable
                key={item.path}
                style={s.quickRow}
                onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.path}`)}
              >
                <View style={s.quickIconWrap}>
                  <Ionicons name={item.icon} size={18} color={ACCENT_L} />
                </View>
                <Text style={s.quickLabel}>{item.label}</Text>
                <Ionicons name="open-outline" size={14} color={TEXT3} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  greeting: { color: TEXT3, fontSize: 13 },
  name: { color: TEXT, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: ACCENT_BG,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
  },
  roleText: { color: ACCENT_L, fontSize: 11, fontWeight: '600' },
  logoutBtn: {
    width: 40, height: 40,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },

  // Web CTA
  webCta: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  webCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  webCtaTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  webCtaDesc:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  sectionLabel: { color: TEXT2, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 6,
  },
  statSkeleton: {
    flex: 1,
    minWidth: '45%',
    height: 90,
    backgroundColor: SURFACE2,
    borderRadius: 18,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue:    { color: TEXT, fontSize: 22, fontWeight: '800' },
  statLabel:    { color: TEXT3, fontSize: 12 },

  // Courses
  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  rowSkeleton: { height: 64, backgroundColor: SURFACE, borderRadius: 16 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  courseIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  courseTitle:    { color: TEXT, fontSize: 13, fontWeight: '600' },
  courseCategory: { color: TEXT3, fontSize: 11, marginTop: 2 },
  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:     { fontSize: 10, fontWeight: '700' },

  // Quick links
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  quickIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: ACCENT_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '500' },
});
