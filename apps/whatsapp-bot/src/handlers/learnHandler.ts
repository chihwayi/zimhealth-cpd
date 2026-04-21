import type { IncomingMessage } from '../botRouter';
import type { BotSession, BotCourseOption, BotModuleOption, BotSection, BotQuizQuestion } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage, sendMediaMessage } from '../twilio';
import { htmlToWhatsApp, truncateForWhatsApp } from '../utils/htmlToText';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

const botHeaders = {
  'Content-Type': 'application/json',
  'x-bot-secret': BOT_SECRET,
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchCourses(phone: string): Promise<{ learnerId: string; courses: BotCourseOption[] } | null> {
  try {
    const res = await fetch(`${API_URL}/api/bot/courses?phone=${encodeURIComponent(phone)}`, {
      headers: botHeaders,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchModules(courseId: string): Promise<BotModuleOption[] | null> {
  try {
    const res = await fetch(`${API_URL}/api/bot/course/${courseId}/modules`, { headers: botHeaders });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.modules ?? null;
  } catch {
    return null;
  }
}

interface ModuleContent {
  id: string;
  title: string;
  sections: BotSection[];
  quizzes: Array<{ id: string; title: string; passMark: number; questions: BotQuizQuestion[] }>;
}

async function fetchModuleContent(moduleId: string): Promise<ModuleContent | null> {
  try {
    const res = await fetch(`${API_URL}/api/bot/module/${moduleId}`, { headers: botHeaders });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Section delivery ──────────────────────────────────────────────────────────

async function deliverSection(to: string, section: BotSection, sectionNum: number, total: number): Promise<void> {
  const header = `📖 *Section ${sectionNum} of ${total}: ${section.title}*\n\n`;
  const navHint = `\n\n_Reply *next* to continue${total > sectionNum ? '' : ', or'} *menu* to go back._`;

  switch (section.type) {
    case 'READING': {
      const text = truncateForWhatsApp(htmlToWhatsApp(section.content));
      if (!text) {
        await sendMessage(to, `${header}No reading content yet.${navHint}`);
        return;
      }
      await sendMessage(to, `${header}${text}${navHint}`);
      break;
    }

    case 'VIDEO': {
      if (section.mediaUrl) {
        const note = section.content ? `\n\n${truncateForWhatsApp(htmlToWhatsApp(section.content), 400)}` : '';
        await sendMessage(
          to,
          `${header}🎬 *Video lesson*${note}\n\nWatch here: ${section.mediaUrl}${navHint}`,
        );
      } else {
        await sendMessage(to, `${header}🎬 *Video lesson*\n\n_No video link attached yet._${navHint}`);
      }
      break;
    }

    case 'AUDIO': {
      const note = section.content ? `\n\n${truncateForWhatsApp(htmlToWhatsApp(section.content), 400)}` : '';
      if (section.mediaUrl) {
        await sendMessage(to, `${header}🎧 *Audio lesson*${note}${navHint}`);
        await sendMediaMessage(to, '', section.mediaUrl);
      } else {
        await sendMessage(to, `${header}🎧 *Audio lesson*\n\n_No audio file attached yet._${navHint}`);
      }
      break;
    }

    case 'INTERACTIVE': {
      const note = section.content ? `\n\n${truncateForWhatsApp(htmlToWhatsApp(section.content), 400)}` : '';
      const link = section.mediaUrl ? `\n\nOpen here: ${section.mediaUrl}` : '\n\n_No link attached yet._';
      await sendMessage(to, `${header}🔗 *Interactive content*${note}${link}${navHint}`);
      break;
    }

    case 'QUIZ':
      // QUIZ sections are handled separately — caller starts the quiz
      break;

    default:
      await sendMessage(to, `${header}Content type not supported via WhatsApp.${navHint}`);
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export async function handleLearn(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toLowerCase();
  const ls = session.learningState;

  // ── No learning state yet — fetch and show enrolled courses ──
  if (!ls) {
    const phone = msg.from.replace('whatsapp:', '');
    const data = await fetchCourses(phone);

    if (!data || data.courses.length === 0) {
      await sendMessage(
        msg.from,
        `📚 *No enrolled courses found.*\n\nVisit nursepro.co.zw to browse and enrol in courses.\n\nReply *menu* to go back.`,
      );
      session.state = 'MENU';
      await saveSession(session);
      return;
    }

    if (data.courses.length === 1) {
      // Auto-select the only course and go straight to modules
      const course = data.courses[0];
      session.learningState = {
        step: 'SELECT_MODULE',
        courseId: course.id,
        courseTitle: course.title,
        sections: [],
        sectionIndex: 0,
      };
      await saveSession(session);

      const modules = await fetchModules(course.id);
      if (!modules || modules.length === 0) {
        await sendMessage(msg.from, `📚 *${course.title}*\n\nThis course has no modules yet.\n\nReply *menu* to go back.`);
        session.learningState = undefined;
        session.state = 'MENU';
        await saveSession(session);
        return;
      }

      session.learningState.moduleOptions = modules;
      await saveSession(session);

      const list = modules
        .map((m, i) => `${i + 1}️⃣ ${m.title} (${m.sectionCount} sections)`)
        .join('\n');
      await sendMessage(
        msg.from,
        `📚 *${course.title}*\n\nPick a module:\n\n${list}\n\n_Reply with a number, or *menu* to go back._`,
      );
      return;
    }

    // Multiple courses — show list
    session.learningState = {
      step: 'SELECT_COURSE',
      courseOptions: data.courses,
      sections: [],
      sectionIndex: 0,
    };
    await saveSession(session);

    const list = data.courses
      .map((c, i) => `${i + 1}️⃣ ${c.title} — ${c.progressPercent}% complete`)
      .join('\n');
    await sendMessage(msg.from, `📚 *Your Courses*\n\n${list}\n\n_Reply with a number to pick a course._`);
    return;
  }

  // ── SELECT_COURSE step ──
  if (ls.step === 'SELECT_COURSE') {
    const options = ls.courseOptions ?? [];
    const idx = parseInt(text, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= options.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${options.length}.`);
      return;
    }

    const course = options[idx];
    ls.step = 'SELECT_MODULE';
    ls.courseId = course.id;
    ls.courseTitle = course.title;
    ls.courseOptions = undefined; // free memory in Redis
    await saveSession(session);

    const modules = await fetchModules(course.id);
    if (!modules || modules.length === 0) {
      await sendMessage(msg.from, `📚 *${course.title}*\n\nThis course has no modules yet.\n\nReply *menu* to go back.`);
      session.learningState = undefined;
      session.state = 'MENU';
      await saveSession(session);
      return;
    }

    ls.moduleOptions = modules;
    await saveSession(session);

    const list = modules.map((m, i) => `${i + 1}️⃣ ${m.title} (${m.sectionCount} sections)`).join('\n');
    await sendMessage(
      msg.from,
      `📚 *${course.title}*\n\nPick a module:\n\n${list}\n\n_Reply with a number, or *back* to pick a different course._`,
    );
    return;
  }

  // ── SELECT_MODULE step ──
  if (ls.step === 'SELECT_MODULE') {
    // Allow going back to course list
    if (text === 'back' && ls.courseOptions?.length) {
      ls.step = 'SELECT_COURSE';
      ls.moduleOptions = undefined;
      await saveSession(session);
      const list = ls.courseOptions.map((c, i) => `${i + 1}️⃣ ${c.title} — ${c.progressPercent}% complete`).join('\n');
      await sendMessage(msg.from, `📚 *Your Courses*\n\n${list}\n\n_Reply with a number._`);
      return;
    }

    const options = ls.moduleOptions ?? [];
    const idx = parseInt(text, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= options.length) {
      await sendMessage(msg.from, `Please reply with a number between 1 and ${options.length}.`);
      return;
    }

    const module = options[idx];
    const content = await fetchModuleContent(module.id);

    if (!content || content.sections.length === 0) {
      await sendMessage(msg.from, `📚 *${module.title}*\n\nThis module has no content yet.\n\nReply *menu* to go back.`);
      return;
    }

    // Store the full module content in session
    const firstQuiz = content.quizzes[0] ?? null;
    ls.step = 'READING';
    ls.moduleId = module.id;
    ls.moduleTitle = module.title;
    ls.moduleOptions = undefined;
    ls.sections = content.sections;
    ls.quizId = firstQuiz?.id ?? null;
    ls.quizQuestions = firstQuiz?.questions ?? undefined;
      ls.quizSource = firstQuiz ? 'MODULE_QUIZ' : undefined;
    ls.sectionIndex = 0;
    await saveSession(session);

    // Find first non-quiz section to deliver (skip QUIZ type sections at start)
    const firstContentIdx = content.sections.findIndex((s) => s.type !== 'QUIZ');
    if (firstContentIdx === -1) {
      // Only quiz sections — go straight to quiz
      await startModuleQuiz(msg.from, session);
      return;
    }

    ls.sectionIndex = firstContentIdx;
    await saveSession(session);

    await sendMessage(msg.from, `📖 *Module ${module.order}: ${module.title}*\n\n${content.sections.length} sections · ${firstQuiz ? 'includes a quiz' : 'no quiz'}\n\n_Starting now…_`);
    await deliverSection(msg.from, content.sections[firstContentIdx], firstContentIdx + 1, content.sections.length);
    return;
  }

  // ── READING step ──
  if (ls.step === 'READING') {
    const sections = ls.sections;
    const currentIdx = ls.sectionIndex;

    // Exit commands
    if (text === 'menu' || text === 'done' || text === 'exit') {
      session.learningState = undefined;
      session.state = 'MENU';
      await saveSession(session);
      await sendMessage(msg.from, `✅ Progress saved. Reply *1* to continue learning or *menu* for the main menu.`);
      return;
    }

    // Back to module list
    if (text === 'back') {
      if (ls.courseId) {
        const modules = await fetchModules(ls.courseId);
        ls.step = 'SELECT_MODULE';
        ls.moduleOptions = modules ?? [];
        ls.sections = [];
        ls.sectionIndex = 0;
        await saveSession(session);
        if (modules && modules.length > 0) {
          const list = modules.map((m, i) => `${i + 1}️⃣ ${m.title} (${m.sectionCount} sections)`).join('\n');
          await sendMessage(msg.from, `📚 *${ls.courseTitle}*\n\nPick a module:\n\n${list}\n\n_Reply with a number._`);
        } else {
          await sendMessage(msg.from, `No other modules found. Reply *menu* to go back.`);
        }
        return;
      }
      session.learningState = undefined;
      session.state = 'MENU';
      await saveSession(session);
      return;
    }

    // Start quiz
    if (text === 'quiz' || text === '2') {
      if (ls.quizId && ls.quizQuestions?.length) {
        await startModuleQuiz(msg.from, session);
        return;
      }
      await sendMessage(msg.from, `No quiz is linked to this module yet.\n\nReply *next* to continue or *menu* to go back.`);
      return;
    }

    // Next section ("next", "n", "1", or any other input while reading)
    if (['next', 'n', '1', 'continue'].includes(text) || text.length > 0) {
      // Find next non-quiz section after current
      let nextIdx = currentIdx + 1;

      // Skip quiz-type sections in the reading flow (they're triggered separately)
      while (nextIdx < sections.length && sections[nextIdx].type === 'QUIZ') {
        nextIdx++;
      }

      if (nextIdx >= sections.length) {
        // Reached end of content sections
        if (ls.quizId && ls.quizQuestions?.length) {
          await sendMessage(
            msg.from,
            `✅ You've finished all reading for *${ls.moduleTitle}*.\n\nReply *quiz* to test your knowledge and earn CPD points, or *menu* to go back.`,
          );
        } else {
          await sendMessage(
            msg.from,
            `✅ You've completed *${ls.moduleTitle}*!\n\nReply *back* to pick another module or *menu* for the main menu.`,
          );
        }
        ls.sectionIndex = sections.length; // mark as finished
        await saveSession(session);
        return;
      }

      ls.sectionIndex = nextIdx;
      await saveSession(session);
      await deliverSection(msg.from, sections[nextIdx], nextIdx + 1, sections.length);
      return;
    }
  }
}

// ─── Start module quiz ────────────────────────────────────────────────────────

async function startModuleQuiz(to: string, session: BotSession): Promise<void> {
  const ls = session.learningState;
  if (!ls?.quizId || !ls.quizQuestions?.length) return;

  session.quizState = {
    quizId: ls.quizId,
    courseId: ls.courseId,
    moduleId: ls.moduleId,
    moduleTitle: ls.moduleTitle,
    quizSource: 'MODULE_QUIZ',
    questions: ls.quizQuestions,
    currentIndex: 0,
    answers: {},
    score: 0,
    returnToLearning: true,
  };
  session.state = 'QUIZ';
  await saveSession(session);

  const q = ls.quizQuestions[0];
  const optionsText = q.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
  await sendMessage(
    to,
    `📝 *Quiz: ${ls.moduleTitle}*\n\n❓ *Question 1 of ${ls.quizQuestions.length}*\n\n${q.text}\n\n${optionsText}\n\n_Reply A, B, C, or D_`,
  );
}
