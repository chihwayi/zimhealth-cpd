import express from 'express';
import webhookRouter from './webhook';

const app = express();
const PORT = process.env.BOT_PORT ?? 4100;

app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-whatsapp-bot' });
});

app.listen(PORT, () => {
  console.log(`WhatsApp Bot running on port ${PORT}`);
  const host = process.env.APP_HOST ?? 'localhost';
  const scheme = process.env.APP_SCHEME ?? 'http';
  console.log(`Webhook: POST ${scheme}://${host}:${PORT}/webhook`);
});

