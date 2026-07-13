"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FINANCE_SETTING_KEYS } from "@uln/shared";

interface SelectOption {
  id: string;
  name: string;
}

interface CategoryOption extends SelectOption {
  subcategories?: { id: string; name: string }[];
}

export function ExpenseForm({
  categories,
  paymentMethods,
  vendors,
  projects,
  fielders,
}: {
  categories: CategoryOption[];
  paymentMethods: SelectOption[];
  vendors: SelectOption[];
  projects: SelectOption[];
  fielders: SelectOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate: form.get("transactionDate"),
        amount: Number(form.get("amount")),
        description: form.get("description") || undefined,
        businessPurpose: form.get("businessPurpose") || undefined,
        categoryId: form.get("categoryId") || null,
        subcategoryId: form.get("subcategoryId") || null,
        paymentMethodId: form.get("paymentMethodId") || null,
        projectId: form.get("projectId") || null,
        fielderId: form.get("fielderId") || null,
        vendorId: form.get("vendorId") || null,
        paidBy: form.get("paidBy") || undefined,
        isReimbursable: form.get("isReimbursable") === "on",
        isBillable: form.get("isBillable") === "on",
        notes: form.get("notes") || undefined,
        expenseStatus: "submitted",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create expense");
      setLoading(false);
      return;
    }
    router.push(`/finance/expenses/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold text-foreground">New Expense</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Date *</label>
          <input
            name="transactionDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Amount *</label>
          <input name="amount" type="number" step="0.01" min="0.01" required className="w-full" />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Subcategory</label>
          <select name="subcategoryId" className="w-full">
            <option value="">—</option>
            {(selectedCategory?.subcategories ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Vendor</label>
          <select name="vendorId" className="w-full">
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select name="paymentMethodId" className="w-full">
            <option value="">—</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Project</label>
          <select name="projectId" className="w-full">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fielder</label>
          <select name="fielderId" className="w-full">
            <option value="">—</option>
            {fielders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Paid By</label>
          <select name="paidBy" className="w-full" defaultValue="company">
            <option value="company">Company</option>
            <option value="employee">Employee</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <input name="description" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Business Purpose</label>
          <input name="businessPurpose" className="w-full" />
        </div>
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input name="isReimbursable" type="checkbox" />
            Reimbursable
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input name="isBillable" type="checkbox" />
            Billable to client
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Create Expense"}
      </button>
    </form>
  );
}

export function IncomeForm({
  clients,
  projects,
  paymentMethods,
}: {
  clients: SelectOption[];
  projects: SelectOption[];
  paymentMethods: SelectOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionDate: form.get("transactionDate"),
        amount: Number(form.get("amount")),
        incomeCategory: form.get("incomeCategory"),
        description: form.get("description") || undefined,
        clientId: form.get("clientId") || null,
        projectId: form.get("projectId") || null,
        paymentMethodId: form.get("paymentMethodId") || null,
        paymentReference: form.get("paymentReference") || undefined,
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create income");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold text-foreground">Record Income</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Date *</label>
          <input
            name="transactionDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Amount *</label>
          <input name="amount" type="number" step="0.01" min="0.01" required className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Category *</label>
          <select name="incomeCategory" required className="w-full" defaultValue="client_payment">
            <option value="client_payment">Client Payment</option>
            <option value="advance_payment">Advance Payment</option>
            <option value="partial_invoice_payment">Partial Invoice Payment</option>
            <option value="travel_reimbursement">Travel Reimbursement</option>
            <option value="expense_reimbursement">Expense Reimbursement</option>
            <option value="loan_proceeds">Loan Proceeds</option>
            <option value="owner_contribution">Owner Contribution</option>
            <option value="refund_received">Refund Received</option>
            <option value="other_income">Other Income</option>
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select name="clientId" className="w-full">
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Project</label>
          <select name="projectId" className="w-full">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select name="paymentMethodId" className="w-full">
            <option value="">—</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Reference</label>
          <input name="paymentReference" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <input name="description" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Record Income"}
      </button>
    </form>
  );
}

export function PaymentMethodForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        accountNickname: form.get("accountNickname") || undefined,
        lastFour: form.get("lastFour") || undefined,
        openingBalance: Number(form.get("openingBalance") || 0),
        currentBalance: Number(form.get("currentBalance") || 0),
        includeInDashboard: form.get("includeInDashboard") === "on",
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create payment method");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-foreground">Add Payment Method</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input name="name" required className="w-full" />
        </div>
        <div>
          <label className="label">Type *</label>
          <select name="type" required className="w-full" defaultValue="bank">
            <option value="bank">Bank</option>
            <option value="credit_card">Credit Card</option>
            <option value="debit_card">Debit Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Nickname</label>
          <input name="accountNickname" className="w-full" />
        </div>
        <div>
          <label className="label">Last Four</label>
          <input name="lastFour" maxLength={4} className="w-full" />
        </div>
        <div>
          <label className="label">Opening Balance</label>
          <input name="openingBalance" type="number" step="0.01" defaultValue="0" className="w-full" />
        </div>
        <div>
          <label className="label">Current Balance</label>
          <input name="currentBalance" type="number" step="0.01" defaultValue="0" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input name="includeInDashboard" type="checkbox" defaultChecked />
            Include in cash-on-hand dashboard
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Saving..." : "Add Payment Method"}
      </button>
    </form>
  );
}

export function VendorForm({ categories }: { categories: SelectOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        vendorType: form.get("vendorType"),
        contactName: form.get("contactName") || undefined,
        email: form.get("email") || undefined,
        phone: form.get("phone") || undefined,
        defaultCategoryId: form.get("defaultCategoryId") || null,
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create vendor");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-foreground">Add Vendor</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input name="name" required className="w-full" />
        </div>
        <div>
          <label className="label">Type *</label>
          <select name="vendorType" required className="w-full" defaultValue="supplier">
            <option value="supplier">Supplier</option>
            <option value="contractor">Contractor</option>
            <option value="utility">Utility</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Contact</label>
          <input name="contactName" className="w-full" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="w-full" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="w-full" />
        </div>
        <div>
          <label className="label">Default Category</label>
          <select name="defaultCategoryId" className="w-full">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Saving..." : "Add Vendor"}
      </button>
    </form>
  );
}

export function CategoryForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create category");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-foreground">Add Expense Category</h3>
      <div>
        <label className="label">Category Name *</label>
        <input name="name" required className="w-full" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Saving..." : "Add Category"}
      </button>
    </form>
  );
}

export function SettingsForm({ initialSettings }: { initialSettings: Record<string, string> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(initialSettings);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [FINANCE_SETTING_KEYS.mileageRate]: form.get("mileageRate"),
        [FINANCE_SETTING_KEYS.defaultCurrency]: form.get("defaultCurrency"),
        [FINANCE_SETTING_KEYS.fiscalYearStart]: form.get("fiscalYearStart"),
        [FINANCE_SETTING_KEYS.receiptRequiredAbove]: form.get("receiptRequiredAbove"),
        [FINANCE_SETTING_KEYS.companyName]: form.get("companyName"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save settings");
      setLoading(false);
      return;
    }
    setSettings(data);
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-foreground">Finance Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Company Name</label>
          <input
            name="companyName"
            defaultValue={settings[FINANCE_SETTING_KEYS.companyName]}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Default Currency</label>
          <input
            name="defaultCurrency"
            defaultValue={settings[FINANCE_SETTING_KEYS.defaultCurrency]}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Mileage Rate ($/mile)</label>
          <input
            name="mileageRate"
            type="number"
            step="0.01"
            defaultValue={settings[FINANCE_SETTING_KEYS.mileageRate]}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Receipt Required Above ($)</label>
          <input
            name="receiptRequiredAbove"
            type="number"
            step="0.01"
            defaultValue={settings[FINANCE_SETTING_KEYS.receiptRequiredAbove]}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Fiscal Year Start (MM-DD)</label>
          <input
            name="fiscalYearStart"
            defaultValue={settings[FINANCE_SETTING_KEYS.fiscalYearStart]}
            placeholder="01-01"
            className="w-full"
          />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}

export function ReconciliationForm({ paymentMethods }: { paymentMethods: SelectOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethodId: form.get("paymentMethodId"),
        statementDate: form.get("statementDate"),
        startingBalance: Number(form.get("startingBalance")),
        endingBalance: Number(form.get("endingBalance")),
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create reconciliation");
      setLoading(false);
      return;
    }
    router.push(`/finance/reconciliation/${data.id}`);
    router.refresh();
  }

  if (paymentMethods.length === 0) {
    return (
      <div className="card text-sm text-muted-foreground">
        Add a payment method in Settings before creating a reconciliation.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-2xl space-y-4">
      <h2 className="font-semibold text-foreground">New Bank Reconciliation</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Payment Method *</label>
          <select name="paymentMethodId" required className="w-full">
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Statement Date *</label>
          <input name="statementDate" type="date" required className="w-full" />
        </div>
        <div>
          <label className="label">Starting Balance *</label>
          <input name="startingBalance" type="number" step="0.01" required className="w-full" />
        </div>
        <div>
          <label className="label">Ending Balance *</label>
          <input name="endingBalance" type="number" step="0.01" required className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating..." : "Start Reconciliation"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LoanForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lender: form.get("lender"),
        originalAmount: Number(form.get("originalAmount")),
        interestRate: form.get("interestRate") ? Number(form.get("interestRate")) : null,
        startDate: form.get("startDate") || null,
        paymentFrequency: form.get("paymentFrequency") || undefined,
        paymentAmount: form.get("paymentAmount") ? Number(form.get("paymentAmount")) : null,
        purpose: form.get("purpose") || undefined,
        notes: form.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create loan");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold text-foreground">Add Loan</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Lender *</label>
          <input name="lender" required className="w-full" />
        </div>
        <div>
          <label className="label">Original Amount *</label>
          <input name="originalAmount" type="number" step="0.01" min="0.01" required className="w-full" />
        </div>
        <div>
          <label className="label">Interest Rate (%)</label>
          <input name="interestRate" type="number" step="0.0001" min="0" className="w-full" />
        </div>
        <div>
          <label className="label">Start Date</label>
          <input name="startDate" type="date" className="w-full" />
        </div>
        <div>
          <label className="label">Payment Frequency</label>
          <input name="paymentFrequency" placeholder="Monthly" className="w-full" />
        </div>
        <div>
          <label className="label">Payment Amount</label>
          <input name="paymentAmount" type="number" step="0.01" min="0" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Purpose</label>
          <input name="purpose" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Add Loan"}
      </button>
    </form>
  );
}

export function ExpenseFilters({
  categories,
  fielders,
  current,
}: {
  categories: SelectOption[];
  fielders: SelectOption[];
  current: { status?: string; categoryId?: string; fielderId?: string; from?: string; to?: string };
}) {
  return (
    <form method="get" className="card grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="sm:col-span-1">
        <label className="label">Status</label>
        <select name="status" defaultValue={current.status ?? ""} className="w-full sm:min-w-[140px]">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
          <option value="reimbursed">Reimbursed</option>
        </select>
      </div>
      <div>
        <label className="label">Category</label>
        <select name="categoryId" defaultValue={current.categoryId ?? ""} className="w-full sm:min-w-[140px]">
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Fielder</label>
        <select name="fielderId" defaultValue={current.fielderId ?? ""} className="w-full sm:min-w-[140px]">
          <option value="">All</option>
          {fielders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">From</label>
        <input name="from" type="date" defaultValue={current.from ?? ""} className="w-full" />
      </div>
      <div>
        <label className="label">To</label>
        <input name="to" type="date" defaultValue={current.to ?? ""} className="w-full" />
      </div>
      <button type="submit" className="btn-secondary sm:col-span-2 lg:col-span-1">Filter</button>
    </form>
  );
}

export function SettingsTabs({
  initialSettings,
  categories,
  paymentMethods,
  vendors,
}: {
  initialSettings: Record<string, string>;
  categories: { id: string; name: string; isActive: boolean; subcategories: { id: string; name: string }[] }[];
  paymentMethods: { id: string; name: string; type: string; currentBalance: number; isActive: boolean }[];
  vendors: { id: string; name: string; vendorType: string; isActive: boolean }[];
}) {
  const [tab, setTab] = useState<"settings" | "categories" | "payment-methods" | "vendors">("settings");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["settings", "Settings"],
            ["categories", "Categories"],
            ["payment-methods", "Payment Methods"],
            ["vendors", "Vendors"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={tab === key ? "btn-primary text-sm" : "btn-secondary text-sm"}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsForm initialSettings={initialSettings} />}

      {tab === "categories" && (
        <div className="space-y-6">
          <CategoryForm />
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Subcategories</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.subcategories.map((s) => s.name).join(", ") || "—"}</td>
                    <td>{c.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "payment-methods" && (
        <div className="space-y-6">
          <PaymentMethodForm />
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((pm) => (
                  <tr key={pm.id}>
                    <td>{pm.name}</td>
                    <td>{pm.type.replace(/_/g, " ")}</td>
                    <td>${pm.currentBalance.toFixed(2)}</td>
                    <td>{pm.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "vendors" && (
        <div className="space-y-6">
          <VendorForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.vendorType}</td>
                    <td>{v.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportExportButtons() {
  const reportTypes = [
    { type: "pnl", label: "Profit & Loss" },
    { type: "cashflow", label: "Cash Flow" },
    { type: "income-by-client", label: "Income by Client" },
    { type: "expenses-by-category", label: "Expenses by Category" },
    { type: "expenses-by-vendor", label: "Expenses by Vendor" },
    { type: "expenses-by-project", label: "Expenses by Project" },
    { type: "mileage", label: "Mileage" },
    { type: "owner-draws", label: "Owner Draws" },
    { type: "loans", label: "Loans" },
    { type: "outstanding-invoices", label: "Outstanding Invoices" },
    { type: "receipt-audit", label: "Receipt Audit" },
    { type: "tax-deductible", label: "Tax Deductible" },
    { type: "missing-receipts", label: "Missing Receipts" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {reportTypes.map((r) => (
        <a
          key={r.type}
          href={`/api/v1/finance/reports/export?type=${r.type}`}
          className="card flex items-center justify-between transition hover:border-accent/30"
        >
          <span className="text-sm font-medium text-foreground">{r.label}</span>
          <span className="text-xs text-accent">Export CSV →</span>
        </a>
      ))}
    </div>
  );
}
