import { describe, expect, it } from "vitest";
import {
  matchBankLinesToLedger,
  parseBankDate,
  parseBankStatement,
  parseMoneyAmount,
} from "./bank-statement";

describe("bank statement parsing", () => {
  it("parses money with commas and parentheses", () => {
    expect(parseMoneyAmount("$1,234.56")).toBe(1234.56);
    expect(parseMoneyAmount("(45.00)")).toBe(-45);
    expect(parseMoneyAmount("-12.5")).toBe(-12.5);
  });

  it("parses common date formats", () => {
    expect(parseBankDate("2026-07-15")).toBe("2026-07-15");
    expect(parseBankDate("07/15/2026")).toBe("2026-07-15");
    expect(parseBankDate("20260715")).toBe("2026-07-15");
  });

  it("parses CSV with Date, Description, Amount", () => {
    const csv = `Date,Description,Amount
07/01/2026,CLIENT PAYMENT INV-100,1500.00
07/02/2026,SHELL FUEL,-47.50
07/03/2026,BAD ROW,`;

    const result = parseBankStatement(csv);
    expect(result.format).toBe("csv");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].amount).toBe(1500);
    expect(result.lines[0].side).toBe("credit");
    expect(result.lines[1].amount).toBe(-47.5);
    expect(result.lines[1].side).toBe("debit");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("parses CSV with separate Debit/Credit columns", () => {
    const csv = `Posted Date,Payee,Debit,Credit
06/30/2026,Vendor A,100.00,
06/30/2026,Customer B,,250.00`;

    const result = parseBankStatement(csv);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].amount).toBe(-100);
    expect(result.lines[1].amount).toBe(250);
  });

  it("parses OFX STMTTRN blocks", () => {
    const ofx = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260710
<TRNAMT>500.00
<FITID>abc123
<NAME>INVOICE PAYMENT
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260711
<TRNAMT>-32.10
<FITID>def456
<NAME>UBER
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1200.00
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const result = parseBankStatement(ofx);
    expect(result.format).toBe("ofx");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].reference).toBe("abc123");
    expect(result.lines[1].amount).toBe(-32.1);
    expect(result.endingBalance).toBe(1200);
  });

  it("matches ledger by amount and date", () => {
    const matches = matchBankLinesToLedger(
      [
        {
          date: "2026-07-10",
          description: "CLIENT PAYMENT",
          amount: 500,
          side: "credit",
          reference: null,
          raw: "",
        },
        {
          date: "2026-07-11",
          description: "UNKNOWN FEE",
          amount: -9.99,
          side: "debit",
          reference: null,
          raw: "",
        },
      ],
      [
        {
          id: "tx1",
          amount: 500,
          transactionDate: "2026-07-10T00:00:00.000Z",
          description: "Client payment",
          paymentReference: null,
          transactionNumber: "TX-1",
          transactionType: "income",
        },
      ]
    );

    expect(matches[0].matchedTransactionId).toBe("tx1");
    expect(matches[0].confidence).toBe("exact");
    expect(matches[1].matchedTransactionId).toBeNull();
    expect(matches[1].confidence).toBe("none");
  });
});
