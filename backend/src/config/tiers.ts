export const PRICE_TIER_MAP: Record<string, {
  tier: 'KLARSTART' | 'KLARPRO' | 'KLARFIRM';
  maxUsers: number;
  maxClients: number;
  smsQuota: number;
  aiQuota: number;
}> = {
  'price_1TQDynGd49W60xYGre2aRiOO': { tier: 'KLARSTART', maxUsers: 3,  maxClients: 10,    smsQuota: 50,    aiQuota: 200   },
  'price_1TQE4DGd49W60xYGR36TO7D3': { tier: 'KLARPRO',   maxUsers: 15, maxClients: 50,    smsQuota: 300,   aiQuota: 99999 },
  'price_1TQE6kGd49W60xYGnEICl8aA': { tier: 'KLARFIRM',  maxUsers: 50, maxClients: 99999, smsQuota: 99999, aiQuota: 99999 },
};
