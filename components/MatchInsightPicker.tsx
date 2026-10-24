"use client";

import { useState } from "react";
import { InsightPanel } from "./InsightPanel";

export type MatchOption = { id: string; label: string; group: string };

export function MatchInsightPicker({ options }: { options: MatchOption[] }) {
  const [id, setId] = useState(options[0]?.id ?? "");
  if (options.length === 0) return null;
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <section className="mt-8" aria-labelledby="pre-post">
      <h2 id="pre-post" className="mb-2 text-lg font-extrabold">תובנות לפני ואחרי משחק</h2>
      <label htmlFor="insight-match" className="sr-only">בחירת משחק</label>
      <select id="insight-match" className="input mb-3" value={id} onChange={(e) => setId(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options.filter((o) => o.group === g).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
      <InsightPanel key={id} matchId={id} />
    </section>
  );
}
