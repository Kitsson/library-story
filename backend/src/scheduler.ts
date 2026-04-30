import cron from 'node-cron';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';
import { sendComplianceDueSoonEmail, sendIxbrlReminderEmail, SmtpConfig } from './services/email';

export function startScheduler() {
  // 01:00 — mark overdue items, update compliance statuses, send DUE_SOON digests
  cron.schedule('0 1 * * *', async () => {
    await markOverdueDocumentRequests();
    await updateComplianceStatuses();
    await sendComplianceReminders();
  });

  // 08:00 — send iXBRL 30-day reminders
  cron.schedule('0 8 * * *', async () => {
    await sendIxbrlReminders();
  });

  logger.info('Scheduler started — nightly jobs at 01:00, iXBRL reminders at 08:00');
}

async function markOverdueDocumentRequests() {
  try {
    const result = await prisma.documentRequest.updateMany({
      where: {
        status: { in: ['DRAFT', 'SENT', 'PARTIAL'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    if (result.count > 0) {
      logger.info(`Scheduler: marked ${result.count} document request(s) as OVERDUE`);
    }
  } catch (err) {
    logger.error('Scheduler: failed to mark overdue document requests', err);
  }
}

async function updateComplianceStatuses() {
  try {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const overdue = await prisma.complianceDeadline.updateMany({
      where: {
        status: { in: ['UPCOMING', 'DUE_SOON'] },
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });

    const dueSoon = await prisma.complianceDeadline.updateMany({
      where: {
        status: 'UPCOMING',
        dueDate: { gte: now, lte: in14Days },
      },
      data: { status: 'DUE_SOON' },
    });

    if (overdue.count > 0 || dueSoon.count > 0) {
      logger.info(`Scheduler: compliance — ${overdue.count} overdue, ${dueSoon.count} due soon`);
    }
  } catch (err) {
    logger.error('Scheduler: failed to update compliance statuses', err);
  }
}

function buildEmailCfg(org: any): SmtpConfig {
  return {
    resendApiKey: org.resendApiKey || undefined,
    host: org.smtpHost || undefined,
    port: org.smtpPort || undefined,
    secure: org.smtpSecure,
    user: org.smtpUser || undefined,
    pass: org.smtpPass || undefined,
    from: org.smtpFrom!,
    fromName: org.smtpFromName!,
  };
}

async function sendComplianceReminders() {
  try {
    // Find all DUE_SOON deadlines that haven't had a reminder sent yet
    const deadlines = await prisma.complianceDeadline.findMany({
      where: { status: 'DUE_SOON', reminderSentAt: null },
      include: { client: { select: { name: true, organizationId: true } } },
      orderBy: { dueDate: 'asc' },
    });

    if (deadlines.length === 0) return;

    // Group by organizationId
    const byOrg = new Map<string, typeof deadlines>();
    for (const d of deadlines) {
      const orgId = d.client.organizationId!;
      if (!byOrg.has(orgId)) byOrg.set(orgId, []);
      byOrg.get(orgId)!.push(d);
    }

    const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';

    for (const [orgId, orgDeadlines] of byOrg) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true },
      });
      if (!org || (!org.resendApiKey && !org.smtpHost) || !org.smtpFrom) continue;

      const admin = await prisma.user.findFirst({
        where: { organizationId: orgId, role: 'ADMIN' },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!admin) continue;

      try {
        await sendComplianceDueSoonEmail(buildEmailCfg(org), {
          adminEmail: admin.email,
          adminName: `${admin.firstName} ${admin.lastName}`,
          firmName: org.name,
          deadlines: orgDeadlines.map(d => ({
            clientName: d.client.name,
            type: d.type,
            dueDate: d.dueDate,
          })),
          appUrl,
        });

        await prisma.complianceDeadline.updateMany({
          where: { id: { in: orgDeadlines.map(d => d.id) } },
          data: { reminderSentAt: new Date() },
        });

        logger.info(`Scheduler: compliance digest sent to ${admin.email} — ${orgDeadlines.length} deadline(s)`);
      } catch (err) {
        logger.error(`Scheduler: failed to send compliance digest for org ${orgId}`, err);
      }
    }
  } catch (err) {
    logger.error('Scheduler: failed in sendComplianceReminders', err);
  }
}

async function sendIxbrlReminders() {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const deadlines = await prisma.complianceDeadline.findMany({
      where: {
        type: 'ARSREDOVISNING',
        status: { not: 'COMPLETED' },
        dueDate: { gte: now, lte: in30Days },
        reminderSentAt: null,
      },
      include: { client: { select: { name: true, organizationId: true } } },
      orderBy: { dueDate: 'asc' },
    });

    if (deadlines.length === 0) return;

    const appUrl = process.env.APP_URL || 'https://klaryproject.vercel.app';

    for (const deadline of deadlines) {
      const orgId = deadline.client.organizationId!;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpFromName: true, smtpSecure: true, resendApiKey: true },
      });
      if (!org || (!org.resendApiKey && !org.smtpHost) || !org.smtpFrom) continue;

      const admin = await prisma.user.findFirst({
        where: { organizationId: orgId, role: 'ADMIN' },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!admin) continue;

      const daysUntilDue = Math.ceil((deadline.dueDate.getTime() - now.getTime()) / 86400000);

      try {
        await sendIxbrlReminderEmail(buildEmailCfg(org), {
          adminEmail: admin.email,
          adminName: `${admin.firstName} ${admin.lastName}`,
          firmName: org.name,
          clientName: deadline.client.name,
          dueDate: deadline.dueDate,
          daysUntilDue,
          appUrl,
        });

        await prisma.complianceDeadline.update({
          where: { id: deadline.id },
          data: { reminderSentAt: new Date() },
        });

        logger.info(`Scheduler: iXBRL reminder sent for ${deadline.client.name} (${daysUntilDue} days left)`);
      } catch (err) {
        logger.error(`Scheduler: failed to send iXBRL reminder for deadline ${deadline.id}`, err);
      }
    }
  } catch (err) {
    logger.error('Scheduler: failed in sendIxbrlReminders', err);
  }
}
