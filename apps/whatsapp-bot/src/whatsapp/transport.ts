import twilio from 'twilio';

export type WhatsAppProvider = 'meta' | '360dialog' | 'twilio';

function provider(): WhatsAppProvider {
  const p = (process.env.WHATSAPP_PROVIDER ?? 'twilio').toLowerCase();
  if (p === 'meta') return 'meta';
  if (p === '360dialog' || p === 'd360') return '360dialog';
  return 'twilio';
}

function ensureWhatsappPrefix(to: string): string {
  return to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
}

function stripWhatsappPrefix(from: string): string {
  return from.startsWith('whatsapp:') ? from.slice('whatsapp:'.length) : from;
}

// ─── Sending ──────────────────────────────────────────────────────────────────

export async function sendMessage(to: string, body: string): Promise<void> {
  const p = provider();
  if (p === 'meta') return sendViaMeta(to, body);
  if (p === '360dialog') return sendVia360Dialog(to, body);
  return sendViaTwilio(to, body);
}

export async function sendMediaMessage(to: string, body: string, mediaUrl: string): Promise<void> {
  const p = provider();
  if (p === 'meta') return sendViaMeta(to, body, mediaUrl);
  if (p === '360dialog') return sendVia360Dialog(to, body, mediaUrl);
  return sendViaTwilio(to, body, mediaUrl);
}

async function sendViaTwilio(to: string, body: string, mediaUrl?: string): Promise<void> {
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
  const toFormatted = ensureWhatsappPrefix(to);

  const client = SID && TOKEN ? twilio(SID, TOKEN) : null;
  if (!client || !FROM_NUMBER) {
    console.log(`[Bot][twilio] to=${toFormatted}${mediaUrl ? ` media=${mediaUrl}` : ''}\n${body}`);
    return;
  }

  await client.messages.create({
    from: FROM_NUMBER,
    to: toFormatted,
    body,
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  });
}

async function sendViaMeta(to: string, body: string, mediaUrl?: string): Promise<void> {
  const token = process.env.META_WA_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.log(`[Bot][meta] to=${to}${mediaUrl ? ` media=${mediaUrl}` : ''}\n${body}`);
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  const toNumber = stripWhatsappPrefix(to).replace(/^\+/, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    to: toNumber,
    ...(body ? { text: { body } } : undefined),
  };

  // Minimal media support: send as link if present (keeps it simple).
  // If you want richer types (image/audio/document), we can add MIME-based switching.
  if (mediaUrl) {
    payload.text = { body: body ? `${body}\n\n${mediaUrl}` : mediaUrl };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Meta send failed (${res.status}): ${txt}`);
  }
}

async function sendVia360Dialog(to: string, body: string, mediaUrl?: string): Promise<void> {
  const apiKey = process.env.D360_API_KEY;
  const baseUrl = process.env.D360_BASE_URL ?? 'https://waba.360dialog.io';
  if (!apiKey) {
    console.log(`[Bot][360dialog] to=${to}${mediaUrl ? ` media=${mediaUrl}` : ''}\n${body}`);
    return;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const toNumber = stripWhatsappPrefix(to).replace(/^\+/, '');

  const payload: any = {
    to: toNumber,
    type: 'text',
    text: { body: mediaUrl ? (body ? `${body}\n\n${mediaUrl}` : mediaUrl) : body },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'D360-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`360dialog send failed (${res.status}): ${txt}`);
  }
}

// ─── Incoming webhook parsing ────────────────────────────────────────────────

export type IncomingProviderMessage =
  | { provider: 'twilio'; from: string; body: string; profileName?: string }
  | { provider: 'meta' | '360dialog'; from: string; body: string };

export function parseIncoming(body: any, headers: Record<string, unknown>): IncomingProviderMessage | null {
  // Twilio form payload (From, Body)
  if (typeof body?.From === 'string' && typeof body?.Body === 'string') {
    return { provider: 'twilio', from: body.From, body: body.Body, profileName: body.ProfileName };
  }

  // Meta Cloud API / 360dialog webhook structure (very similar)
  // Expect: entry[0].changes[0].value.messages[0].from and .text.body
  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = msg?.from;
  const text = msg?.text?.body;
  if (typeof from === 'string' && typeof text === 'string') {
    const normalizedFrom = from.startsWith('+') ? `whatsapp:${from}` : `whatsapp:+${from}`;
    const ua = String((headers['user-agent'] ?? '') as any).toLowerCase();
    const p: 'meta' | '360dialog' = ua.includes('360dialog') ? '360dialog' : 'meta';
    return { provider: p, from: normalizedFrom, body: text };
  }

  return null;
}

