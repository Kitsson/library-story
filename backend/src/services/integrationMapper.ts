import { SIE4Transaction } from './sie4Parser';

export interface MappedTransaction {
  externalId: string;
  description: string;
  amount: number;
  currency: string;
  date: Date;
  finalAccount: string;
  finalVatCode: string | null;
  integrationId: string;
}

// Map SIE4 BAS account number to a VAT code heuristic
function inferVatCode(kontonr: string): string | null {
  const k = parseInt(kontonr);
  // Output VAT accounts
  if (k >= 2610 && k <= 2650) return '05';
  // Input VAT accounts
  if (k >= 2640 && k <= 2649) return '05';
  // Expense accounts commonly carry 25% VAT
  if (k >= 5000 && k <= 6999) return '05';
  // Rent-related (12% VAT in Sweden)
  if (k === 7210 || k === 7211) return '06';
  return null;
}

export function mapSIE4ToTransactions(
  sie4Txs: SIE4Transaction[],
  clientId: string,
  integrationId: string,
): MappedTransaction[] {
  return sie4Txs.map(tx => ({
    externalId: `${integrationId}-${tx.series}-${tx.verNr}-${tx.rowIndex}`,
    description: tx.description || `${tx.series}${tx.verNr}`,
    amount: tx.amount,
    currency: 'SEK',
    date: tx.date,
    finalAccount: tx.kontonr,
    finalVatCode: inferVatCode(tx.kontonr),
    integrationId,
  }));
}
