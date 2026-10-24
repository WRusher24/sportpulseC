export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="טוען">
      {[0, 1, 2].map((i) => <div key={i} className="card h-32 animate-pulse bg-surface2/50" />)}
    </div>
  );
}
