import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../whatsapp/transport';
import { TEMPLATES } from '../templates';
import { detectCountryFromPhone } from '../utils/phoneCountry';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

const botHeaders = {
  'Content-Type': 'application/json',
  'x-bot-secret': BOT_SECRET,
};

type CouncilOption = { id: string; name: string; acronym: string; countryCode: string };

// Country detected from the nurse's own WhatsApp number — no need to ask.
// If multiple councils exist in that country, we still ask which one (a
// country can have several regulatory councils, e.g. Zimbabwe's NCZ/PCZ/
// MDPCZ), but never ask the nurse to pick a country by hand.
async function getCouncilsForPhone(phone: string): Promise<CouncilOption[]> {
  const country = detectCountryFromPhone(phone);
  if (!country) return [];
  try {
    const res = await fetch(`${API_URL}/api/councils`);
    if (!res.ok) return [];
    const data = (await res.json()) as { councils: CouncilOption[] };
    return data.councils.filter((c) => c.countryCode === country);
  } catch {
    return [];
  }
}

function councilPicker(options: CouncilOption[]): string {
  const lines = options.map((c, i) => `${i + 1}️⃣ ${c.acronym} - ${c.name}`).join('\n');
  return `Which council are you registered with?\n\n${lines}\n\n_Reply with a number (1–${options.length})._`;
}

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
  return `What is your professional cadre?\n\n${lines}\n\n_Reply with a number (1–${CADRE_OPTIONS.length})._`;
}

// ─── Language options ──────────────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
  { key: 'ENGLISH', label: 'English' },
  { key: 'SHONA', label: 'Shona' },
  { key: 'NDEBELE', label: 'Ndebele' },
] as const;

function languagePicker(): string {
  const lines = LANGUAGE_OPTIONS.map((l, i) => `${i + 1}️⃣ ${l.label}`).join('\n');
  return `Which language would you like to use?\n\n${lines}\n\n_Reply with a number (1–${LANGUAGE_OPTIONS.length})._`;
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
      `👋 *Welcome to ZimHealth CPD!*\n\nLet's create your account in a few quick steps.\n\nFirst, what is your *full name*? (e.g. Mary Chikwanda)\n\n_Reply *cancel* at any time to exit._`,
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

  // ── CADRE step: pick professional cadre ──
  if (rs.step === 'CADRE') {
    const idx = parseInt(text, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= CADRE_OPTIONS.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${CADRE_OPTIONS.length}.`);
      return;
    }
    rs.cadre = CADRE_OPTIONS[idx].key;

    // Country is inferred from the WhatsApp number itself — never asked.
    const councils = await getCouncilsForPhone(msg.from.replace('whatsapp:', ''));
    if (councils.length === 1) {
      rs.councilId = councils[0].id;
      rs.councilLabel = `${councils[0].acronym} - ${councils[0].name}`;
      rs.step = 'LANGUAGE';
      await saveSession(session);
      await sendMessage(msg.from, languagePicker());
      return;
    }
    if (councils.length > 1) {
      rs.councilOptions = councils.map((c) => ({ id: c.id, label: `${c.acronym} - ${c.name}` }));
      rs.step = 'COUNCIL';
      await saveSession(session);
      await sendMessage(msg.from, councilPicker(councils));
      return;
    }
    // No council mapped for this number's country yet — proceed without one;
    // an admin can assign it later once that country's council is onboarded.
    rs.step = 'LANGUAGE';
    await saveSession(session);
    await sendMessage(msg.from, languagePicker());
    return;
  }

  // ── COUNCIL step: pick regulatory council (only asked when a country has more than one) ──
  if (rs.step === 'COUNCIL') {
    const options = rs.councilOptions ?? [];
    const idx = parseInt(text, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= options.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${options.length}.`);
      return;
    }
    rs.councilId = options[idx].id;
    rs.councilLabel = options[idx].label;
    delete rs.councilOptions;
    rs.step = 'LANGUAGE';
    await saveSession(session);
    await sendMessage(msg.from, languagePicker());
    return;
  }

  // ── LANGUAGE step: preferred language for course content ──
  if (rs.step === 'LANGUAGE') {
    const idx = parseInt(text, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= LANGUAGE_OPTIONS.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${LANGUAGE_OPTIONS.length}.`);
      return;
    }
    rs.language = LANGUAGE_OPTIONS[idx].key;
    rs.step = 'NCZ';
    await saveSession(session);
    await sendMessage(
      msg.from,
      `What is your *council registration number*?\n\n_Reply *skip* if you don't have one yet._`,
    );
    return;
  }

  // ── Registration-number step (optional) ──
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
    const languageName = LANGUAGE_OPTIONS.find((l) => l.key === rs.language)?.label ?? rs.language;
    const councilLine = rs.councilLabel ? `\n🏛️ Council: *${rs.councilLabel}*` : '';
    await sendMessage(
      msg.from,
      `📋 *Review your details:*\n\n👤 Name: *${rs.fullName}*\n🏥 Cadre: *${cadreName}*${councilLine}\n🗣️ Language: *${languageName}*\n🔖 Registration No: *${rs.nczRegistrationNumber ?? 'Not provided'}*\n🏨 Workplace: *${rs.institution}*\n\nReply *yes* to confirm and create your account, or *no* to start over.`,
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
        councilId: rs.councilId,
        language: rs.language,
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
        : `🎉 Account created, *${data.fullName}*! Welcome to ZimHealth CPD.`;

      await sendMessage(msg.from, `${greeting}\n\n${TEMPLATES.MAIN_MENU}`);
    } catch {
      await sendMessage(
        msg.from,
        `⚠️ Registration failed. Please try again or visit ${WEB_URL}/register\n\nReply *cancel* to go back to the menu.`,
      );
    }
    return;
  }
}
