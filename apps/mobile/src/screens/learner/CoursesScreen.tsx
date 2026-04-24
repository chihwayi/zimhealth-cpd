import { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { cacheCourseOffline, shouldWarnForLargeDownload } from '../../lib/offlineDownload';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import type { CoursesListScreenProps } from '../../navigation/types';

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

type Enrollment = {
  courseId: string;
};

const CATEGORIES = ['ALL', 'CLINICAL', 'PHARMACOLOGY', 'MATERNAL', 'PAEDIATRICS', 'MENTAL_HEALTH'];

const DIFF_COLOUR: Record<string, 'teal' | 'amber' | 'red'> = {
  BEGINNER:     'teal',
  INTERMEDIATE: 'amber',
  ADVANCED:     'red',
};

export default function CoursesScreen({ navigation }: CoursesListScreenProps) {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('ALL');
  const [preparingOffline, setPreparingOffline] = useState(false);

  const { data: courses, isLoading, refetch } = useQuery({
    queryKey: ['courses', category, search],
    queryFn:  () => {
      const params = new URLSearchParams({ status: 'PUBLISHED' });
      if (category !== 'ALL') params.set('category', category);
      if (search.trim())      params.set('q', search.trim());
      return api.get<Course[]>(`/api/courses?${params.toString()}`);
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments-mine'],
    queryFn: () => api.get<Enrollment[]>('/api/enrollments'),
  });

  const filtered = courses ?? [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      {/* ── Search ── */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-white border border-slate-200 rounded-2xl px-4 py-3 gap-x-2">
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            className="flex-1 text-sm text-slate-900"
            placeholder="Search courses…"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>
        <Pressable
          className="mt-3 flex-row items-center justify-center gap-x-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 disabled:opacity-50"
          disabled={preparingOffline}
          onPress={async () => {
            const enrolledCourseIds = [...new Set((enrollments ?? []).map((entry) => entry.courseId))];
            if (enrolledCourseIds.length === 0) {
              alert('Enroll in a course before preparing an offline pack.');
              return;
            }

            setPreparingOffline(true);
            try {
              if (await shouldWarnForLargeDownload()) {
                alert('You are on mobile data. Preparing an offline pack may use a lot of data.');
              }
              for (const enrolledCourseId of enrolledCourseIds) {
                await cacheCourseOffline(enrolledCourseId);
              }
              alert('Offline pack prepared for your enrolled courses.');
            } catch {
              alert('Could not prepare the full offline pack. Please try again on Wi-Fi.');
            } finally {
              setPreparingOffline(false);
            }
          }}
        >
          <Ionicons name="cloud-download-outline" size={17} color="#2563eb" />
          <Text className="text-primary-700 text-sm font-semibold">
            {preparingOffline ? 'Preparing offline pack…' : 'Prepare offline pack'}
          </Text>
        </Pressable>
      </View>

      {/* ── Category chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 border
              ${category === cat
                ? 'bg-primary-500 border-primary-500'
                : 'bg-white border-slate-200'}`}
          >
            <Text
              className={`text-xs font-semibold
                ${category === cat ? 'text-white' : 'text-slate-600'}`}
            >
              {cat === 'ALL' ? 'All' : cat.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── List ── */}
      {isLoading ? (
        <View className="flex-1 px-4 gap-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <View key={i} className="h-28 bg-slate-200 rounded-3xl" />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={isLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="book-outline" size={48} color="#cbd5e1" />
              <Text className="text-slate-400 text-sm mt-3 text-center">
                No courses found.{'\n'}Try a different search or category.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('CourseDetail', { courseId: item.id })}
            >
              <Card className="flex-row gap-x-4 items-start">
                {/* Icon placeholder */}
                <View className="h-14 w-14 bg-primary-100 rounded-2xl items-center justify-center shrink-0">
                  <Ionicons name="document-text" size={24} color="#2563eb" />
                </View>

                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 leading-5" numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    <Badge label={item.category} variant="teal" />
                    <Badge
                      label={item.difficulty}
                      variant={DIFF_COLOUR[item.difficulty] ?? 'slate'}
                    />
                  </View>

                  <View className="flex-row items-center gap-x-3 mt-2">
                    <View className="flex-row items-center gap-x-1">
                      <Ionicons name="star-outline" size={12} color="#94a3b8" />
                      <Text className="text-xs text-slate-400">{item.cpdPoints} pts</Text>
                    </View>
                    <View className="flex-row items-center gap-x-1">
                      <Ionicons name="time-outline" size={12} color="#94a3b8" />
                      <Text className="text-xs text-slate-400">{item.estimatedMinutes} min</Text>
                    </View>
                    {item._count?.modules != null && (
                      <View className="flex-row items-center gap-x-1">
                        <Ionicons name="layers-outline" size={12} color="#94a3b8" />
                        <Text className="text-xs text-slate-400">{item._count.modules} modules</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
