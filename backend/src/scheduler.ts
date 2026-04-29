import cron from 'node-cron';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

export function startScheduler() {
  // Run every night at 01:00 — mark document requests past their due date as OVERDUE
  cron.schedule('0 1 * * *', async () => {
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
      logger.error('Scheduler: failed to mark overdue requests', err);
    }
  });

  logger.info('Scheduler started — overdue document request check runs nightly at 01:00');
}
