"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExpenseDuplicateMatch } from "@uln/shared";

interface ExpenseSmartHintsProps {
  amount: number | null;
  transactionDate: string;
  description: string;
  fielderId?: string;
  vendorId?: string;
  onCategorySuggestion?: (categoryId: string | null, vendorId: string | null) => void;
  onDuplicateChange?: (duplicates: ExpenseDuplicateMatch[]) => void;
}

export function ExpenseSmartHints({
  amount,
  transactionDate,
  description,
  fielderId,
  vendorId,
  onCategorySuggestion,
  onDuplicateChange,
}: ExpenseSmartHintsProps) {
  const [duplicates, setDuplicates] = useState<ExpenseDuplicateMatch[]>([]);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);
  const [policyHint, setPolicyHint] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCategorySuggestionRef = useRef(onCategorySuggestion);
  const onDuplicateChangeRef = useRef(onDuplicateChange);
  onCategorySuggestionRef.current = onCategorySuggestion;
  onDuplicateChangeRef.current = onDuplicateChange;

  const fetchSuggestions = useCallback(async () => {
    if (!amount || amount <= 0) {
      setDuplicates([]);
      onDuplicateChangeRef.current?.([]);
      return;
    }

    const res = await fetch("/api/v1/finance/expenses/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        transactionDate,
        description: description || undefined,
        fielderId: fielderId || undefined,
        vendorId: vendorId || undefined,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();

    setDuplicates(data.duplicates ?? []);
    onDuplicateChangeRef.current?.(data.duplicates ?? []);

    if (data.categorySuggestion?.categoryId) {
      onCategorySuggestionRef.current?.(
        data.categorySuggestion.categoryId,
        data.categorySuggestion.vendorId
      );
      setCategoryHint(data.categorySuggestion.reason);
    } else {
      setCategoryHint(null);
    }

    const hints: string[] = [];
    if (data.policy?.receiptRequiredAbove && amount >= data.policy.receiptRequiredAbove) {
      hints.push(
        `Receipt required for amounts ≥ $${Number(data.policy.receiptRequiredAbove).toFixed(2)}.`
      );
    }
    if (data.policy?.expenseReviewAbove && amount >= data.policy.expenseReviewAbove) {
      hints.push(
        `Amounts ≥ $${Number(data.policy.expenseReviewAbove).toFixed(2)} go to pending review.`
      );
    }
    setPolicyHint(hints.length ? hints.join(" ") : null);
  }, [amount, transactionDate, description, fielderId, vendorId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchSuggestions();
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchSuggestions]);

  if (!duplicates.length && !categoryHint && !policyHint) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface/50 p-3 text-sm">
      {categoryHint && (
        <p className="text-muted-foreground">
          <span className="font-medium text-accent">Suggested category:</span> {categoryHint}
        </p>
      )}
      {policyHint && <p className="text-muted-foreground">{policyHint}</p>}
      {duplicates.length > 0 && (
        <div className="text-warning">
          <p className="font-medium">Possible duplicate{duplicates.length > 1 ? "s" : ""}</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {duplicates.map((dup) => (
              <li key={dup.id}>
                {dup.transactionNumber} — ${dup.amount.toFixed(2)} on {dup.transactionDate}
                {dup.description ? ` (${dup.description})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ReceiptScanResult {
  receipt: { id: string };
  ocr: {
    amount: number | null;
    transactionDate: string | null;
    vendorName: string | null;
    ok?: boolean;
    error?: string | null;
  };
  ocrOk?: boolean;
  ocrError?: string | null;
  suggestions?: {
    categorySuggestion?: { categoryId: string | null; vendorId: string | null };
  };
}

export function ReceiptScanField({
  onScanned,
}: {
  onScanned: (result: ReceiptScanResult) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [fileLabel, setFileLabel] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError("");
    setWarning("");
    setFileLabel(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/finance/receipts/scan", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      const ocrError = data.ocrError || data.ocr?.error;
      if (ocrError) {
        setWarning(ocrError);
      }
      onScanned(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setFileLabel(null);
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="label">Receipt (scan &amp; upload)</label>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        disabled={scanning}
        className="w-full max-w-md"
      />
      {scanning && <p className="text-xs text-muted-foreground">Scanning receipt…</p>}
      {!scanning && fileLabel && !error && (
        <p className="text-xs text-accent">Attached: {fileLabel}</p>
      )}
      {warning && <p className="text-xs text-warning">{warning}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
