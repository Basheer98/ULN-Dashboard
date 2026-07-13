"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectSearchResult } from "@/lib/project-search";

export function ProjectSearchBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/projects/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        if (res.ok) {
          setResults(data.results ?? []);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openProject(project: ProjectSearchResult) {
    setOpen(false);
    setQuery("");
    router.push(`/projects/${project.id}`);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search projects by number, title, client, or address..."
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
          aria-label="Search projects"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        {loading ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            ...
          </span>
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
          {results.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProject(project)}
              className="block w-full border-b border-border px-4 py-3 text-left transition hover:bg-surface-hover last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-accent">{project.projectNumber}</p>
                <span className="text-xs capitalize text-muted-foreground">
                  {project.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground">{project.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {project.clientName}
                {project.city ? ` · ${project.city}` : ""}
                {project.state ? ` ${project.state}` : ""}
              </p>
              {project.fielders.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.fielders.join(", ")}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {open && !loading && query.trim().length >= 2 && results.length === 0 ? (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground shadow-xl">
          No projects found.
        </div>
      ) : null}
    </div>
  );
}
