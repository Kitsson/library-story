import twilio from 'twilio';
import { logger } from '../utils/logger';

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export async function sendDocumentRequestSms(to: string, params: {
  firmName: string;
  requestTitle: string;
  uploadUrl: string;
  dueDate?: string;
}): Promise<void> {
  if (!isSmsConfigured()) {
    throw new Error('Twilio is not configured on this server.');
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const lines = [
    `${params.firmName}: Begäran om dokument`,
    `"${params.requestTitle}"`,
    params.dueDate ? `Förfallodatum: ${params.dueDate}` : '',
    `Ladda upp dina dokument: ${params.uploadUrl}`,
  ].filter(Boolean);

  await client.messages.create({
    body: lines.join('\n'),
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });

  logger.info(`SMS sent to ${to.slice(0, 5)}****`);
}
