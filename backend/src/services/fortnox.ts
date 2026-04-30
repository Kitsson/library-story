import axios from 'axios';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const FORTNOX_AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
const FORTNOX_TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';
const FORTNOX_API = 'https://api.fortnox.se/3';

export function buildFortnoxAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FORTNOX_CLIENT_ID!,
    redirect_uri: process.env.FORTNOX_REDIRECT_URI!,
    scope: 'companyinformation bookkeeping customer invoice',
    state,
    response_type: 'code',
    access_type: 'offline',
  });
  return `${FORTNOX_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFortnoxCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const resp = await axios.post(FORTNOX_TOKEN_URL, new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.FORTNOX_REDIRECT_URI!,
    client_id: process.env.FORTNOX_CLIENT_ID!,
    client_secret: process.env.FORTNOX_CLIENT_SECRET!,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  return {
    accessToken: resp.data.access_token,
    refreshToken: resp.data.refresh_token,
    expiresIn: resp.data.expires_in ?? 3600,
  };
}

async function getAccessToken(orgId: string): Promise<string> {
  const integration = await prisma.accountingIntegration.findUnique({
    where: { organizationId_provider: { organizationId: orgId, provider: 'FORTNOX' } },
  });
  if (!integration) throw new Error('Fortnox not connected for this organization.');

  // Refresh token if expiring within 60 seconds
  if (integration.tokenExpiry && integration.tokenExpiry <= new Date(Date.now() + 60_000)) {
    if (!integration.refreshToken) throw new Error('No refresh token — please reconnect Fortnox.');

    const resp = await axios.post(FORTNOX_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
      client_id: process.env.FORTNOX_CLIENT_ID!,
      client_secret: process.env.FORTNOX_CLIENT_SECRET!,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token, refresh_token, expires_in } = resp.data;
    await prisma.accountingIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token ?? integration.refreshToken,
        tokenExpiry: new Date(Date.now() + (expires_in ?? 3600) * 1000),
      },
    });
    return access_token;
  }

  return integration.accessToken;
}

async function fortnoxGet(orgId: string, path: string, params?: Record<string, any>): Promise<any> {
  const token = await getAccessToken(orgId);
  const resp = await axios.get(`${FORTNOX_API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    params,
  });
  return resp.data;
}

export async function syncFortnox(orgId: string): Promise<{ clients: number; transactions: number; errors: string[] }> {
  const results = { clients: 0, transactions: 0, errors: [] as string[] };

  const integration = await prisma.accountingIntegration.findUnique({
    where: { organizationId_provider: { organizationId: orgId, provider: 'FORTNOX' } },
  });
  if (!integration) throw new Error('Fortnox not connected.');

  // 1. Sync Fortnox Customers → KLARY Clients
  try {
    let page = 1;
    while (true) {
      const data = await fortnoxGet(orgId, '/customers', { page, limit: 100 });
      const customers: any[] = data.Customers ?? [];
      if (customers.length === 0) break;

      for (const c of customers) {
        const extId = `FORTNOX-${c.CustomerNumber}`;
        const existing = await prisma.client.findFirst({
          where: { organizationId: orgId, externalId: extId },
        });
        if (!existing) {
          await prisma.client.create({
            data: {
              name: c.Name,
              orgNumber: c.OrganisationNumber || null,
              email: c.Email || null,
              phone: c.Phone1 || c.Phone2 || null,
              contactName: c.YourReference || null,
              address: c.Address1 || null,
              city: c.City || null,
              postalCode: c.ZipCode || null,
              externalId: extId,
              organizationId: orgId,
              status: c.Active === false ? 'INACTIVE' : 'ACTIVE',
            },
          });
          results.clients++;
        }
      }

      page++;
      if (customers.length < 100) break;
    }
    logger.info(`Fortnox: synced ${results.clients} new clients for org ${orgId}`);
  } catch (e: any) {
    logger.error(`Fortnox customer sync error for org ${orgId}: ${e.message}`);
    results.errors.push(`Customers: ${e.message}`);
  }

  // 2. Sync Customer Invoices → KLARY Transactions
  try {
    let page = 1;
    while (true) {
      const data = await fortnoxGet(orgId, '/invoices', {
        page,
        limit: 100,
        sortby: 'invoicedate',
        sortorder: 'descending',
      });
      const invoices: any[] = data.Invoices ?? [];
      if (invoices.length === 0) break;

      for (const inv of invoices) {
        const client = await prisma.client.findFirst({
          where: { organizationId: orgId, externalId: `FORTNOX-${inv.CustomerNumber}` },
        });
        if (!client) continue;

        await prisma.transaction.upsert({
          where: { clientId_externalId: { clientId: client.id, externalId: `FORTNOX-INV-${inv.DocumentNumber}` } },
          update: {},
          create: {
            externalId: `FORTNOX-INV-${inv.DocumentNumber}`,
            amount: inv.Total ?? 0,
            currency: inv.Currency || 'SEK',
            description: [
              `Faktura #${inv.DocumentNumber}`,
              inv.CustomerName,
              inv.Comments,
            ].filter(Boolean).join(' – '),
            date: new Date(inv.InvoiceDate),
            clientId: client.id,
            integrationId: integration.id,
            status: 'UNCATEGORIZED',
          },
        });
        results.transactions++;
      }

      page++;
      if (invoices.length < 100) break;
    }
    logger.info(`Fortnox: synced ${results.transactions} invoices for org ${orgId}`);
  } catch (e: any) {
    logger.error(`Fortnox invoice sync error for org ${orgId}: ${e.message}`);
    results.errors.push(`Invoices: ${e.message}`);
  }

  await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      status: results.errors.length > 0 ? 'ERROR' : 'ACTIVE',
    },
  });

  return results;
}
