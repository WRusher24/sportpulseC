"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mt-10 text-center" role="alert">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="mt-1 text-sm text-muted">אירעה שגיאה בטעינת העמוד. נסו שוב.</p>
      <button className="btn-primary mt-4" onClick={reset}>נסו שוב</button>
    </div>
  );
}
