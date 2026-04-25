import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api, API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT, ACCENT_L, ACCENT_BG, SUCCESS, WARN,
} from '../../theme';

type CreatorSummary = {
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  avgRating: number;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN:           'Platform Administrator',
  CONTENT_MANAGER: 'Content Creator',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CreatorHomeScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['creator-summary'],
    queryFn: () => api.get<CreatorSummary>('/api/creator/analytics/summary'),
  });

  const completionPct = summary ? Math.round(summary.completionRate * 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting()},</Text>
            <Text style={s.heroName} numberOfLines={1}>
              {user?.fullName?.split(' ')[0] ?? 'Creator'}
            </Text>
            <View style={s.rolePill}>
              <Ionicons name="create-outline" size={11} color={ACCENT_L} style={{ marginRight: 4 }} />
              <Text style={s.roleText}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</Text>
            </View>
          </View>
          <View style={s.heroIcon}>
            <Ionicons name="create" size={26} color={ACCENT_L} />
          </View>
        </View>

        <View style={s.body}>
          {/* ── Web CTA ── */}
          <Pressable
            style={s.webCta}
            onPress={() => void WebBrowser.openBrowserAsync(API_BASE_URL)}
          >
            <View style={s.webCtaLeft}>
              <Ionicons name="desktop-outline" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={s.webCtaTitle}>Open Creator Portal</Text>
                <Text style={s.webCtaDesc}>Build courses · Upload media · Manage quizzes</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {/* ── Stats ── */}
          <Text style={s.sectionLabel}>Your Stats</Text>
          {isLoading ? (
            <View style={s.statsGrid}>
              {[1, 2, 3, 4].map((i) => <View key={i} style={s.statSkeleton} />)}
            </View>
          ) : (
            <View style={s.statsGrid}>
              {[
                { icon: 'library-outline' as const,        label: 'Courses',       value: summary?.totalCourses ?? 0,     color: ACCENT_L  },
                { icon: 'people-outline' as const,          label: 'Enrollments',   value: summary?.totalEnrollments ?? 0, color: SUCCESS   },
                { icon: 'checkmark-done-outline' as const,  label: 'Completion',    value: `${completionPct}%`,            color: '#a855f7' },
                { icon: 'star-outline' as const,            label: 'Avg Rating',    value: summary?.avgRating?.toFixed(1) ?? '—', color: WARN },
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

          {/* ── What stays on web ── */}
          <Text style={s.sectionLabel}>Manage on Web</Text>
          <View style={{ gap: 8 }}>
            {[
              { icon: 'add-circle-outline' as const,  label: 'Create a new course',    path: '/creator'           },
              { icon: 'pencil-outline' as const,       label: 'Edit course content',     path: '/creator/courses'   },
              { icon: 'images-outline' as const,       label: 'Media library',           path: '/creator/media'     },
              { icon: 'help-circle-outline' as const,  label: 'Quiz builder',            path: '/creator/quizzes'   },
              { icon: 'analytics-outline' as const,    label: 'Detailed analytics',      path: '/creator/analytics' },
            ].map((item) => (
              <Pressable
                key={item.path}
                style={s.webRow}
                onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.path}`)}
              >
                <View style={s.webRowIcon}>
                  <Ionicons name={item.icon} size={17} color={ACCENT_L} />
                </View>
                <Text style={s.webRowLabel}>{item.label}</Text>
                <Ionicons name="open-outline" size={13} color={TEXT3} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#172554',
  },
  greeting: { color: ACCENT_L, fontSize: 13, fontWeight: '600' },
  heroName:  { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroIcon:  { width: 52, height: 52, borderRadius: 18, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center' },
  rolePill:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, backgroundColor: ACCENT_BG, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)' },
  roleText:  { color: ACCENT_L, fontSize: 11, fontWeight: '600' },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 18 },

  webCta: { backgroundColor: ACCENT, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: ACCENT, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  webCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  webCtaTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  webCtaDesc:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  sectionLabel: { color: TEXT2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },

  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     { flex: 1, minWidth: '45%', backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 5 },
  statSkeleton: { flex: 1, minWidth: '45%', height: 90, backgroundColor: SURFACE2, borderRadius: 18 },
  statIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue:    { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  statLabel:    { color: TEXT3, fontSize: 12 },

  webRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderRadius: 15, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12 },
  webRowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: ACCENT_BG, alignItems: 'center', justifyContent: 'center' },
  webRowLabel: { flex: 1, color: '#f8fafc', fontSize: 14, fontWeight: '500' },
});
