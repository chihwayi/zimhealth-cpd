import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api, API_BASE_URL } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  ACCENT_L, SUCCESS, WARN,
} from '../../theme';

type LearnerListResponse = {
  learners: Array<{
    id: string;
    fullName: string;
    cadre: string | null;
    nczRegistrationNumber: string | null;
  }>;
  total: number;
};

type ReviewsResponse = {
  reviews: Array<{ id: string; status: string }>;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CouncilHomeScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ['council-learners-count'],
    queryFn: () => api.get<LearnerListResponse>('/api/ncz/learners?limit=1'),
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['council-reviews-pending'],
    queryFn: () => api.get<ReviewsResponse>('/api/ncz/courses/reviews?limit=50'),
  });

  const pendingCount = reviewsData?.reviews.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting()},</Text>
            <Text style={s.heroName} numberOfLines={1}>
              {user?.fullName?.split(' ')[0] ?? 'Officer'}
            </Text>
            <View style={s.rolePill}>
              <Ionicons name="shield-checkmark-outline" size={11} color="#a855f7" style={{ marginRight: 4 }} />
              <Text style={s.roleText}>Council Officer</Text>
            </View>
          </View>
          <View style={s.heroIcon}>
            <Ionicons name="shield-checkmark" size={26} color="#a855f7" />
          </View>
        </View>

        <View style={s.body}>
          {/* ── Web CTA ── */}
          <Pressable
            style={[s.webCta, { backgroundColor: '#7c3aed' }]}
            onPress={() => void WebBrowser.openBrowserAsync(API_BASE_URL)}
          >
            <View style={s.webCtaLeft}>
              <Ionicons name="desktop-outline" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={s.webCtaTitle}>Open Council Portal</Text>
                <Text style={s.webCtaDesc}>Review courses · Manage learners · Sync certificates</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {/* ── Stats ── */}
          <Text style={s.sectionLabel}>Overview</Text>
          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: `${ACCENT_L}1a` }]}>
                <Ionicons name="people-outline" size={20} color={ACCENT_L} />
              </View>
              <Text style={s.statValue}>
                {learnersLoading ? '…' : (learnersData?.total ?? 0)}
              </Text>
              <Text style={s.statLabel}>Registered Professionals</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statIconWrap, { backgroundColor: `${WARN}1a` }]}>
                <Ionicons name="time-outline" size={20} color={WARN} />
              </View>
              <Text style={[s.statValue, pendingCount > 0 && { color: WARN }]}>
                {reviewsLoading ? '…' : pendingCount}
              </Text>
              <Text style={s.statLabel}>Pending Reviews</Text>
            </View>
          </View>

          {/* ── Quick actions ── */}
          <Text style={s.sectionLabel}>Quick Actions</Text>
          <View style={{ gap: 8 }}>
            {[
              { icon: 'people-outline'        as const, label: 'Manage learners',          path: '/ncz'          },
              { icon: 'document-text-outline' as const, label: 'Review courses',            path: '/ncz/courses'  },
              { icon: 'ribbon-outline'        as const, label: 'Certificate verification',  path: '/verify'       },
              { icon: 'sync-outline'          as const, label: 'Sync logs',                 path: '/ncz/sync'     },
            ].map((item) => (
              <Pressable
                key={item.path}
                style={s.webRow}
                onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}${item.path}`)}
              >
                <View style={[s.webRowIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                  <Ionicons name={item.icon} size={17} color="#a855f7" />
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
    backgroundColor: '#1e0938',
  },
  greeting: { color: '#c084fc', fontSize: 13, fontWeight: '600' },
  heroName: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: 'rgba(168,85,247,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  roleText: { color: '#a855f7', fontSize: 11, fontWeight: '600' },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 18 },

  webCta: {
    borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  webCtaLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  webCtaTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  webCtaDesc:  { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },

  sectionLabel: { color: TEXT2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },

  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 5,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#f8fafc', fontSize: 26, fontWeight: '800' },
  statLabel: { color: TEXT3, fontSize: 12 },

  webRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderRadius: 15, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  webRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  webRowLabel: { flex: 1, color: '#f8fafc', fontSize: 14, fontWeight: '500' },
});
