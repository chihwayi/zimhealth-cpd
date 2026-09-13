const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@example.com';

export const TEMPLATES = {
  MAIN_MENU: `Welcome to *ZimHealth CPD* 🏥

Reply with a number:
1️⃣ Learn — today's lesson
2️⃣ Take a quiz
3️⃣ My CPD points
4️⃣ Ask a clinical question
5️⃣ Subscribe / upgrade
6️⃣ Help
7️⃣ Report an issue

_Reply STOP to pause notifications_`,

  NOT_REGISTERED: `You're not registered on ZimHealth CPD yet.

To register, visit:
👉 ${WEB_URL}/register

Or reply *REG* to register via WhatsApp.`,

  HELP: `*ZimHealth CPD Help*

Commands:
• *menu* — main menu
• *points* — your CPD balance
• *cert* — download certificate
• *stop* — pause notifications

Support: ${SUPPORT_EMAIL}
Web: ${WEB_URL}`,

  POINTS: (points: number, required: number, deadline: string) =>
    `*Your CPD Points*\n\n✅ Earned: *${points}* pts\n📋 Required: *${required}* pts\n⏰ Deadline: ${deadline}\n\n${
      points >= required
        ? "🎉 You've completed your CPD requirements!"
        : `You need *${required - points} more points*. Reply 1 to start learning.`
    }`,

  RENEWAL_REMINDER: (name: string, days: number, points: number) =>
    `Hi ${name} 👋\n\nYour CPD renewal is in *${days} days*.\nYou need *${points} more points*.\n\nReply *1* to start learning now.`,

  CERT_READY: (link: string) =>
    `🎓 Your CPD certificate is ready!\n\nDownload here:\n${link}\n\nValid for council renewal submission.`,
};
