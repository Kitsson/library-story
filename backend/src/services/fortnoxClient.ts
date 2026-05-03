import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

const FORTNOX_AUTH_URL = 'https://apps.fortnox.se/oauth-v1/oauth-authorize';
const FORTNOX_TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/oauth-token';
const FORTNOX_API_BASE = 'https://api.fortnox.se/3';
const FORTNOX_SCOPE = 'bookkeeping';

export interface FortnoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface FortnoxVoucherRow {
  Account: number;
  Debit: number;
  Credit: number;
  TransactionInformation: string;
  CostCenter?: string;
}

export interface FortnoxVoucher {
  VoucherSeries: string;
  VoucherNumber: number;
  TransactionDate: string;
  Description: string;
  VoucherRows: FortnoxVoucherRow[];
}

function clientCredentials(): string {
  const id = process.env.FORTNOX_CLIENT_ID!;
  const secret = process.env.FORTNOX_CLIENT_SECRET!;
  return Buffer.from(`${id}:${secret}`).toString('base64');
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.FORTNOX_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: FORTNOX_SCOPE,
    state,
  });
  return `${FORTNOX_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<FortnoxTokens> {
  const res = await fetch(FORTNOX_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${clientCredentials()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fortnox token exchange failed: ${res.status} ${body}`);
  }
  const data = await res.json() as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

export async function refreshAccessToken(encryptedRefreshToken: string): Promise<FortnoxTokens> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const res = await fetch(FORTNOX_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${clientCredentials()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fortnox token refresh failed: ${res.status} ${body}`);
  }
  const data = await res.json() as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

export class FortnoxClient {
  constructor(private accessToken: string) {}

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${FORTNOX_API_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Fortnox API error ${res.status}: ${body}`);
    }
    return res.json() as T;
  }

  async fetchVouchers(fromDate: Date, toDate: Date = new Date()): Promise<FortnoxVoucher[]> {
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const vouchers: FortnoxVoucher[] = [];
    let page = 1;

    while (true) {
      const data = await this.get<any>('/vouchers', {
        fromdate: fmt(fromDate),
        todate: fmt(toDate),
        limit: '500',
        page: String(page),
      });
      const batch: FortnoxVoucher[] = data.Vouchers || [];
      vouchers.push(...batch);
      if (batch.length < 500) break;
      page++;
    }

    // Fetch full voucher details (including VoucherRows) for each
    const detailed: FortnoxVoucher[] = [];
    for (const v of vouchers) {
      try {
        const detail = await this.get<any>(`/vouchers/${v.VoucherSeries}/${v.VoucherNumber}`);
        if (detail.Voucher) detailed.push(detail.Voucher);
      } catch (err) {
        logger.warn(`Could not fetch Fortnox voucher ${v.VoucherSeries}/${v.VoucherNumber}: ${(err as Error).message}`);
      }
    }
    return detailed;
  }
}

export function mapVouchersToTransactions(
  vouchers: FortnoxVoucher[],
  clientId: string,
  integrationId: string,
) {
  const rows = [];
  for (const voucher of vouchers) {
    for (let i = 0; i < (voucher.VoucherRows || []).length; i++) {
      const row = voucher.VoucherRows[i];
      const amount = row.Credit > 0 ? row.Credit : -row.Debit;
      if (amount === 0) continue;
      rows.push({
        clientId,
        externalId: `fortnox-${voucher.VoucherSeries}-${voucher.VoucherNumber}-${i}`,
        description: row.TransactionInformation || voucher.Description || '',
        amount,
        currency: 'SEK',
        date: new Date(voucher.TransactionDate),
        finalAccount: String(row.Account),
        finalVatCode: undefined as string | undefined,
        status: 'UNCATEGORIZED' as const,
        integrationId,
      });
    }
  }
  return rows;
}
