import twilio from 'twilio';

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const twilioClient = SID && TOKEN ? twilio(SID, TOKEN) : null;

/**
 * Send a WhatsApp message to a phone number.
 * Phone must be in format: "whatsapp:+263771234567"
 */
export async function sendMessage(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  if (!twilioClient || !FROM_NUMBER) {
    // Local/dev fallback when Twilio credentials are not configured
    console.log(`[Bot][sendMessage] to=${toFormatted}\n${body}`);
    return;
  }
  await twilioClient.messages.create({ from: FROM_NUMBER, to: toFormatted, body });
}

/**
 * Send a WhatsApp message with a media URL (audio, image).
 */
export async function sendMediaMessage(to: string, body: string, mediaUrl: string): Promise<void> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  if (!twilioClient || !FROM_NUMBER) {
    console.log(`[Bot][sendMediaMessage] to=${toFormatted} media=${mediaUrl}\n${body}`);
    return;
  }
  await twilioClient.messages.create({ from: FROM_NUMBER, to: toFormatted, body, mediaUrl: [mediaUrl] });
}

/**
 * Validate Twilio webhook signature to prevent spoofed requests.
 */
export function validateWebhookSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

