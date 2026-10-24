# SportPulse Israel – User Guide

SportPulse Israel (ספורט פאלס) is a Hebrew, right-to-left, mobile-first sports app: news from the main Israeli portals, a live match center and "האנליסט", an AI analyst.

## Navigation

The bottom bar has five tabs: **חדשות** (feed), **משחקים וטבלאות** (match center), **האנליסט**, **הקבוצה שלי**, **הגדרות**. The top bar links to your account.

## News feed

* Stories from Sport5, ONE, Sport1, Ynet Sport and Walla Sport arrive every five minutes.
* When several outlets report the same event they are grouped in one **master story thread** card. Use the outlet tabs to compare reports.
* Sensational headlines are rewritten into neutral Hebrew titles; the original headline is shown inside the story.
* Open a story for clean, ad-free reading. A "מקור: …" badge at the end links to the original article.
* The **vibe bar** shows the share of optimistic vs worried fans (AI estimate blended with fan votes; sign in to vote).
* Filter by category, search in Hebrew or English, or tap "הקבוצה שלי" to see only your club.

## Themes

**הגדרות → ערכת נושא** offers four themes: Dark (default), Light, Stadium Pitch and Match Night high contrast. The choice is remembered and, when signed in, saved to your account.

## Match center

* **משחקים**: pick a day and league. Tap a match for the full view.
* **טבלאות**: standings with played, wins, draws, losses, goal difference and points (basketball shows wins/losses and point difference).
* Match view tabs: events timeline (goals, cards, substitutions, VAR), statistics (possession, shots, shots on target, corners, offsides, fouls, pass accuracy, xG), lineups, H2H and form guide, fan ratings, analyst insight.
* The live ticker updates every 20 seconds and the match page refreshes while the game is live.
* Scores and tables come from a sports data provider. Until one is connected (by the site admin, or by you in Settings) tables show an opening state with 0 games and no fixtures.

## Rating players after the game

1. Sign in (**התחברות** → register with email, display name and password).
2. After the final whistle open the match → **ציון האוהדים**.
3. Tap a player, choose 1–10, optionally add a short note in Hebrew or English, then **שמירת דירוגים**.
4. Fan averages (with vote counts) appear next to the media grade for each player, plus team averages.

You can change your ratings later; each player keeps one rating per user per match.

## האנליסט (AI analyst)

* Ask in Hebrew or English, e.g. "למה מכבי חיפה איבדה את השליטה במחצית השנייה?" or "מה תרחישי העלייה של מכבי תל אביב?".
* Answers use the stored standings, form, xG and match events, plus a Monte-Carlo season projection for scenario questions. Projections are estimates, not certainties.
* Below the chat, **תובנות לפני ואחרי משחק** generates a preview, live update or review for any match.
* With an AI key the analyst answers freely; without one it returns a data-only answer built from the same facts. The badge above the chat shows the mode.

## My Club (הקבוצה שלי)

Pick your club (search by Hebrew or English name). The hub shows **מה חדש הבוקר** (a 60-second digest generated every day at 07:00 Israel time; refresh it with your own key at any time), upcoming fixtures, recent results, your table position and club news. Your club also filters the feed and drives match notifications.

## API keys (Settings → מפתחות API)

1. Open **הגדרות → מפתחות API**.
2. Choose the AI provider (OpenAI or Anthropic), optionally a model, and paste the key. Paste a Sports Data key (API-Football, optional API-Basketball key, or a Sportmonks token) and pick the data provider.
3. **שמירה מוצפנת במכשיר** stores the keys encrypted in your browser. **בדיקת מפתח** verifies a key before saving.
4. Signed-in users may **sync keys to the account** (encrypted on the server) to use them on other devices, and remove them at any time.
5. Priority: your browser key → your account key → the site's system key. The status cards show which source is active.
6. **מחיקת כל המפתחות** wipes them from the device.

Keys are never shown in exports and are used only for your own requests.

## Notifications and data export

* **התראות**: toggle goals, kick-off, final whistle, breaking news and the morning digest, then allow browser notifications. Alerts for your club are sent while the app is open.
* **ייצוא נתונים**: download your local settings, or (signed in) your profile and ratings as JSON.

## Language, direction and numbers

The interface is fully Hebrew and right-to-left. All numbers (scores, minutes, dates, standings, ratings, percentages) use Western digits 0-9. Search boxes, chat and notes accept Hebrew and English together.
