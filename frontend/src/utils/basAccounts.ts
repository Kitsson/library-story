export const BAS_ACCOUNTS: Record<string, string> = {
  // Revenue (3xxx)
  '3000': 'Försäljning',
  '3010': 'Försäljning varor',
  '3020': 'Försäljning tjänster',
  '3500': 'Fakturerade kostnader',
  '3900': 'Övriga rörelseintäkter',

  // Cost of goods (4xxx)
  '4000': 'Inköp av varor',
  '4010': 'Inköp råmaterial',
  '4400': 'Varor för återförsäljning',
  '4500': 'Inköp av tjänster',
  '4600': 'Legoarbeten / underentreprenad',
  '4690': 'Övriga externa tjänster',

  // Premises & facilities (5xxx)
  '5000': 'Lokalkostnader',
  '5010': 'Hyra av lokal',
  '5011': 'Hyra',
  '5020': 'El och vatten',
  '5060': 'Städning och renhållning',
  '5090': 'Övriga lokalkostnader',
  '5400': 'Förbrukningsinventarier',
  '5410': 'Förbrukningsinventarier',
  '5460': 'Förbrukningsmaterial',
  '5500': 'Reparation och underhåll',
  '5600': 'Transportmedelskostnader',
  '5610': 'Drivmedel',
  '5615': 'Bilförsäkring',
  '5620': 'Bilreparation',
  '5630': 'Fordonsskatt',
  '5800': 'Resekostnader',
  '5801': 'Inrikes resor',
  '5802': 'Utrikesresor',
  '5810': 'Logikostnader',
  '5830': 'Konferenskostnader',
  '5900': 'Reklam och PR',
  '5910': 'Reklamkostnader',

  // Admin & office (6xxx)
  '6100': 'Kontorsmaterial och trycksaker',
  '6110': 'Kontorsmaterial',
  '6200': 'Tele och post',
  '6210': 'Telefon',
  '6211': 'Fast telefoni',
  '6212': 'Mobiltelefon',
  '6250': 'Porto',
  '6300': 'IT-kostnader',
  '6310': 'Programvarulicenser',
  '6320': 'Hårdvara',
  '6330': 'IT-tjänster',
  '6340': 'Datakommunikation',
  '6510': 'Revisionsarvode',
  '6520': 'Redovisningskonsult',
  '6530': 'Juristkostnader',
  '6550': 'Konsultarvoden',
  '6580': 'Bankkostnader',
  '6590': 'Övriga externa tjänster',
  '6700': 'Representationskostnader',
  '6710': 'Representation (avdragsgill)',
  '6720': 'Representation (ej avdragsgill)',
  '6830': 'Försäkringspremier',
  '6910': 'Licensavgifter och royalties',
  '6970': 'Föreningsavgifter',
  '6980': 'Övriga administrativa kostnader',
  '6990': 'Övriga rörelsekostnader',

  // Personnel (7xxx)
  '7010': 'Löner tjänstemän',
  '7020': 'Löner kollektivanställda',
  '7080': 'Styrelsearvoden',
  '7090': 'Övriga löner',
  '7210': 'Arbetsgivaravgifter',
  '7220': 'Löneskatt',
  '7280': 'Pensionskostnader',
  '7290': 'Övriga sociala avgifter',
  '7321': 'Milersättning',
  '7331': 'Traktamente',
  '7380': 'Personalförmåner',
  '7410': 'Utbildning och kurser',
  '7420': 'Sjukvård',
  '7430': 'Personalrepresentation',
  '7490': 'Övriga personalkostnader',
};

const RANGE_LABELS: { pattern: RegExp; label: string }[] = [
  { pattern: /^3[0-9]{3}-3[0-9]{3}$/, label: 'Intäkter' },
  { pattern: /^4[0-9]{3}-4[0-9]{3}$/, label: 'Materialkostnader' },
  { pattern: /^5[0-9]{3}-5[0-9]{3}$/, label: 'Lokals- och reskostnader' },
  { pattern: /^6[0-9]{3}-6[0-9]{3}$/, label: 'Administrativa kostnader' },
  { pattern: /^7[0-9]{3}-7[0-9]{3}$/, label: 'Personalkostnader' },
  { pattern: /^4000-4999$/, label: 'Materialkostnader (4000–4999)' },
  { pattern: /^5000-5999$/, label: 'Lokals- och reskostnader (5000–5999)' },
  { pattern: /^6000-6999$/, label: 'Administrativa kostnader (6000–6999)' },
  { pattern: /^7000-7999$/, label: 'Personalkostnader (7000–7999)' },
];

export function basAccountName(code: string): string {
  if (!code) return '';
  const exact = BAS_ACCOUNTS[code.trim()];
  if (exact) return exact;
  for (const { pattern, label } of RANGE_LABELS) {
    if (pattern.test(code.trim())) return label;
  }
  return '';
}
