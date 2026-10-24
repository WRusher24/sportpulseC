import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mt-10 text-center">
      <p className="num text-5xl font-extrabold text-accent">404</p>
      <h1 className="mt-2 text-xl font-bold">העמוד לא נמצא</h1>
      <p className="mt-1 text-sm text-muted">ייתכן שהמשחק או הידיעה הוסרו.</p>
      <Link href="/" className="btn-primary mt-4">חזרה לחדשות</Link>
    </div>
  );
}
