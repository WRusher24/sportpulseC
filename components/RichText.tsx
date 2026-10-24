import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

/** Minimal, injection-safe renderer for analyst output: **bold**, "• " bullets and _italic notes_. Everything is a React text node. */
export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-1 list-disc space-y-1 ps-5">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>
      );
      bullets = [];
    }
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^[•\-*]\s+/.test(t)) bullets.push(t.replace(/^[•\-*]\s+/, ""));
    else {
      flush();
      if (!t) return;
      if (/^_.+_$/.test(t)) out.push(<p key={i} className="mt-2 text-xs text-muted">{t.slice(1, -1)}</p>);
      else out.push(<p key={i} className="mt-1">{inline(t)}</p>);
    }
  });
  flush();
  return <div className="space-y-1 text-[0.95rem] leading-7">{out}</div>;
}
