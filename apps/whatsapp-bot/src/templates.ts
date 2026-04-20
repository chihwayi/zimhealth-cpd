export const TEMPLATES = {
  MAIN_MENU: `Welcome to *NursePro CPD* 🏥

Reply with a number:
1️⃣ Learn — today's lesson
2️⃣ Take a quiz
3️⃣ My CPD points
4️⃣ Ask a clinical question
5️⃣ Subscribe / upgrade
6️⃣ Help

_Reply STOP to pause notifications_`,

  NOT_REGISTERED: `You're not registered on NursePro CPD yet.

To register, visit:
👉 ${process.env.WEB_URL ?? 'https://nursepro.co.zw'}/register

Or reply *REG* to register via WhatsApp.`,

  HELP: `*NursePro CPD Help*

Commands:
• *menu* — main menu
• *points* — your CPD balance
• *cert* — download certificate
• *stop* — pause notifications

Support: support@nursepro.co.zw
Web: ${process.env.WEB_URL ?? 'https://nursepro.co.zw'}`,

  POINTS: (points: number, required: number, deadline: string) =>
    `*Your CPD Points*\n\n✅ Earned: *${points}* pts\n📋 Required: *${required}* pts\n⏰ Deadline: ${deadline}\n\n${
      points >= required
        ? "🎉 You've completed your CPD requirements!"
        : `You need *${required - points} more points*. Reply 1 to start learning.`
    }`,

  RENEWAL_REMINDER: (name: string, days: number, points: number) =>
    `Hi ${name} 👋\n\nYour CPD renewal is in *${days} days*.\nYou need *${points} more points*.\n\nReply *1* to start learning now.`,

  CERT_READY: (link: string) =>
    `🎓 Your CPD certificate is ready!\n\nDownload here:\n${link}\n\nValid for NCZ renewal submission.`,
};

