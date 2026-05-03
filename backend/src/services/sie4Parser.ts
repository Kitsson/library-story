export interface SIE4Transaction {
  series: string;
  verNr: string;
  date: Date;
  description: string;
  kontonr: string;
  amount: number;
  rowIndex: number;
}

export interface SIE4Data {
  company: string;
  transactions: SIE4Transaction[];
}

export function parseSIE4(content: string): SIE4Data {
  const lines = content.split(/\r?\n/);
  let company = 'Unknown';
  const transactions: SIE4Transaction[] = [];

  let currentSeries = '';
  let currentVerNr = '';
  let currentDate = new Date();
  let currentDescription = '';
  let rowIndex = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    const tokens = tokenizeSIE(line);
    if (!tokens.length) continue;

    const tag = tokens[0].toUpperCase();

    if (tag === '#FNAMN' && tokens[1]) {
      company = tokens[1].replace(/^"|"$/g, '');
    } else if (tag === '#VER') {
      // #VER series verNr date [description]
      currentSeries = tokens[1] ? tokens[1].replace(/^"|"$/g, '') : 'A';
      currentVerNr = tokens[2] ? tokens[2].replace(/^"|"$/g, '') : String(rowIndex);
      currentDate = parseSIEDate(tokens[3] || '');
      currentDescription = tokens[4] ? tokens[4].replace(/^"|"$/g, '') : '';
      rowIndex = 0;
    } else if (tag === '#TRANS') {
      // #TRANS kontonr {} amount [date] [description]
      const kontonr = tokens[1] ? tokens[1].replace(/^"|"$/g, '') : '';
      const amountStr = tokens[3] ? tokens[3].replace(/^"|"$/g, '') : '0';
      const amount = parseFloat(amountStr) || 0;
      const txDate = tokens[4] && tokens[4] !== '{}' ? parseSIEDate(tokens[4]) : currentDate;
      const description = tokens[5] ? tokens[5].replace(/^"|"$/g, '') : currentDescription;

      if (kontonr && amount !== 0) {
        transactions.push({
          series: currentSeries,
          verNr: currentVerNr,
          date: txDate,
          description,
          kontonr,
          amount,
          rowIndex: rowIndex++,
        });
      }
    }
  }

  return { company, transactions };
}

function tokenizeSIE(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === ' ' || line[i] === '\t') { i++; continue; }
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      tokens.push(line.slice(i, j + 1));
      i = j + 1;
    } else if (line[i] === '{') {
      let j = i + 1;
      while (j < line.length && line[j] !== '}') j++;
      tokens.push(line.slice(i, j + 1));
      i = j + 1;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ' ' && line[j] !== '\t') j++;
      tokens.push(line.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

function parseSIEDate(raw: string): Date {
  const s = raw.replace(/^"|"$/g, '').trim();
  if (s.length === 8) {
    const year = parseInt(s.slice(0, 4));
    const month = parseInt(s.slice(4, 6)) - 1;
    const day = parseInt(s.slice(6, 8));
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
