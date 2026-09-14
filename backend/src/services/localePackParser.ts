import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

// Parses an uploaded translation file (JSON, CSV, or Excel) into a flat
// { key: translation } map, so adding a new UI language is "upload a file"
// with zero code changes — see backend/src/routes/locales.ts.

function execFilePromise(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
  });
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// and escaped quotes ("") — enough for a two-column key/translation sheet
// without pulling in a dependency for it.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function csvRowsToMap(rows: string[][]): Record<string, string> {
  if (rows.length === 0) return {};
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const keyIdx = header.findIndex((h) => h === 'key');
  const valueIdx = header.findIndex((h) => h === 'translation' || h === 'value');

  if (keyIdx === -1 || valueIdx === -1) {
    throw new Error('CSV must have "key" and "translation" (or "value") columns in the header row.');
  }

  const map: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    const key = row[keyIdx]?.trim();
    const value = row[valueIdx]?.trim();
    if (key) map[key] = value ?? '';
  }
  return map;
}

function jsonToMap(text: string): Record<string, string> {
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON translation file must be a flat object of { "key": "translation" } pairs.');
  }
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`Translation for "${key}" must be a string.`);
    }
    map[key] = value;
  }
  return map;
}

async function convertXlsxToCsv(buffer: Buffer): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `locale-pack-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });
  try {
    const inputPath = path.join(tempDir, 'input.xlsx');
    await fs.writeFile(inputPath, buffer);

    const soffice = process.env.LIBREOFFICE_PATH ?? 'soffice';
    await execFilePromise(soffice, [
      '--headless', '--nologo', '--nolockcheck',
      '--convert-to', 'csv', '--outdir', tempDir, inputPath,
    ]);

    const outputPath = path.join(tempDir, 'input.csv');
    return await fs.readFile(outputPath, 'utf-8');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function parseLocaleFile(buffer: Buffer, originalName: string): Promise<Record<string, string>> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.json') {
    return jsonToMap(buffer.toString('utf-8'));
  }
  if (ext === '.csv') {
    return csvRowsToMap(parseCsv(buffer.toString('utf-8')));
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const csv = await convertXlsxToCsv(buffer);
    return csvRowsToMap(parseCsv(csv));
  }

  throw new Error(`Unsupported file type "${ext}". Upload a .json, .csv, or .xlsx file.`);
}

// Flattens the web app's baseline English translations into "key,translation"
// CSV rows, with the translation column blank — the template a translator
// fills in to produce a new language pack.
export function buildTemplateCsv(baseKeys: Record<string, string>): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ['key,translation'];
  for (const [key, englishValue] of Object.entries(baseKeys)) {
    lines.push(`${escape(key)},${escape(`[EN: ${englishValue}]`)}`);
  }
  return lines.join('\r\n');
}
