"use client";

import { useEffect, useMemo, useState } from "react";

const CUSTOM = "__custom__";

export function ProjectTitleField({
  name = "title",
  defaultValue = "",
  required = true,
  label = "Project Title *",
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  label?: string;
}) {
  const [titles, setTitles] = useState<string[]>([]);
  const [mode, setMode] = useState<"list" | "custom">("list");
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/projects/titles")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: string[] = Array.isArray(data.titles) ? data.titles : [];
        setTitles(list);

        const initial = defaultValue.trim();
        if (!initial) {
          setMode("list");
          setSelected("");
          return;
        }
        const match = list.find((t) => t.toLowerCase() === initial.toLowerCase());
        if (match) {
          setMode("list");
          setSelected(match);
        } else {
          setMode("custom");
          setSelected(CUSTOM);
          setCustom(initial);
        }
      })
      .catch(() => {
        /* keep free-text fallback */
        if (!cancelled && defaultValue.trim()) {
          setMode("custom");
          setSelected(CUSTOM);
          setCustom(defaultValue.trim());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [defaultValue]);

  const value = mode === "custom" ? custom : selected;

  const options = useMemo(() => {
    if (defaultValue.trim() && !titles.some((t) => t.toLowerCase() === defaultValue.trim().toLowerCase())) {
      return [defaultValue.trim(), ...titles];
    }
    return titles;
  }, [titles, defaultValue]);

  return (
    <div className="space-y-2">
      <label className="label">{label}</label>
      <select
        className="w-full"
        value={mode === "custom" ? CUSTOM : selected}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM) {
            setMode("custom");
            setSelected(CUSTOM);
            return;
          }
          setMode("list");
          setSelected(next);
          setCustom("");
        }}
        required={required && mode === "list"}
      >
        <option value="">Select title</option>
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={CUSTOM}>Other / custom…</option>
      </select>
      {mode === "custom" ? (
        <input
          name={name}
          required={required}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="e.g. Lumen, AT&T, Frontier…"
          className="w-full"
        />
      ) : (
        <input type="hidden" name={name} value={value} />
      )}
      <p className="text-xs text-muted-foreground">
        Pick an existing title to keep naming consistent, or choose Other to add a new one.
      </p>
    </div>
  );
}
