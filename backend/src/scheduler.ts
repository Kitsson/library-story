import cron from 'node-cron';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

export function startScheduler() {
  // Run every night at 01:00
  cron.schedule('0 1 * * *', async () => {
    await markOverdueDocumentRequests();
    await updateComplianceStatuses();
  });

  logger.info('Scheduler started — nightly jobs run at 01:00');
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

    // Mark overdue
    const overdue = await prisma.complianceDeadline.updateMany({
      where: {
        status: { in: ['UPCOMING', 'DUE_SOON'] },
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });

    // Mark due soon (within 14 days)
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
