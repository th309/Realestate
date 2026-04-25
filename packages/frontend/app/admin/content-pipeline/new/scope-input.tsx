"use client";
import { useEffect, useMemo, useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { ScopeSpec, ScopeType } from "../lib/scope-api";

const STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
];

export function ScopeInput({
  type,
  spec,
  onChange,
}: {
  type: ScopeType;
  spec: ScopeSpec;
  onChange: (next: ScopeSpec) => void;
}) {
  if (type === "metros_in_state" || type === "zips_in_state") {
    return (
      <StatePicker
        value={spec.state ?? ""}
        onChange={(state) => onChange({ ...spec, type, state })}
      />
    );
  }
  if (type === "zips_in_metro") {
    return (
      <MetroPicker
        value={spec.cbsaCode ?? ""}
        onChange={(cbsaCode) => onChange({ ...spec, type, cbsaCode })}
      />
    );
  }
  return (
    <CustomList
      codes={spec.codes ?? []}
      onChange={(codes) => onChange({ ...spec, type, codes })}
    />
  );
}

function StatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (state: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-full border border-outline-variant px-6 py-3 text-base bg-surface"
    >
      <option value="">Pick a state…</option>
      {STATE_CODES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function MetroPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cbsa: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [matches, setMatches] = useState<
    { id: string; canonical_name: string; geography: string }[]
  >([]);
  const [picked, setPicked] = useState(false);

  async function handleChange(v: string) {
    setQuery(v);
    setPicked(false);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    setMatches(
      (m as { id: string; canonical_name: string; geography: string }[])
        .filter((x) => x.geography === "metro")
        .slice(0, 8),
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Austin, Cleveland, 12420..."
        className="w-full rounded-full border border-outline-variant px-6 py-3 text-base"
      />
      {!picked && matches.length > 0 && (
        <div className="mt-2 space-y-1 max-h-64 overflow-auto">
          {matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id);
                setQuery(m.canonical_name);
                setPicked(true);
              }}
              className="block w-full text-left p-2 rounded hover:bg-surface-container-low text-sm"
            >
              {m.canonical_name}{" "}
              <span className="text-xs text-outline font-mono">{m.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomList({
  codes,
  onChange,
}: {
  codes: string[];
  onChange: (codes: string[]) => void;
}) {
  const [text, setText] = useState(codes.join(", "));

  useEffect(() => {
    setText(codes.join(", "));
  }, [codes]);

  const parsed = useMemo(() => {
    const tokens = text
      .split(/[,\s\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [text]);

  const stats = useMemo(() => {
    const valid = parsed.filter((c) => /^\d{5}$/.test(c));
    const invalid = parsed.filter((c) => !/^\d{5}$/.test(c));
    return { valid, invalid };
  }, [parsed]);

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const tokens = e.target.value
            .split(/[,\s\n]+/)
            .map((t) => t.trim())
            .filter(Boolean);
          onChange(Array.from(new Set(tokens)));
        }}
        rows={4}
        placeholder="Paste comma- or newline-separated zip codes or CBSA codes. Mix is OK."
        className="w-full rounded-xl border border-outline-variant px-4 py-3 text-sm font-mono bg-surface"
      />
      <div className="mt-2 text-xs text-on-surface-variant">
        {stats.valid.length} valid
        {stats.invalid.length > 0 && (
          <>
            {" · "}
            <span className="text-error">
              {stats.invalid.length} unrecognized
            </span>
          </>
        )}
      </div>
      {stats.invalid.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.invalid.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-mono"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
