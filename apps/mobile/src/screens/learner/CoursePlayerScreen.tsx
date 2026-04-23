import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import type { CoursePlayerScreenProps } from '../../navigation/types';

type ContentSection = {
  id: string;
  title: string;
  type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'QUIZ_LINK';
  content: string;
  order: number;
};

type ModuleWithSections = {
  id: string;
  title: string;
  order: number;
  sections: ContentSection[];
};

type EnrollmentProgress = {
  completedSectionIds: string[];
};

export default function CoursePlayerScreen({
  route,
  navigation,
}: CoursePlayerScreenProps) {
  const { enrollmentId, courseId } = route.params;
  const queryClient = useQueryClient();

  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  const { data: modules, isLoading } = useQuery({
    queryKey: ['course-modules', courseId],
    queryFn: () => api.get<ModuleWithSections[]>(`/api/courses/${courseId}/modules`),
  });

  const { data: progress } = useQuery({
    queryKey: ['enrollment-progress', enrollmentId],
    queryFn: () =>
      api.get<EnrollmentProgress>(`/api/enrollments/${enrollmentId}/progress`),
  });

  const completeMutation = useMutation({
    mutationFn: (sectionId: string) =>
      api.post(`/api/enrollments/${enrollmentId}/progress`, { sectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-progress', enrollmentId] });
    },
  });

  if (isLoading || !modules) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['bottom']}>
        <ActivityIndicator color="#14b8a6" size="large" />
      </SafeAreaView>
    );
  }

  const currentModule  = modules[activeModuleIdx];
  const sections       = currentModule?.sections ?? [];
  const currentSection = sections[activeSectionIdx];

  if (!currentModule || !currentSection) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center" edges={['bottom']}>
        <Ionicons name="checkmark-circle" size={64} color="#14b8a6" />
        <Text className="text-xl font-bold text-slate-900 mt-4">Course Complete!</Text>
        <Text className="text-slate-500 text-sm mt-2 text-center px-8">
          All modules done. Your CPD points will be updated shortly.
        </Text>
        <Pressable className="mt-8" onPress={() => navigation.goBack()}>
          <Text className="text-primary-600 font-semibold">Back to course</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const completedIds = progress?.completedSectionIds ?? [];
  const isSectionDone = completedIds.includes(currentSection.id);
  const totalSections = modules.reduce((acc, m) => acc + m.sections.length, 0);
  const totalCompleted = completedIds.length;
  const overallPct = totalSections > 0 ? (totalCompleted / totalSections) * 100 : 0;

  function goNext() {
    if (activeSectionIdx < sections.length - 1) {
      setActiveSectionIdx((i) => i + 1);
    } else if (activeModuleIdx < modules!.length - 1) {
      setActiveModuleIdx((i) => i + 1);
      setActiveSectionIdx(0);
    }
  }

  function goPrev() {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx((i) => i - 1);
    } else if (activeModuleIdx > 0) {
      setActiveModuleIdx((i) => i - 1);
      setActiveSectionIdx((modules![activeModuleIdx - 1]?.sections.length ?? 1) - 1);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      {/* ── Progress bar ── */}
      <View className="h-1.5 bg-slate-100">
        <View className="h-full bg-primary-500" style={{ width: `${overallPct}%` }} />
      </View>

      {/* ── Module / section header ── */}
      <View className="px-4 py-3 border-b border-slate-100">
        <Text className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
          Module {activeModuleIdx + 1}: {currentModule.title}
        </Text>
        <Text className="text-base font-bold text-slate-900 mt-0.5">{currentSection.title}</Text>
        <Text className="text-xs text-slate-400 mt-0.5">
          Section {activeSectionIdx + 1} of {sections.length}
        </Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        className="flex-1 px-5 py-4"
        showsVerticalScrollIndicator={false}
      >
        {currentSection.type === 'TEXT' ? (
          <Text className="text-sm text-slate-700 leading-7">{currentSection.content}</Text>
        ) : currentSection.type === 'VIDEO' ? (
          <View className="bg-slate-900 rounded-2xl h-48 items-center justify-center">
            <Ionicons name="play-circle" size={52} color="white" />
            <Text className="text-white text-xs mt-2 opacity-60">Video content</Text>
          </View>
        ) : (
          <View className="bg-slate-100 rounded-2xl h-48 items-center justify-center">
            <Ionicons name="image-outline" size={40} color="#94a3b8" />
          </View>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* ── Footer navigation ── */}
      <View className="px-4 py-4 border-t border-slate-100 gap-y-3">
        {!isSectionDone && (
          <Button
            label={completeMutation.isPending ? 'Saving…' : 'Mark as Complete'}
            onPress={() => completeMutation.mutate(currentSection.id)}
            loading={completeMutation.isPending}
          />
        )}

        <View className="flex-row gap-x-3">
          <Button
            label="← Prev"
            onPress={goPrev}
            variant="secondary"
            disabled={activeModuleIdx === 0 && activeSectionIdx === 0}
          />
          <Button
            label={
              activeModuleIdx === modules.length - 1 &&
              activeSectionIdx === sections.length - 1
                ? 'Finish'
                : 'Next →'
            }
            onPress={goNext}
            variant={isSectionDone ? 'primary' : 'ghost'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
