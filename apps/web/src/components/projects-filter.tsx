"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { US_STATES } from "@uln/shared";

const STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "complete",
  "invoiced",
  "paid",
  "cancelled",
];

export function ProjectsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/v1/projects/titles")
      .then((r) => r.json())
      .then((data) => {
        setTitles(Array.isArray(data.titles) ? data.titles : []);
      })
      .catch(() => setTitles([]));
  }, []);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/projects?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (search === current) return;
      setParam("q", search);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam reads latest searchParams
  }, [search, searchParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search projects…"
        className="w-full sm:min-w-[160px] sm:flex-1"
        aria-label="Search projects"
      />
      <select
        value={searchParams.get("title") ?? ""}
        onChange={(e) => setParam("title", e.target.value)}
        className="w-full sm:w-auto sm:min-w-[140px]"
        aria-label="Filter by project title"
      >
        <option value="">All titles</option>
        {titles.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("state") ?? ""}
        onChange={(e) => setParam("state", e.target.value)}
        className="w-full sm:w-auto sm:min-w-[130px]"
      >
        <option value="">All States</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code}>{s.name}</option>
        ))}
      </select>
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="w-full capitalize sm:w-auto sm:min-w-[130px]"
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <select
        value={searchParams.get("qfield") ?? ""}
        onChange={(e) => setParam("qfield", e.target.value)}
        className="w-full sm:w-auto sm:min-w-[120px]"
      >
        <option value="">All QField</option>
        <option value="1">QField 1</option>
        <option value="2">QField 2</option>
      </select>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <input
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          aria-label="From date"
          title="From date (due date, or created if no due)"
        />
        <input
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          aria-label="To date"
          title="To date (due date, or created if no due)"
        />
      </div>
    </div>
  );
}
