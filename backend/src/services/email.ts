import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { logger } from '../utils/logger';

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName: string;
  resendApiKey?: string;
}

function isResend(cfg: SmtpConfig) {
  return !!cfg.resendApiKey;
}

function smtpTransporter(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export async function testSmtpConnection(cfg: SmtpConfig): Promise<void> {
  if (isResend(cfg)) {
    const resend = new Resend(cfg.resendApiKey);
    const { error } = await resend.emails.send({
      from: `${cfg.fromName} <${cfg.from}>`,
      to: cfg.from,
      subject: 'KLARY — Email connection test',
      html: '<p>Your email settings are working correctly.</p>',
    });
    if (error) throw new Error(error.message);
    return;
  }
  const t = smtpTransporter(cfg);
  await t.verify();
}

async function sendHtml(cfg: SmtpConfig, to: string, toName: string, subject: string, html: string) {
  const from = `${cfg.fromName} <${cfg.from}>`;

  if (isResend(cfg)) {
    const resend = new Resend(cfg.resendApiKey);
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) throw new Error(error.message);
    return;
  }

  const t = smtpTransporter(cfg);
  await t.sendMail({ from, to: `"${toName}" <${to}>`, subject, html });
}

export async function sendDocumentRequestEmail(cfg: SmtpConfig, params: {
  clientName: string;
  clientEmail: string;
  firmName: string;
  requestTitle: string;
  requestDescription?: string;
  items: Array<{ name: string; required: boolean }>;
  uploadUrl: string;
  dueDate?: string;
}): Promise<void> {
  const itemRows = params.items.map(i =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${i.name}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:${i.required ? '#dc2626' : '#6b7280'}">${i.required ? 'Required' : 'Optional'}</td></tr>`
  ).join('');

  const dueDateRow = params.dueDate
    ? `<p style="color:#6b7280;font-size:14px;">Please submit by <strong>${params.dueDate}</strong>.</p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#0ea5e9;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${params.firmName}</h1>
      <p style="margin:6px 0 0;color:#bae6fd;font-size:14px;">Document Request</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#111827;font-size:16px;margin-top:0;">Hi ${params.clientName},</p>
      <p style="color:#374151;font-size:15px;">${params.firmName} is requesting the following documents:</p>
      <h2 style="font-size:17px;color:#111827;margin:24px 0 8px;">${params.requestTitle}</h2>
      ${params.requestDescription ? `<p style="color:#6b7280;font-size:14px;">${params.requestDescription}</p>` : ''}
      ${params.items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead><tr>
          <th style="text-align:left;font-size:13px;color:#6b7280;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Document</th>
          <th style="text-align:right;font-size:13px;color:#6b7280;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">Status</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>` : ''}
      ${dueDateRow}
      <div style="margin:28px 0;text-align:center;">
        <a href="${params.uploadUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Upload Documents</a>
      </div>
      <p style="color:#9ca3af;font-size:13px;">This link is unique to you. Do not share it with others.</p>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">Sent by ${params.firmName} via KLARY</p>
    </div>
  </div>
</body>
</html>`;

  await sendHtml(cfg, params.clientEmail, params.clientName,
    `${params.firmName} needs documents: ${params.requestTitle}`, html);

  logger.info(`Document request email sent to ${params.clientEmail}`);
}

export async function sendUploadNotificationEmail(cfg: SmtpConfig, params: {
  accountantEmail: string;
  accountantName: string;
  firmName: string;
  clientName: string;
  requestTitle: string;
  fileName: string;
  uploadedAt: string;
  requestUrl: string;
}): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#10b981;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Document Uploaded</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#111827;margin-top:0;">Hi ${params.accountantName},</p>
      <p style="color:#374151;"><strong>${params.clientName}</strong> just uploaded a document for <strong>${params.requestTitle}</strong>.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-size:14px;color:#166534;"><strong>File:</strong> ${params.fileName}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${params.uploadedAt}</p>
      </div>
      <a href="${params.requestUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">View in KLARY</a>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">${params.firmName} · KLARY</p>
    </div>
  </div>
</body>
</html>`;

  await sendHtml(cfg, params.accountantEmail, params.accountantName,
    `${params.clientName} uploaded a document — ${params.requestTitle}`, html);

  logger.info(`Upload notification sent to ${params.accountantEmail}`);
}

const TYPE_LABELS: Record<string, string> = {
  MOMS_Q: 'Momsredovisning (kvartal)',
  MOMS_M: 'Momsredovisning (månads)',
  ARBETSGIVAR: 'Arbetsgivardeklaration',
  INKOMST: 'Inkomstdeklaration',
  ARSREDOVISNING: 'Årsredovisning',
  CUSTOM: 'Övrigt',
};

export async function sendComplianceDueSoonEmail(cfg: SmtpConfig, params: {
  adminEmail: string;
  adminName: string;
  firmName: string;
  deadlines: Array<{ clientName: string; type: string; dueDate: Date }>;
  appUrl: string;
}): Promise<void> {
  const rows = params.deadlines.map(d => {
    const due = d.dueDate.toLocaleDateString('sv-SE');
    const label = TYPE_LABELS[d.type] || d.type;
    const daysLeft = Math.ceil((d.dueDate.getTime() - Date.now()) / 86400000);
    const urgency = daysLeft <= 7 ? '#dc2626' : '#d97706';
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111827;">${d.clientName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:${urgency};">${due}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:${urgency};">${daysLeft} dagar kvar</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#f59e0b;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">⏰ Compliance-påminnelse</h1>
      <p style="margin:6px 0 0;color:#fef3c7;font-size:14px;">${params.firmName} · KLARY</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#111827;font-size:15px;margin-top:0;">Hej ${params.adminName},</p>
      <p style="color:#374151;font-size:15px;">Du har <strong>${params.deadlines.length} deadline${params.deadlines.length > 1 ? 's' : ''}</strong> som förfaller inom 14 dagar:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">KUND</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">TYP</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">FÖRFALLER</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">ÅTERSTÅR</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.appUrl}/compliance" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;">Öppna Compliance Calendar</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">${params.firmName} · KLARY — The AI copilot for Swedish accounting firms</p>
    </div>
  </div>
</body>
</html>`;

  await sendHtml(cfg, params.adminEmail, params.adminName,
    `⏰ ${params.deadlines.length} compliance-deadline${params.deadlines.length > 1 ? 's' : ''} förfaller inom 14 dagar`, html);

  logger.info(`Compliance due-soon email sent to ${params.adminEmail} (${params.deadlines.length} deadlines)`);
}

export async function sendIxbrlReminderEmail(cfg: SmtpConfig, params: {
  adminEmail: string;
  adminName: string;
  firmName: string;
  clientName: string;
  dueDate: Date;
  daysUntilDue: number;
  appUrl: string;
}): Promise<void> {
  const dueStr = params.dueDate.toLocaleDateString('sv-SE');
  const urgencyColor = params.daysUntilDue <= 14 ? '#dc2626' : '#d97706';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:540px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#6366f1;padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">📄 iXBRL Påminnelse — Årsredovisning</h1>
      <p style="margin:6px 0 0;color:#e0e7ff;font-size:14px;">${params.firmName} · KLARY</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#111827;font-size:15px;margin-top:0;">Hej ${params.adminName},</p>
      <p style="color:#374151;font-size:15px;">Årsredovisningen för <strong>${params.clientName}</strong> ska lämnas in till Bolagsverket i digitalt iXBRL-format.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:24px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;color:#6b7280;font-weight:600;">KUND</span>
          <span style="font-size:15px;color:#111827;font-weight:700;">${params.clientName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;color:#6b7280;font-weight:600;">FÖRFALLER</span>
          <span style="font-size:15px;font-weight:700;color:${urgencyColor};">${dueStr}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;color:#6b7280;font-weight:600;">ÅTERSTÅR</span>
          <span style="font-size:15px;font-weight:700;color:${urgencyColor};">${params.daysUntilDue} dagar</span>
        </div>
      </div>
      <p style="color:#6b7280;font-size:13px;">Från 2026 krävs digital inlämning i iXBRL-format via Bolagsverkets e-tjänst. Använd SIE-kompatibel bokföringsprogramvara för att generera filen.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.appUrl}/compliance" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px;">Markera som inlämnad i KLARY</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #f0f0f0;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">${params.firmName} · KLARY — The AI copilot for Swedish accounting firms</p>
    </div>
  </div>
</body>
</html>`;

  await sendHtml(cfg, params.adminEmail, params.adminName,
    `📄 iXBRL-påminnelse: ${params.clientName} årsredovisning om ${params.daysUntilDue} dagar (${dueStr})`, html);

  logger.info(`iXBRL reminder sent to ${params.adminEmail} for client ${params.clientName}`);
}
