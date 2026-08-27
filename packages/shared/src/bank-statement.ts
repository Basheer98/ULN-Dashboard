/**
 * Bank statement parsing + matching for reconciliation.
 * Supports CSV (flexible headers) and simple OFX/QFX.
 */

export type BankStatementSide = "credit" | "debit";

export interface ParsedBankLine {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // signed: credit +, debit -
  side: BankStatementSide;
  reference: string | null;
  raw: string;
}

export interface BankStatementParseResult {
  format: "csv" | "ofx" | "unknown";
  lines: ParsedBankLine[];
  errors: string[];
  startingBalance: number | null;
  endingBalance: number | null;
}

export interface LedgerCandidate {
  id: string;
  amount: number; // signed for recon (income +, expense -)
  transactionDate: string; // ISO
  description: string | null;
  paymentReference: string | null;
  transactionNumber: string;
  transactionType: string;
}

export interface BankMatchResult {
  statementLine: ParsedBankLine;
  matchedTransactionId: string | null;
  confidence: "exact" | "strong" | "weak" | "none";
  reason: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseBankDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  // OFX YYYYMMDD
  if (/^\d{8}$/.test(v)) {
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T12:00:00Z`);
    return isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  // MM/DD/YYYY or M/D/YY
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return toIsoDate(d);
}

export function parseMoneyAmount(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;
  // accounting negatives (123.45)
  const paren = cleaned.match(/^\((.+)\)$/);
  const num = Number(paren ? `-${paren[1]}` : cleaned);
  if (!Number.isFinite(num)) return null;
  return roundMoney(num);
}

/** Minimal CSV parser with quotes */
export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

function detectCsvColumns(headers: string[]): {
  date?: number;
  description?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  reference?: number;
} {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) => {
    for (const name of names) {
      const idx = norm.findIndex((h) => h === name || h.includes(name));
      if (idx >= 0) return idx;
    }
    return undefined;
  };

  return {
    date: find("date", "posted", "transaction date", "trans date"),
    description: find("description", "memo", "payee", "name", "details"),
    amount: find("amount", "transaction amount"),
    debit: find("debit", "withdrawal", "withdrawals"),
    credit: find("credit", "deposit", "deposits"),
    reference: find("reference", "check", "check number", "ref", "fitid"),
  };
}

function parseCsvStatement(text: string): BankStatementParseResult {
  const matrix = parseCsvMatrix(text.trim());
  const errors: string[] = [];
  if (matrix.length < 2) {
    return { format: "csv", lines: [], errors: ["CSV has no data rows"], startingBalance: null, endingBalance: null };
  }

  // Find header row (first row with a date-like column name)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const cols = detectCsvColumns(matrix[i]);
    if (cols.date !== undefined && (cols.amount !== undefined || cols.debit !== undefined || cols.credit !== undefined)) {
      headerIdx = i;
      break;
    }
  }

  const cols = detectCsvColumns(matrix[headerIdx]);
  if (cols.date === undefined) {
    return {
      format: "csv",
      lines: [],
      errors: ["Could not find a Date column in the statement CSV"],
      startingBalance: null,
      endingBalance: null,
    };
  }

  const lines: ParsedBankLine[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    const dateRaw = row[cols.date] ?? "";
    const date = parseBankDate(dateRaw);
    if (!date) {
      if (dateRaw.trim()) errors.push(`Row ${i + 1}: invalid date "${dateRaw}"`);
      continue;
    }

    const description = (cols.description !== undefined ? row[cols.description] : "")?.trim() || "Bank transaction";
    const reference =
      cols.reference !== undefined ? row[cols.reference]?.trim() || null : null;

    let amount: number | null = null;
    if (cols.amount !== undefined) {
      amount = parseMoneyAmount(row[cols.amount] ?? "");
    } else {
      const debit = cols.debit !== undefined ? parseMoneyAmount(row[cols.debit] ?? "") : null;
      const credit = cols.credit !== undefined ? parseMoneyAmount(row[cols.credit] ?? "") : null;
      if (credit && credit !== 0) amount = Math.abs(credit);
      else if (debit && debit !== 0) amount = -Math.abs(debit);
    }

    if (amount === null || amount === 0) {
      errors.push(`Row ${i + 1}: missing amount`);
      continue;
    }

    // If amount column is always positive with a type column, sign by description heuristics is unsafe —
    // prefer explicit debit/credit columns. For single Amount column, keep bank sign as-is.
    lines.push({
      date,
      description,
      amount: roundMoney(amount),
      side: amount >= 0 ? "credit" : "debit",
      reference,
      raw: row.join(","),
    });
  }

  return {
    format: "csv",
    lines,
    errors,
    startingBalance: null,
    endingBalance: null,
  };
}

function ofxTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^\\r\\n<]+)`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() ?? null;
}

function parseOfxStatement(text: string): BankStatementParseResult {
  const errors: string[] = [];
  const lines: ParsedBankLine[] = [];

  const stmtTrn = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>|<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];

  for (const block of stmtTrn) {
    const fitid = ofxTag(block, "FITID");
    const dtposted = ofxTag(block, "DTPOSTED");
    const trnamt = ofxTag(block, "TRNAMT");
    const name = ofxTag(block, "NAME") ?? ofxTag(block, "MEMO") ?? "Bank transaction";
    const memo = ofxTag(block, "MEMO");

    if (!dtposted || !trnamt) {
      errors.push("OFX transaction missing date or amount");
      continue;
    }

    const date = parseBankDate(dtposted.slice(0, 8));
    const amount = parseMoneyAmount(trnamt);
    if (!date || amount === null) {
      errors.push(`OFX transaction unparseable: ${fitid ?? "?"}`);
      continue;
    }

    lines.push({
      date,
      description: memo && memo !== name ? `${name} — ${memo}` : name,
      amount: roundMoney(amount),
      side: amount >= 0 ? "credit" : "debit",
      reference: fitid,
      raw: block.slice(0, 200),
    });
  }

  const balAmt = ofxTag(text, "BALAMT");
  const endingBalance = balAmt ? parseMoneyAmount(balAmt) : null;

  return {
    format: "ofx",
    lines,
    errors,
    startingBalance: null,
    endingBalance,
  };
}

export function parseBankStatement(text: string): BankStatementParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      format: "unknown",
      lines: [],
      errors: ["Empty statement file"],
      startingBalance: null,
      endingBalance: null,
    };
  }

  if (/OFXHEADER|<OFX|<BANKMSGSRSV1|<CREDITCARDMSGSRSV1/i.test(trimmed)) {
    return parseOfxStatement(trimmed);
  }

  return parseCsvStatement(trimmed);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T12:00:00Z`).getTime();
  const db = new Date(`${b}T12:00:00Z`).getTime();
  return Math.abs(da - db) / (1000 * 60 * 60 * 24);
}

function normalizeText(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Greedy match: each ledger tx used at most once.
 * Exact: same amount + same date (+ optional ref)
 * Strong: same amount + within 3 days
 * Weak: same amount + within 7 days + description overlap
 */
export function matchBankLinesToLedger(
  lines: ParsedBankLine[],
  ledger: LedgerCandidate[]
): BankMatchResult[] {
  const remaining = [...ledger];
  const results: BankMatchResult[] = [];

  for (const line of lines) {
    const absLine = roundMoney(line.amount);
    const candidates = remaining
      .map((tx) => {
        const amountOk = roundMoney(tx.amount) === absLine;
        if (!amountOk) return null;

        const txDate = tx.transactionDate.slice(0, 10);
        const dayDiff = daysBetween(line.date, txDate);

        let score = 0;
        let confidence: BankMatchResult["confidence"] = "none";
        let reason = "";

        if (line.reference && tx.paymentReference && normalizeText(line.reference) === normalizeText(tx.paymentReference)) {
          score = 100;
          confidence = "exact";
          reason = "Amount + reference match";
        } else if (dayDiff === 0) {
          score = 90;
          confidence = "exact";
          reason = "Amount + same date";
        } else if (dayDiff <= 3) {
          score = 70;
          confidence = "strong";
          reason = `Amount + ${dayDiff} day(s) apart`;
        } else if (dayDiff <= 7) {
          const descA = normalizeText(line.description);
          const descB = normalizeText(tx.description);
          const overlap =
            descA &&
            descB &&
            (descA.includes(descB.slice(0, 12)) || descB.includes(descA.slice(0, 12)));
          if (overlap) {
            score = 50;
            confidence = "weak";
            reason = `Amount + description within ${dayDiff} days`;
          } else {
            return null;
          }
        } else {
          return null;
        }

        return { tx, score, confidence, reason };
      })
      .filter(Boolean) as Array<{
      tx: LedgerCandidate;
      score: number;
      confidence: BankMatchResult["confidence"];
      reason: string;
    }>;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    if (!best) {
      results.push({
        statementLine: line,
        matchedTransactionId: null,
        confidence: "none",
        reason: "No ledger match",
      });
      continue;
    }

    const idx = remaining.findIndex((t) => t.id === best.tx.id);
    if (idx >= 0) remaining.splice(idx, 1);

    results.push({
      statementLine: line,
      matchedTransactionId: best.tx.id,
      confidence: best.confidence,
      reason: best.reason,
    });
  }

  return results;
}
