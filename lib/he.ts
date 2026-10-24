import type { ArticleCategory, EventType, MatchStatus, SportType, ThemeId } from "./types";

export const APP_NAME_HE = "ספורט פאלס";
export const APP_NAME_EN = "SportPulse Israel";

export const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "טרם החל",
  first_half: "מחצית ראשונה",
  half_time: "מחצית",
  second_half: "מחצית שנייה",
  extra_time: "הארכה",
  finished: "סיום",
  postponed: "נדחה"
};

export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  football_israel: "כדורגל ישראלי",
  football_world: "כדורגל עולמי",
  basketball_israel: "כדורסל ישראלי",
  basketball_world: "כדורסל עולמי",
  transfers: "העברות",
  other: "כללי"
};

export const SPORT_LABEL: Record<SportType, string> = { football: "כדורגל", basketball: "כדורסל" };

export const EVENT_LABEL: Record<EventType, string> = {
  goal: "שער",
  card: "כרטיס",
  substitution: "חילוף",
  var: "בדיקת VAR"
};

export const THEME_LABEL: Record<ThemeId, { name: string; hint: string }> = {
  dark: { name: "כהה", hint: "רקע סלייט עמוק עם הדגשות ירוק ניאון" },
  light: { name: "בהיר", hint: "רקע לבן נקי עם הדגשות כחולות" },
  pitch: { name: "מגרש לילה", hint: "ירוק מגרש עמוק עם ציאן וצהוב זוהרים" },
  night: { name: "ערב משחק – ניגודיות גבוהה", hint: "שחור מלא עם הדגשות כתומות" }
};

export const STATS_LABEL: Record<string, string> = {
  possession: "החזקת כדור %",
  shots: "בעיטות לשער",
  shotsOnTarget: "בעיטות למסגרת",
  corners: "קרנות",
  offsides: "נבדלים",
  fouls: "עבירות",
  passAccuracy: "דיוק מסירות %",
  xg: "xG (שערים צפויים)"
};

export const SOURCE_NAME_HE: Record<string, string> = {
  sport5: "ספורט 5",
  one: "ONE",
  sport1: "ספורט 1",
  ynet: "ידיעות ספורט",
  walla: "וואלה! ספורט"
};
