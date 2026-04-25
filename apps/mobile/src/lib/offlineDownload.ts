import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { api } from './api';
import {
  getOfflineAsset,
  saveOfflineAsset,
  saveOfflineCourseDetail,
  saveOfflineCourseList,
  saveOfflineModule,
} from './offlineDB';

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
  if (!baseRoot) throw new Error('No writable directory available on this device.');
  const baseDir = `${baseRoot}zimhealth-assets/`;
  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true }).catch(() => null);
  const localUri = `${baseDir}${assetFileName(section.content)}`;

  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists && (info as { size?: number }).size && (info as { size?: number }).size! > 0) {
    await saveOfflineAsset(section.content, localUri, 'ready');
    return;
  }

  const existing = await getOfflineAsset(section.content);
  const resumeData = existing?.resumeData;

  const downloadResumable = FileSystem.createDownloadResumable(
    section.content,
    localUri,
    {},
    undefined,
    resumeData,
  );

  try {
    await downloadResumable.downloadAsync();
    await saveOfflineAsset(section.content, localUri, 'ready');
  } catch {
    try {
      const pauseState = await downloadResumable.pauseAsync();
      await saveOfflineAsset(section.content, localUri, 'failed', pauseState.resumeData);
    } catch {
      await saveOfflineAsset(section.content, localUri, 'failed');
    }
  }
}

export async function cacheCourseOffline(courseId: string): Promise<void> {
  try {
    const detail = await api.get<unknown>(`/api/courses/${courseId}`);
    await saveOfflineCourseDetail(courseId, detail);
    await saveOfflineCourseList([detail]);
  } catch {
    // Non-fatal: modules and assets can still be saved.
  }

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
        // Non-fatal — the quiz will fall back to server fetch when online.
      }
    }),
  );

  for (const section of moduleData.flatMap((mod) => mod.sections ?? [])) {
    await cacheSectionAsset(section);
  }

  await Promise.all([
    saveOfflineModule(`course:${courseId}`, moduleData),
    ...moduleData.map((mod) => saveOfflineModule(mod.id, mod)),
  ]);
}

export async function retryFailedDownloads(courseId: string): Promise<void> {
  const modules = await import('./offlineDB').then((db) =>
    db.getOfflineModule<OfflineModule[]>(`course:${courseId}`),
  );
  if (!modules) return;

  const sections = modules.flatMap((m) => m.sections ?? []);
  const toRetry: OfflineSection[] = [];

  for (const section of sections) {
    if (!['VIDEO', 'DOCUMENT', 'IMAGE'].includes(section.type)) continue;
    if (!/^https?:\/\//i.test(section.content)) continue;
    const asset = await getOfflineAsset(section.content);
    if (!asset || asset.status !== 'ready') {
      toRetry.push(section);
    }
  }

  for (const section of toRetry) {
    await cacheSectionAsset(section);
  }
}

export async function shouldWarnForLargeDownload(): Promise<boolean> {
  const netState = await NetInfo.fetch();
  return netState.type === 'cellular';
}
