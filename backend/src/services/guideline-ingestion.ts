import dns from 'dns/promises';
import net from 'net';
import { PDFParse } from 'pdf-parse';
import { logger } from '../lib/logger';

export type GuidelineSourceType = 'TEXT' | 'HTML' | 'PLAINTEXT' | 'PDF';

export type GuidelineIngestionResult = {
  guidelineText: string;
  sourceType: GuidelineSourceType;
  sourceLabel: string;
  extractedCharacters: number;
  warnings: string[];
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

function getTimeoutMs() {
  const value = Number(process.env.GUIDELINE_FETCH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
}

function getMaxDownloadBytes() {
  const value = Number(process.env.GUIDELINE_MAX_DOWNLOAD_MB ?? DEFAULT_MAX_DOWNLOAD_BYTES / (1024 * 1024));
  return Number.isFinite(value) && value > 0 ? Math.floor(value * 1024 * 1024) : DEFAULT_MAX_DOWNLOAD_BYTES;
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeExtractedText(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const frequencies = new Map<string, number>();
  for (const line of lines) {
    frequencies.set(line, (frequencies.get(line) ?? 0) + 1);
  }

  const filtered = lines.filter((line) => (frequencies.get(line) ?? 0) < 4 || line.length > 120);
  return collapseWhitespace(filtered.join('\n'));
}

function isPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString('utf8') === '%PDF';
}

function isPrivateIpv4(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }

  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
    throw new Error('Local and private network URLs are not allowed');
  }

  const directIpVersion = net.isIP(parsed.hostname);
  if (directIpVersion === 4 && isPrivateIpv4(parsed.hostname)) {
    throw new Error('Private network URLs are not allowed');
  }
  if (directIpVersion === 6 && isPrivateIpv6(parsed.hostname)) {
    throw new Error('Private network URLs are not allowed');
  }

  try {
    const records = await dns.lookup(parsed.hostname, { all: true });
    if (
      records.some((record) =>
        record.family === 4 ? isPrivateIpv4(record.address) : isPrivateIpv6(record.address),
      )
    ) {
      throw new Error('Private network URLs are not allowed');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Private network URLs are not allowed')) {
      throw error;
    }
    logger.warn('DNS lookup failed while validating guideline URL', { url: rawUrl, error: (error as Error).message });
  }

  return parsed;
}

async function fetchDocument(url: string): Promise<{ buffer: Buffer; contentType: string; sourceLabel: string }> {
  const parsed = await assertPublicUrl(url);
  const timeoutMs = getTimeoutMs();
  const maxDownloadBytes = getMaxDownloadBytes();

  const response = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'ZimHealth-CPD-Bot/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Could not fetch URL: HTTP ${response.status}`);
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (declaredLength > maxDownloadBytes) {
    throw new Error(`Source file exceeds ${Math.floor(maxDownloadBytes / (1024 * 1024))} MB limit`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > maxDownloadBytes) {
    throw new Error(`Source file exceeds ${Math.floor(maxDownloadBytes / (1024 * 1024))} MB limit`);
  }

  return {
    buffer,
    contentType: (response.headers.get('content-type') ?? '').toLowerCase(),
    sourceLabel: parsed.toString(),
  };
}

function extractHtmlText(html: string): string {
  return normalizeExtractedText(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(p|div|section|article|li|h\d)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"'),
  );
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text ?? '');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function resolveUploadedFileType(fileName: string | undefined, mimeType: string | undefined): GuidelineSourceType | null {
  const normalizedName = fileName?.toLowerCase() ?? '';
  const normalizedMime = mimeType?.toLowerCase() ?? '';

  if (normalizedMime.includes('application/pdf') || normalizedName.endsWith('.pdf')) return 'PDF';
  if (normalizedMime.includes('text/html') || normalizedName.endsWith('.html') || normalizedName.endsWith('.htm')) return 'HTML';
  if (normalizedMime.startsWith('text/')) return 'PLAINTEXT';
  return null;
}

export async function resolveGuidelineText(input: {
  text?: string;
  url?: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
}): Promise<GuidelineIngestionResult> {
  const directText = input.text?.trim();
  if (directText) {
    const normalized = normalizeExtractedText(directText);
    return {
      guidelineText: normalized,
      sourceType: 'TEXT',
      sourceLabel: 'Pasted text',
      extractedCharacters: normalized.length,
      warnings: [],
    };
  }

  if (input.fileBuffer) {
    const sourceType = resolveUploadedFileType(input.fileName, input.mimeType);
    if (!sourceType) {
      throw new Error('Uploaded guideline file must be PDF, HTML, or plain text');
    }

    let guidelineText = '';
    if (sourceType === 'PDF') {
      guidelineText = await extractPdfText(input.fileBuffer);
      if (guidelineText.length < 100) {
        throw new Error('Uploaded PDF did not contain enough readable text. It may be scanned or image-only.');
      }
    } else if (sourceType === 'HTML') {
      guidelineText = extractHtmlText(input.fileBuffer.toString('utf8'));
    } else {
      guidelineText = normalizeExtractedText(input.fileBuffer.toString('utf8'));
    }

    if (guidelineText.length < 100) {
      throw new Error('Uploaded guideline text must be at least 100 characters after extraction');
    }

    const warnings: string[] = [];
    if (guidelineText.length < 500) {
      warnings.push('Extracted text is quite short. Review the source before generating a course.');
    }

    return {
      guidelineText,
      sourceType,
      sourceLabel: input.fileName?.trim() || 'Uploaded file',
      extractedCharacters: guidelineText.length,
      warnings,
    };
  }

  if (!input.url?.trim()) {
    throw new Error('Provide guideline text or a source URL');
  }

  const { buffer, contentType, sourceLabel } = await fetchDocument(input.url.trim());
  const warnings: string[] = [];

  let sourceType: GuidelineSourceType;
  let guidelineText: string;

  if (contentType.includes('application/pdf') || sourceLabel.toLowerCase().endsWith('.pdf') || isPdfSignature(buffer)) {
    sourceType = 'PDF';
    guidelineText = await extractPdfText(buffer);
    if (guidelineText.length < 100) {
      throw new Error('PDF was fetched but did not contain enough readable text. It may be scanned or image-only.');
    }
  } else if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
    sourceType = 'HTML';
    guidelineText = extractHtmlText(buffer.toString('utf8'));
  } else if (contentType.includes('text/')) {
    sourceType = 'PLAINTEXT';
    guidelineText = normalizeExtractedText(buffer.toString('utf8'));
  } else {
    throw new Error('URL must return HTML, plain text, or PDF content');
  }

  if (guidelineText.length < 100) {
    throw new Error('Guideline text must be at least 100 characters after extraction');
  }

  if (guidelineText.length < 500) {
    warnings.push('Extracted text is quite short. Review the source before generating a course.');
  }

  return {
    guidelineText,
    sourceType,
    sourceLabel,
    extractedCharacters: guidelineText.length,
    warnings,
  };
}
