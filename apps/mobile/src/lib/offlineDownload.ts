import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { api } from './api';
import { saveOfflineAsset, saveOfflineModule } from './offlineDB';

type OfflineSection = {
  id: string;
  type: 'TEXT' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'QUIZ_LINK';
  content: string;
};

type OfflineModule = {
  id: string;
  sections?: OfflineSection[];
};

function assetFileName(url: string): string {
  const clean = url.split('?')[0] ?? url;
  const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.')).slice(0, 12) : '';
  return `${encodeURIComponent(url).replace(/%/g, '_')}${ext}`;
}

async function cacheSectionAsset(section: OfflineSection): Promise<void> {
  if (!['VIDEO', 'DOCUMENT', 'IMAGE'].includes(section.type)) return;
  if (!/^https?:\/\//i.test(section.content)) return;

  const baseRoot = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseRoot) return;

  const baseDir = `${baseRoot}zimhealth-assets/`;
  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true }).catch(() => null);
  const localUri = `${baseDir}${assetFileName(section.content)}`;

  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (!info.exists) {
      await FileSystem.downloadAsync(section.content, localUri);
    }
    await saveOfflineAsset(section.content, localUri, 'ready');
  } catch {
    await saveOfflineAsset(section.content, localUri, 'failed');
  }
}

export async function cacheCourseOffline(courseId: string): Promise<void> {
  const moduleData = await api.get<OfflineModule[]>(`/api/courses/${courseId}/modules`);

  const quizIds = moduleData
    .flatMap((mod) => mod.sections ?? [])
    .filter((section) => section.type === 'QUIZ_LINK' && section.content)
    .map((section) => section.content);

  await Promise.all(
    quizIds.map(async (quizId) => {
      try {
        const quiz = await api.get(`/api/quizzes/${quizId}?offline=1`);
        await saveOfflineModule(`quiz:${quizId}`, quiz);
      } catch {
        // Keep the rest of the offline pack useful if one quiz cannot be cached.
      }
    }),
  );

  await Promise.all(
    moduleData
      .flatMap((mod) => mod.sections ?? [])
      .map((section) => cacheSectionAsset(section)),
  );

  await Promise.all([
    saveOfflineModule(`course:${courseId}`, moduleData),
    ...moduleData.map((mod) => saveOfflineModule(mod.id, mod)),
  ]);
}

export async function shouldWarnForLargeDownload(): Promise<boolean> {
  const netState = await NetInfo.fetch();
  return netState.type === 'cellular';
}
