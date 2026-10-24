"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export function MatchTabs({ tabs, initial }: { tabs: Tab[]; initial?: string }) {
  const [active, setActive] = useState(tabs.find((t) => t.id === initial)?.id ?? tabs[0].id);
  return (
    <div>
      <div role="tablist" aria-label="פרטי המשחק" className="scroll-x sticky top-14 z-20 -mx-4 mb-4 border-b border-line/40 bg-bg/95 px-4 py-2 backdrop-blur">
        {tabs.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={active === t.id} aria-controls={`panel-${t.id}`} className="chip" onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {active === t.id && t.content}
        </div>
      ))}
    </div>
  );
}
