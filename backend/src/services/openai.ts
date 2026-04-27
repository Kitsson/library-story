/**
 * OpenAI Service
 * AI-powered transaction categorization and advisory detection
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert Swedish accountant AI. Categorize transactions using the Swedish BAS chart of accounts (BAS 2024).
            Common accounts:
            - 1510: Accounts Receivable (Kundfordringar)
            - 1930: Business Account (Företagskonto)
            - 2013: Owner's Equity (Eget kapital)
            - 2440: Accounts Payable (Leverantörsskulder)
            - 2610: Output VAT 25% (Utgående moms)
            - 2640: Input VAT (Ingående moms)
            - 2710: Payroll Tax (Personalens källskatt)
            - 3000-3999: Sales/Revenue
            - 4000-6999: Costs/Expenses
            - 7210: Rent (Lokalhyra)
            - 7690: Other admin costs
            
            VAT codes:
            - 05: 25% VAT
            - 06: 12% VAT
            - 07: 6% VAT
            - 08: 0% VAT
            
            Respond ONLY in JSON format with keys: account, accountName, vatCode, costCenter, confidence (0-1), reasoning`,
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
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      return {
        account: result.account || '6991',
        accountName: result.accountName || 'Övriga externa kostnader',
        vatCode: result.vatCode || '',
        costCenter: result.costCenter,
        confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
        reasoning: result.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      logger.error('OpenAI categorization error:', error);
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
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze if this client communication contains advisory content that should be billed separately from routine accounting work.
            Advisory topics include: cash flow, growth strategy, hiring, pricing, tax planning, investments, loans, business structure changes.
            Respond ONLY in JSON: { "isAdvisory": boolean, "confidence": 0-1, "topics": ["topic1", "topic2"], "type": "CASH_FLOW|TAX_PLANNING|VIRTUAL_CFO|GROWTH|COST_REDUCTION|COMPLIANCE|CUSTOM" }`,
          },
          { role: 'user', content },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const content2 = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content2.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"isAdvisory":false,"confidence":0,"topics":[],"type":"CUSTOM"}');
    } catch (error) {
      logger.error('OpenAI advisory detection error:', error);
      return { isAdvisory: false, confidence: 0, topics: [], type: 'CUSTOM' };
    }
  }
}