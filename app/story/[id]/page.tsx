import Link from "next/link";
import { notFound } from "next/navigation";
import { StoryReader } from "@/components/StoryReader";
import { VibeBar } from "@/components/VibeBar";
import { VibeVote } from "@/components/VibeVote";
import { blendVibe } from "@/lib/ai/vibe";
import { getRepo } from "@/lib/data";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const thread = await getRepo().getThread((await params).id);
  return { title: thread?.titleHe ?? "ידיעה" };
}

export default async function StoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string }> }) {
  const [{ id }, { a }] = await Promise.all([params, searchParams]);
  const repo = getRepo();
  const thread = await repo.getThread(id);
  if (!thread || thread.articles.length === 0) notFound();
  const [votes, user] = await Promise.all([repo.voteCounts(id), getSessionUser()]);
  const vibe = blendVibe(thread.vibeOptimistic, votes);

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">→ חזרה לחדשות</Link>
      <StoryReader articles={thread.articles} initialId={a} />
      <section className="card mt-8" aria-labelledby="vibe-h">
        <h2 id="vibe-h" className="mb-3 font-bold">מד האווירה של האוהדים</h2>
        {vibe ? <VibeBar optimistic={vibe.optimistic} worried={vibe.worried} votes={vibe.votes} /> : <p className="text-sm text-muted">עדיין אין מספיק נתונים לניתוח אווירה.</p>}
        <div className="mt-3">
          <VibeVote threadId={thread.id} signedIn={Boolean(user)} />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted">המד משלב הערכת AI של טון הדיווחים בכל המקורות (שווה ערך ל-10 הצבעות) עם הצבעות אוהדים אמיתיות באפליקציה.</p>
      </section>
    </>
  );
}
