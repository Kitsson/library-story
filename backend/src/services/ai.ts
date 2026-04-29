import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

interface TransactionInput {
  description: string;
  amount: number;
  date: Date;
  clientIndustry: string;
}

interface CategorizationResult {
  account: string;
  accountName: string;
  vatCode: string;
  costCenter?: string;
  confidence: number;
  reasoning: string;
}

export class OpenAIService {
  async categorizeTransaction(input: TransactionInput): Promise<CategorizationResult> {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert Swedish accountant AI. Categorize transactions using the Swedish BAS chart of accounts (BAS 2024).
Common accounts:
- 1510: Accounts Receivable (Kundfordringar)
- 1930: Business Account (Företagskonto)
- 2440: Accounts Payable (Leverantörsskulder)
- 2610: Output VAT 25% (Utgående moms)
- 2640: Input VAT (Ingående moms)
- 2710: Payroll Tax (Personalens källskatt)
- 3000-3999: Sales/Revenue
- 4000-6999: Costs/Expenses
- 7210: Rent (Lokalhyra)
- 7690: Other admin costs
VAT codes: 05=25%, 06=12%, 07=6%, 08=0%
Respond ONLY in JSON with keys: account, accountName, vatCode, costCenter, confidence (0-1), reasoning`,
          },
          {
            role: 'user',
            content: `Categorize this transaction:
Description: "${input.description}"
Amount: ${input.amount} SEK
Date: ${input.date.toISOString().split('T')[0]}
Client Industry: ${input.clientIndustry}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        account: parsed.account || '6991',
        accountName: parsed.accountName || 'Övriga externa kostnader',
        vatCode: parsed.vatCode || '',
        costCenter: parsed.costCenter,
        confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      logger.error('Groq categorization error:', error);
      return {
        account: '6991',
        accountName: 'Övriga externa kostnader',
        vatCode: '',
        confidence: 0,
        reasoning: 'AI categorization failed, using fallback',
      };
    }
  }

  async detectAdvisoryOpportunity(content: string): Promise<{
    isAdvisory: boolean;
    confidence: number;
    topics: string[];
    type: string;
  }> {
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Analyze if a client communication contains advisory content that should be billed separately from routine accounting work.
Advisory topics include: cash flow, growth strategy, hiring, pricing, tax planning, investments, loans, business structure changes.
Respond ONLY in JSON: { "isAdvisory": boolean, "confidence": 0-1, "topics": ["topic1"], "type": "CASH_FLOW|TAX_PLANNING|VIRTUAL_CFO|GROWTH|COST_REDUCTION|COMPLIANCE|CUSTOM" }`,
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      return JSON.parse(completion.choices[0].message.content || '{"isAdvisory":false,"confidence":0,"topics":[],"type":"CUSTOM"}');
    } catch (error) {
      logger.error('Groq advisory detection error:', error);
      return { isAdvisory: false, confidence: 0, topics: [], type: 'CUSTOM' };
    }
  }
}
