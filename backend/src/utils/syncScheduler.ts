import cron from 'node-cron';
import { prisma } from './prisma';
import { decrypt, encrypt } from './crypto';
import { FortnoxClient, mapVouchersToTransactions, refreshAccessToken } from '../services/fortnoxClient';
import { logger } from './logger';

async function syncFortnoxIntegration(integration: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  lastSyncAt: Date | null;
  organizationId: string;
}) {
  let accessToken: string;

  // Refresh if token expired or within 5 minutes of expiry
  const expirySoon = integration.tokenExpiry
    ? integration.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000
    : true;

  if (expirySoon && integration.refreshToken) {
    try {
      const tokens = await refreshAccessToken(integration.refreshToken);
      await prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          tokenExpiry: tokens.expiresAt,
        },
      });
      accessToken = tokens.accessToken;
    } catch (err) {
      logger.error(`Fortnox token refresh failed for integration ${integration.id}: ${(err as Error).message}`);
      await prisma.accountingIntegration.update({ where: { id: integration.id }, data: { status: 'ERROR' } });
      return;
    }
  } else {
    accessToken = decrypt(integration.accessToken);
  }

  // Find any client linked to this org to attach transactions to
  const client = await prisma.client.findFirst({
    where: { organizationId: integration.organizationId },
    orderBy: { createdAt: 'asc' },
  });
  if (!client) {
    logger.warn(`No clients found for org ${integration.organizationId}, skipping Fortnox sync`);
    return;
  }

  const fromDate = integration.lastSyncAt || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fortnox = new FortnoxClient(accessToken);

  try {
    const vouchers = await fortnox.fetchVouchers(fromDate);
    const mapped = mapVouchersToTransactions(vouchers, client.id, integration.id);

    let imported = 0;
    for (const tx of mapped) {
      await prisma.transaction.upsert({
        where: { clientId_externalId: { clientId: tx.clientId, externalId: tx.externalId } },
        update: {},
        create: tx,
      });
      imported++;
    }

    await prisma.accountingIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: 'ACTIVE' },
    });

    logger.info(`Fortnox sync: imported ${imported} transactions for org ${integration.organizationId}`);
  } catch (err) {
    logger.error(`Fortnox sync failed for integration ${integration.id}: ${(err as Error).message}`);
    await prisma.accountingIntegration.update({ where: { id: integration.id }, data: { status: 'ERROR' } });
  }
}

export async function runSync() {
  const integrations = await prisma.accountingIntegration.findMany({
    where: { provider: 'FORTNOX', syncEnabled: true, status: { in: ['ACTIVE', 'ERROR'] } },
  });

  logger.info(`Sync scheduler: running for ${integrations.length} Fortnox integration(s)`);
  for (const integration of integrations) {
    await syncFortnoxIntegration(integration as any);
  }
}

export function startSyncScheduler() {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Fortnox sync: cron triggered');
    await runSync();
  });
  logger.info('Fortnox sync scheduler started (every 6 hours)');
}
