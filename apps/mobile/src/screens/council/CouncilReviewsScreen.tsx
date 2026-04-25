import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api, API_BASE_URL } from '../../lib/api';
import {
  BG, SURFACE, SURFACE2, BORDER, TEXT, TEXT2, TEXT3,
  SUCCESS, WARN, DANGER, ACCENT_L,
} from '../../theme';

type ReviewsResponse = {
  reviews: Array<{
    id: string;
    status: string;
    course: { id: string; title: string; category: string };
    reviewedBy: { fullName: string } | null;
  }>;
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: SUCCESS,
  PENDING:  WARN,
  REJECTED: DANGER,
};

export default function CouncilReviewsScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['council-reviews-list'],
    queryFn: () => api.get<ReviewsResponse>('/api/ncz/courses/reviews?limit=50'),
  });
  const reviews = data?.reviews ?? [];
  const pending  = reviews.filter((r) => r.status === 'PENDING');
  const rest     = reviews.filter((r) => r.status !== 'PENDING');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Course Reviews</Text>
          <Text style={s.subtitle}>Read-only preview · Review on web</Text>
        </View>
        {pending.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.body}>

          {/* ── Web CTA ── */}
          <Pressable
            style={s.webCta}
            onPress={() => void WebBrowser.openBrowserAsync(`${API_BASE_URL}/ncz/courses`)}
          >
            <View style={s.webCtaLeft}>
              <Ionicons name="desktop-outline" size={18} color="#fff" />
              <Text style={s.webCtaText}>Review courses on the web portal</Text>
            </View>
            <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.6)" />
          </Pressable>

          {isLoading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3].map((i) => <View key={i} style={s.skeleton} />)}
            </View>
          ) : reviews.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={SUCCESS} />
              <Text style={s.emptyTitle}>All clear</Text>
              <Text style={s.emptyDesc}>No course reviews at the moment.</Text>
            </View>
          ) : (
            <>
              {pending.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>Pending ({pending.length})</Text>
                  <View style={{ gap: 8 }}>
                    {pending.map((review) => (
                      <ReviewRow key={review.id} review={review} />
                    ))}
                  </View>
                </>
              )}

              {rest.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>Recently Reviewed</Text>
                  <View style={{ gap: 8 }}>
                    {rest.map((review) => (
                      <ReviewRow key={review.id} review={review} />
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewRow({ review }: {
  review: {
    id: string; status: string;
    course: { id: string; title: string; category: string };
    reviewedBy: { fullName: string } | null;
  };
}) {
  const color = STATUS_COLOR[review.status] ?? TEXT3;
  return (
    <View style={rs.row}>
      <View style={rs.iconWrap}>
        <Ionicons name="document-text-outline" size={18} color="#a855f7" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rs.courseTitle} numberOfLines={1}>{review.course.title}</Text>
        <Text style={rs.courseCat}>{review.course.category}</Text>
        {review.reviewedBy && (
          <Text style={rs.reviewer}>Reviewed by {review.reviewedBy.fullName}</Text>
        )}
      </View>
      <View style={[rs.statusBadge, { backgroundColor: `${color}1a` }]}>
        <Text style={[rs.statusText, { color }]}>{review.status}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  title:    { color: '#f8fafc', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: TEXT3, fontSize: 12, marginTop: 3 },
  badge: {
    minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: WARN,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#000', fontSize: 12, fontWeight: '800' },

  body: { paddingHorizontal: 16, paddingTop: 20, gap: 18 },

  webCta: {
    backgroundColor: '#7c3aed', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  webCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  webCtaText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: TEXT2, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },

  skeleton: { height: 80, backgroundColor: SURFACE2, borderRadius: 16 },

  empty: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 10,
  },
  emptyTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  emptyDesc:  { color: TEXT3, fontSize: 13, textAlign: 'center' },
});

const rs = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  courseTitle: { color: TEXT, fontSize: 13, fontWeight: '600' },
  courseCat:   { color: TEXT3, fontSize: 11, marginTop: 2 },
  reviewer:    { color: TEXT3, fontSize: 10, marginTop: 3 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText:  { fontSize: 10, fontWeight: '700' },
});
