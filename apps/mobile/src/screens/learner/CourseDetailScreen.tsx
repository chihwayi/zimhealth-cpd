import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import type { CourseDetailScreenProps } from '../../navigation/types';

type Module = {
  id: string;
  title: string;
  order: number;
  _count?: { sections: number };
};

type CourseDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string;
  difficulty: string;
  cpdPoints: number;
  estimatedMinutes: number;
  modules: Module[];
  _count?: { enrollments: number };
};

type Enrollment = {
  id: string;
  completedAt: string | null;
  courseId: string;
};

export default function CourseDetailScreen({ route, navigation }: CourseDetailScreenProps) {
  const { courseId } = route.params;
  const queryClient = useQueryClient();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get<CourseDetail>(`/api/courses/${courseId}`),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments-mine'],
    queryFn: () => api.get<Enrollment[]>('/api/enrollments'),
  });

  const enrollment = enrollments?.find((e) => e.courseId === courseId);

  const enrollMutation = useMutation({
    mutationFn: () => api.post<Enrollment>('/api/enrollments', { courseId }),
    onSuccess: (newEnrollment) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments-mine'] });
      navigation.navigate('CoursePlayer', {
        enrollmentId: newEnrollment.id,
        courseId,
      });
    },
  });

  if (isLoading || !course) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-slate-400">Loading course…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero banner ── */}
        <View className="bg-primary-500 px-5 pt-4 pb-8">
          <View className="flex-row gap-x-2 mb-3">
            <Badge label={course.category} variant="white" />
            <Badge label={course.difficulty} variant="white" />
          </View>
          <Text className="text-white text-2xl font-bold leading-tight">{course.title}</Text>
          {course.subtitle && (
            <Text className="text-primary-200 text-sm mt-2">{course.subtitle}</Text>
          )}
        </View>

        <View className="px-4 -mt-4 gap-y-4 pb-10">
          {/* ── Stats row ── */}
          <Card className="flex-row justify-around py-4">
            {[
              { icon: 'star-outline'   as const, label: `${course.cpdPoints} CPD pts`           },
              { icon: 'time-outline'   as const, label: `${course.estimatedMinutes} min`          },
              { icon: 'layers-outline' as const, label: `${course.modules.length} modules`        },
              { icon: 'people-outline' as const, label: `${course._count?.enrollments ?? 0} enrolled` },
            ].map((s) => (
              <View key={s.label} className="items-center gap-y-1">
                <Ionicons name={s.icon} size={20} color="#0d9488" />
                <Text className="text-xs font-semibold text-slate-700">{s.label}</Text>
              </View>
            ))}
          </Card>

          {/* ── Description ── */}
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">About this course</Text>
            <Text className="text-sm text-slate-600 leading-6">{course.description}</Text>
          </View>

          {/* ── Modules list ── */}
          <View>
            <Text className="text-sm font-bold text-slate-900 mb-2">
              Course modules ({course.modules.length})
            </Text>
            <View className="gap-y-2">
              {course.modules.map((mod, idx) => (
                <View
                  key={mod.id}
                  className="flex-row items-center bg-slate-50 rounded-2xl px-4 py-3.5 border border-slate-100"
                >
                  <View className="h-7 w-7 bg-primary-100 rounded-full items-center justify-center mr-3">
                    <Text className="text-primary-700 text-xs font-bold">{idx + 1}</Text>
                  </View>
                  <Text className="flex-1 text-sm font-medium text-slate-800">{mod.title}</Text>
                  {mod._count?.sections != null && (
                    <Text className="text-xs text-slate-400">{mod._count.sections} sections</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── CTA ── */}
          {enrollment ? (
            <Button
              label={enrollment.completedAt ? '✅ Completed — Review' : '▶  Continue Learning'}
              onPress={() =>
                navigation.navigate('CoursePlayer', {
                  enrollmentId: enrollment.id,
                  courseId,
                })
              }
            />
          ) : (
            <Button
              label="Enrol Now — Free"
              onPress={() => enrollMutation.mutate()}
              loading={enrollMutation.isPending}
            />
          )}

          <Pressable className="items-center" onPress={() => { /* Sprint 3: offline download */ }}>
            <View className="flex-row items-center gap-x-1.5">
              <Ionicons name="cloud-download-outline" size={16} color="#0d9488" />
              <Text className="text-primary-600 text-sm font-medium">Download for offline use</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
