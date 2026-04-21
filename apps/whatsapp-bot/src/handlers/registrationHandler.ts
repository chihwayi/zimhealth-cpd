import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';
import { TEMPLATES } from '../templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

const botHeaders = {
  'Content-Type': 'application/json',
  'x-bot-secret': BOT_SECRET,
};

// ─── Cadre options displayed during registration ──────────────────────────────
const CADRE_OPTIONS = [
  { key: 'REGISTERED_GENERAL_NURSE', label: 'Registered General Nurse (RGN)' },
  { key: 'REGISTERED_MIDWIFE', label: 'Registered Midwife' },
  { key: 'ENROLLED_NURSE', label: 'Enrolled Nurse' },
  { key: 'ENROLLED_MIDWIFE', label: 'Enrolled Midwife' },
  { key: 'COMMUNITY_HEALTH_NURSE', label: 'Community Health Nurse' },
  { key: 'MENTAL_HEALTH_NURSE', label: 'Mental Health Nurse' },
  { key: 'CLINICAL_NURSE_SPECIALIST', label: 'Clinical Nurse Specialist' },
  { key: 'NURSE_PRACTITIONER', label: 'Nurse Practitioner' },
] as const;

function cadrePicker(): string {
  const lines = CADRE_OPTIONS.map((c, i) => `${i + 1}️⃣ ${c.label}`).join('\n');
  return `What is your nursing cadre?\n\n${lines}\n\n_Reply with a number (1–${CADRE_OPTIONS.length})._`;
}

// ─── Main registration handler ─────────────────────────────────────────────────
export async function handleRegistration(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim();
  const lower = text.toLowerCase();

  // Allow global exit at any point
  if (['menu', 'cancel', 'exit'].includes(lower)) {
    delete session.registrationState;
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
    return;
  }

  const rs = session.registrationState;

  // ── Kick off: no state yet ──
  if (!rs) {
    session.registrationState = { step: 'NAME' };
    session.state = 'AWAITING_REGISTRATION';
    await saveSession(session);
    await sendMessage(
      msg.from,
      `👋 *Welcome to NursePro CPD!*\n\nLet's create your account in a few quick steps.\n\nFirst, what is your *full name*? (e.g. Mary Chikwanda)\n\n_Reply *cancel* at any time to exit._`,
    );
    return;
  }

  // ── NAME step: collect full name ──
  if (rs.step === 'NAME') {
    if (text.length < 3) {
      await sendMessage(msg.from, 'Please enter your full name (at least 3 characters).');
      return;
    }
    rs.fullName = text;
    rs.step = 'CADRE';
    await saveSession(session);
    await sendMessage(msg.from, cadrePicker());
    return;
  }

  // ── CADRE step: pick nursing cadre ──
  if (rs.step === 'CADRE') {
    const idx = parseInt(text, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= CADRE_OPTIONS.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${CADRE_OPTIONS.length}.`);
      return;
    }
    rs.cadre = CADRE_OPTIONS[idx].key;
    rs.step = 'NCZ';
    await saveSession(session);
    await sendMessage(
      msg.from,
      `What is your *NCZ registration number*?\n\n_Reply *skip* if you don't have one yet._`,
    );
    return;
  }

  // ── NCZ step: registration number (optional) ──
  if (rs.step === 'NCZ') {
    rs.nczRegistrationNumber = lower === 'skip' ? undefined : text;
    rs.step = 'INSTITUTION';
    await saveSession(session);
    await sendMessage(msg.from, `Which *hospital or clinic* do you work at?\n\n_E.g. Parirenyatwa Hospital, Sally Mugabe Hospital_`);
    return;
  }

  // ── INSTITUTION step: workplace ──
  if (rs.step === 'INSTITUTION') {
    if (text.length < 2) {
      await sendMessage(msg.from, 'Please enter your workplace name.');
      return;
    }
    rs.institution = text;
    rs.step = 'CONFIRM';
    await saveSession(session);

    const cadreName = CADRE_OPTIONS.find((c) => c.key === rs.cadre)?.label ?? rs.cadre;
    await sendMessage(
      msg.from,
      `📋 *Review your details:*\n\n👤 Name: *${rs.fullName}*\n🏥 Cadre: *${cadreName}*\n🔖 NCZ No: *${rs.nczRegistrationNumber ?? 'Not provided'}*\n🏨 Workplace: *${rs.institution}*\n\nReply *yes* to confirm and create your account, or *no* to start over.`,
    );
    return;
  }

  // ── CONFIRM step: create the account ──
  if (rs.step === 'CONFIRM') {
    if (lower === 'no') {
      session.registrationState = { step: 'NAME' };
      await saveSession(session);
      await sendMessage(msg.from, `No problem! Let's start over.\n\nWhat is your *full name*?`);
      return;
    }

    if (lower !== 'yes') {
      await sendMessage(msg.from, `Reply *yes* to create your account or *no* to start over.`);
      return;
    }

    // Call the API to create the account
    try {
      const phone = msg.from.replace('whatsapp:', '');
      const body = {
        phone,
        fullName: rs.fullName,
        cadre: rs.cadre,
        nczRegistrationNumber: rs.nczRegistrationNumber,
        institution: rs.institution,
      };

      const res = await fetch(`${API_URL}/api/bot/register`, {
        method: 'POST',
        headers: botHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = (await res.json()) as { userId: string; fullName: string; existing: boolean };

      session.userId = data.userId;
      delete session.registrationState;
      session.state = 'MENU';
      await saveSession(session);

      const greeting = data.existing
        ? `Welcome back, *${data.fullName}*! Your account is already set up.`
        : `🎉 Account created, *${data.fullName}*! Welcome to NursePro CPD.`;

      await sendMessage(msg.from, `${greeting}\n\n${TEMPLATES.MAIN_MENU}`);
    } catch {
      await sendMessage(
        msg.from,
        `⚠️ Registration failed. Please try again or visit ${process.env.WEB_URL ?? 'https://nursepro.co.zw'}/register\n\nReply *cancel* to go back to the menu.`,
      );
    }
    return;
  }
}
