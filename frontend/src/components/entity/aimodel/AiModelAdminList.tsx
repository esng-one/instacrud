//components/entity/aimodel/AiModelAdminList.tsx

"use client";
import React, { useMemo, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import type { AiModel_Input as AiModel } from "@/api/models/AiModel_Input";

interface AiModelAdminListProps {
  rows: AiModel[];
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// Fixed provider order + display names
const PROVIDERS: { key: string; label: string }[] = [
  { key: "OPEN_AI", label: "OpenAI" },
  { key: "CLAUDE", label: "Anthropic" },
  { key: "DEEP_INFRA", label: "DeepInfra" },
  { key: "OLLAMA", label: "Ollama" },
];

// Icon treatment borrowed from the AI-assistant model dropdown
const GRAYSCALE_SERVICES = ["OPEN_AI", "DEEP_INFRA"];
const INVERT_SERVICES = ["OPEN_AI", "CLAUDE", "OLLAMA", "DEEP_INFRA"];

// Credit "coin" — cheap / moderate / expensive (same thresholds as the dropdown)
const creditCoin = (credits: number): string =>
  credits <= 30 ? "🟢" : credits <= 200 ? "🟡" : "🟠";

type CapKey = "all" | "chat" | "embedding" | "image";
const CAPS: { key: CapKey; label: string; test?: (m: AiModel) => boolean }[] = [
  { key: "all", label: "All" },
  { key: "chat", label: "Chat", test: (m) => !!m.completion },
  { key: "embedding", label: "Embeddings", test: (m) => !!m.embedding },
  { key: "image", label: "Image", test: (m) => !!m.image_generation },
];

type SortKey = "rank" | "name" | "credits" | "tier";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Name" },
  { key: "credits", label: "Credits" },
  { key: "tier", label: "Tier" },
];

type BadgeColor = "primary" | "success" | "error" | "warning" | "info" | "light" | "dark";

function tierBadge(tier: number | null | undefined): { label: string; color: BadgeColor } | null {
  switch (tier) {
    case 1: return { label: "Free", color: "success" };
    case 5: return { label: "Pro", color: "info" };
    case 10: return { label: "Premium", color: "primary" };
    case 15: return { label: "Platinum", color: "dark" };
    default: return tier != null ? { label: `Tier ${tier}`, color: "light" } : null;
  }
}

function capabilityBadges(m: AiModel): { label: string; color: BadgeColor }[] {
  const out: { label: string; color: BadgeColor }[] = [];
  if (m.completion) {
    out.push({ label: "Chat", color: "info" });
    if (m.image_completion) out.push({ label: "Vision", color: "light" });
    if (m.reasoning) out.push({ label: "Reason", color: "warning" });
  }
  if (m.embedding) out.push({ label: "Embed", color: "success" });
  if (m.image_generation) {
    out.push({ label: "Image", color: "primary" });
    if (m.image_completion && !m.completion) out.push({ label: "Edit", color: "light" });
  }
  return out;
}

function ModelIcon({ m }: { m: AiModel }) {
  if (!m.icon) return <span className="h-4 w-4 shrink-0" aria-hidden="true" />;
  const cls = `h-4 w-4 shrink-0 object-contain${INVERT_SERVICES.includes(m.service) ? " dark:invert" : ""}${GRAYSCALE_SERVICES.includes(m.service) ? " grayscale" : ""}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.icon} alt="" className={cls} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
}

export default function AiModelAdminList({ rows, onRowClick, onDelete }: AiModelAdminListProps) {
  const [cap, setCap] = useState<CapKey>("all");
  const [provider, setProvider] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  // provider + search + enabled filters (NOT capability — so cap tab counts stay live)
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((m) => {
      if (provider !== "all" && m.service !== provider) return false;
      if (enabledOnly && !m.enabled) return false;
      if (q && !`${m.name} ${m.model_identifier}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, provider, query, enabledOnly]);

  const capCounts = useMemo(() => {
    const counts: Record<CapKey, number> = { all: base.length, chat: 0, embedding: 0, image: 0 };
    for (const m of base) {
      if (m.completion) counts.chat++;
      if (m.embedding) counts.embedding++;
      if (m.image_generation) counts.image++;
    }
    return counts;
  }, [base]);

  const filtered = useMemo(() => {
    const test = CAPS.find((c) => c.key === cap)?.test;
    return test ? base.filter(test) : base;
  }, [base, cap]);

  const sortFn = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return (a: AiModel, b: AiModel) => {
      let d = 0;
      switch (sortKey) {
        case "name": d = a.name.localeCompare(b.name); break;
        case "credits": d = (a.credits ?? 0) - (b.credits ?? 0); break;
        case "tier": d = (a.tier ?? 0) - (b.tier ?? 0); break;
        default: d = (a.rank ?? 1e9) - (b.rank ?? 1e9); break;
      }
      return (d || a.name.localeCompare(b.name)) * dir;
    };
  }, [sortKey, sortAsc]);

  // Group by provider, sorted within each group. Any service not in PROVIDERS
  // falls into an "Other" bucket so grouped rows always match the "All" count.
  const groups = useMemo(() => {
    const known = PROVIDERS.map((p) => ({
      ...p,
      models: filtered.filter((m) => m.service === p.key).sort(sortFn),
    }));
    const knownKeys = new Set(PROVIDERS.map((p) => p.key));
    const other = filtered.filter((m) => !knownKeys.has(m.service as string)).sort(sortFn);
    if (other.length) known.push({ key: "__other", label: "Other", models: other });
    return known.filter((g) => g.models.length > 0);
  }, [filtered, sortFn]);

  const tabBase = "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap";
  const tabOn = "bg-brand-500 text-white";
  const tabOff = "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10";
  const chipBase = "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap";
  const chipOn = "bg-brand-500 text-white";
  const chipOff = "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-white/[0.05] dark:bg-white/[0.03]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Capability tabs (with live counts) + search */}
        <div className="flex flex-wrap items-center gap-2">
          {CAPS.map((c) => (
            <button key={c.key} type="button" onClick={() => setCap(c.key)} className={`${tabBase} ${cap === c.key ? tabOn : tabOff}`}>
              {c.label}
              <span className="ml-1.5 opacity-70">{capCounts[c.key]}</span>
            </button>
          ))}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or id…"
            className="ml-auto w-48 rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:text-gray-200"
          />
        </div>

        {/* Provider chips + sort + enabled toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setProvider("all")} className={`${chipBase} ${provider === "all" ? chipOn : chipOff}`}>
            All providers
          </button>
          {PROVIDERS.map((p) => (
            <button key={p.key} type="button" onClick={() => setProvider(p.key)} className={`${chipBase} ${provider === p.key ? chipOn : chipOff}`}>
              {p.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={enabledOnly}
                onChange={(e) => setEnabledOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-brand-500 focus:ring-brand-500"
              />
              Enabled only
            </label>
            <span className="text-xs text-gray-400">Sort</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-xs text-gray-700 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:text-gray-200 dark:[&>option]:bg-gray-800"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              title={sortAsc ? "Ascending" : "Descending"}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {sortAsc ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      {/* Grouped list */}
      <div className="mt-4 space-y-5">
        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No models match these filters.</p>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{g.label}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                {g.models.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-white/[0.05] dark:border-white/[0.05]">
              {g.models.map((m) => {
                const tier = tierBadge(m.tier);
                const caps = capabilityBadges(m);
                return (
                  <div
                    key={m._id as string}
                    className={`group flex items-center transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.04] ${m.enabled ? "" : "opacity-55"}`}
                  >
                    {/* activatable region (delete button is a sibling, not nested) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => m._id && onRowClick?.(m._id)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && m._id) {
                          e.preventDefault();
                          onRowClick?.(m._id);
                        }
                      }}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5"
                    >
                      {/* enabled dot */}
                      <span
                        title={m.enabled ? "Enabled" : "Disabled"}
                        className={`h-2 w-2 shrink-0 rounded-full ${m.enabled ? "bg-success-500" : "bg-gray-300 dark:bg-gray-600"}`}
                      />
                      <ModelIcon m={m} />

                      {/* name + identifier */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{m.name}</span>
                          {caps.map((c) => (
                            <Badge key={c.label} size="sm" variant="light" color={c.color}>{c.label}</Badge>
                          ))}
                        </div>
                        <div className="truncate font-mono text-xs text-gray-400 dark:text-gray-500">{m.model_identifier}</div>
                      </div>

                      {/* credits coin + tier */}
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        {m.credits != null && (
                          <span className="hidden items-center gap-1 text-xs text-gray-500 sm:inline-flex dark:text-gray-400">
                            <span className="text-[0.7rem]">{creditCoin(m.credits)}</span>
                            {m.credits}
                          </span>
                        )}
                        {tier && (
                          <Badge size="sm" variant="light" color={tier.color}>{tier.label}</Badge>
                        )}
                      </div>
                    </div>

                    {/* delete — sibling of the activatable region; reachable + visible on focus */}
                    {onDelete && (
                      <button
                        type="button"
                        title="Delete model"
                        aria-label={`Delete ${m.name}`}
                        onClick={() => {
                          if (m._id && window.confirm(`Delete "${m.name}"?`)) onDelete(m._id);
                        }}
                        className="mr-2 shrink-0 rounded-md p-1 text-gray-300 opacity-0 transition-opacity hover:text-error-500 focus-visible:opacity-100 group-hover:opacity-100 dark:text-gray-600"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
