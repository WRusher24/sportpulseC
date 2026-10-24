import type { LeagueDTO, SportType } from "@/lib/types";

/**
 * Real competition & club structure.
 *
 * - League / club identities, Hebrew names, home grounds and API provider ids are real.
 * - Club lists reflect the most recently verified top-flight rosters (Israeli leagues, Premier League, La Liga, NBA);
 *   promotion / relegation for a new season is reconciled by the provider sync (see lib/sports/sync.ts).
 * - `strength` (0-100) is only used to generate the clearly flagged baseline results (is_demo = true).
 */
export type TeamSeed = {
  id: string;
  nameHe: string;
  nameEn: string;
  leagueId: string;
  sportType: SportType;
  venue: string | null;
  city: string | null;
  aliases: string[];
  color: string | null;
  strength: number;
};

export const SEASON = "2026/27";

export const LEAGUE_SEEDS: LeagueDTO[] = [
  { id: "il-premier", nameHe: "ליגת העל", nameEn: "Israeli Premier League", country: "ישראל", logoUrl: null, sportType: "football", season: SEASON, sortOrder: 1, apiFootballId: 383, apiBasketballId: null, sportmonksId: null },
  { id: "il-leumit", nameHe: "ליגה לאומית", nameEn: "Liga Leumit", country: "ישראל", logoUrl: null, sportType: "football", season: SEASON, sortOrder: 2, apiFootballId: 382, apiBasketballId: null, sportmonksId: null },
  { id: "il-winner", nameHe: "ליגת ווינר בכדורסל", nameEn: "Winner League Basketball", country: "ישראל", logoUrl: null, sportType: "basketball", season: SEASON, sortOrder: 3, apiFootballId: null, apiBasketballId: null, sportmonksId: null },
  { id: "ucl", nameHe: "ליגת האלופות", nameEn: "UEFA Champions League", country: "אירופה", logoUrl: null, sportType: "football", season: SEASON, sortOrder: 4, apiFootballId: 2, apiBasketballId: null, sportmonksId: 2 },
  { id: "epl", nameHe: "פרמייר ליג", nameEn: "English Premier League", country: "אנגליה", logoUrl: null, sportType: "football", season: SEASON, sortOrder: 5, apiFootballId: 39, apiBasketballId: null, sportmonksId: 8 },
  { id: "laliga", nameHe: "לה ליגה", nameEn: "Spanish La Liga", country: "ספרד", logoUrl: null, sportType: "football", season: SEASON, sortOrder: 6, apiFootballId: 140, apiBasketballId: null, sportmonksId: 564 },
  { id: "euroleague", nameHe: "יורוליג", nameEn: "EuroLeague Basketball", country: "אירופה", logoUrl: null, sportType: "basketball", season: SEASON, sortOrder: 7, apiFootballId: null, apiBasketballId: 120, sportmonksId: null },
  { id: "nba", nameHe: "NBA", nameEn: "NBA", country: "ארה״ב", logoUrl: null, sportType: "basketball", season: SEASON, sortOrder: 8, apiFootballId: null, apiBasketballId: 12, sportmonksId: null }
];

type T = [id: string, he: string, en: string, venue: string | null, city: string | null, strength: number, color: string | null, aliases?: string[]];

const mk = (leagueId: string, sportType: SportType, rows: T[]): TeamSeed[] =>
  rows.map(([id, nameHe, nameEn, venue, city, strength, color, aliases]) => ({
    id,
    nameHe,
    nameEn,
    leagueId,
    sportType,
    venue,
    city,
    color,
    strength,
    aliases: aliases ?? []
  }));

const IL_PREMIER = mk("il-premier", "football", [
  ["maccabi-tel-aviv-fc", "מכבי תל אביב", "Maccabi Tel Aviv", "אצטדיון בלומפילד", "תל אביב", 82, "#FFD500", ["מכבי ת\"א", "המכבי", "הצהובים", "Maccabi TA"]],
  ["maccabi-haifa", "מכבי חיפה", "Maccabi Haifa", "אצטדיון סמי עופר", "חיפה", 84, "#00963F", ["מכבי חיפה", "הירוקים", "Maccabi Haifa FC"]],
  ["hapoel-beer-sheva", "הפועל באר שבע", "Hapoel Be'er Sheva", "אצטדיון טרנר", "באר שבע", 85, "#E31E24", ["הפועל ב\"ש", "הפועל באר-שבע", "Hapoel Beer Sheva", "Hapoel Beersheba"]],
  ["beitar-jerusalem", "בית\"ר ירושלים", "Beitar Jerusalem", "אצטדיון טדי", "ירושלים", 78, "#FFD500", ["ביתר ירושלים", "בית״ר ירושלים", "ביתר", "Beitar"]],
  ["hapoel-tel-aviv-fc", "הפועל תל אביב", "Hapoel Tel Aviv", "אצטדיון בלומפילד", "תל אביב", 72, "#D6001C", ["הפועל ת\"א", "האדומים", "Hapoel TA"]],
  ["maccabi-netanya", "מכבי נתניה", "Maccabi Netanya", "אצטדיון נתניה", "נתניה", 66, "#F5C400", ["Maccabi Netanya FC"]],
  ["hapoel-haifa", "הפועל חיפה", "Hapoel Haifa", "אצטדיון סמי עופר", "חיפה", 62, "#C8102E", []],
  ["bnei-sakhnin", "בני סכנין", "Bnei Sakhnin", "אצטדיון דוחא", "סכנין", 60, "#B71C1C", ["Sakhnin"]],
  ["ironi-kiryat-shmona", "עירוני קריית שמונה", "Ironi Kiryat Shmona", "אצטדיון עירוני קריית שמונה", "קריית שמונה", 58, "#1E4FA1", ["עירוני ק\"ש", "קריית שמונה", "Kiryat Shmona"]],
  ["hapoel-jerusalem-fc", "הפועל ירושלים", "Hapoel Jerusalem", "אצטדיון טדי", "ירושלים", 60, "#D50000", ["Hapoel Jerusalem FC"]],
  ["fc-ashdod", "מ.ס. אשדוד", "FC Ashdod", "אצטדיון י\"א", "אשדוד", 58, "#C62828", ["מועדון ספורט אשדוד", "אשדוד", "Ashdod"]],
  ["ironi-tiberias", "עירוני טבריה", "Ironi Tiberias", "אצטדיון עירוני טבריה", "טבריה", 52, "#1565C0", ["טבריה", "Tiberias"]],
  ["maccabi-bnei-reineh", "מכבי בני ריינה", "Maccabi Bnei Reineh", null, "ריינה", 56, "#C62828", ["בני ריינה", "Bnei Reineh", "Bnei Raina"]],
  ["hapoel-petah-tikva", "הפועל פתח תקווה", "Hapoel Petah Tikva", "אצטדיון המושבה", "פתח תקווה", 55, "#1E3A8A", ["הפועל פ\"ת", "Hapoel PT"]]
]);

const IL_LEUMIT = mk("il-leumit", "football", [
  ["hapoel-ramat-gan", "הפועל רמת גן", "Hapoel Ramat Gan", null, "רמת גן", 60, null],
  ["hapoel-kfar-saba", "הפועל כפר סבא", "Hapoel Kfar Saba", null, "כפר סבא", 58, null],
  ["maccabi-petah-tikva", "מכבי פתח תקווה", "Maccabi Petah Tikva", null, "פתח תקווה", 62, null],
  ["hapoel-hadera", "הפועל חדרה", "Hapoel Hadera", null, "חדרה", 61, null],
  ["hapoel-acre", "הפועל עכו", "Hapoel Acre", null, "עכו", 56, null],
  ["hapoel-raanana", "הפועל רעננה", "Hapoel Ra'anana", null, "רעננה", 55, null],
  ["hapoel-nof-hagalil", "הפועל נוף הגליל", "Hapoel Nof HaGalil", null, "נוף הגליל", 54, null],
  ["hapoel-rishon", "הפועל ראשון לציון", "Hapoel Rishon LeZion", null, "ראשון לציון", 53, null],
  ["hapoel-afula", "הפועל עפולה", "Hapoel Afula", null, "עפולה", 52, null],
  ["hapoel-umm-al-fahm", "הפועל אום אל פחם", "Hapoel Umm al-Fahm", null, "אום אל פחם", 51, null],
  ["bnei-yehuda", "בני יהודה תל אביב", "Bnei Yehuda Tel Aviv", null, "תל אביב", 59, null, ["בני יהודה"]],
  ["hapoel-kfar-shalem", "הפועל כפר שלם", "Hapoel Kfar Shalem", null, "תל אביב", 50, null],
  ["sektzia-ness-ziona", "סקציה נס ציונה", "Sektzia Ness Ziona", null, "נס ציונה", 57, null, ["נס ציונה"]],
  ["maccabi-jaffa", "מכבי קביליו יפו", "Maccabi Kabilio Jaffa", null, "יפו", 50, null, ["מכבי יפו"]]
]);

const IL_WINNER = mk("il-winner", "basketball", [
  ["maccabi-tel-aviv-bc", "מכבי תל אביב", "Maccabi Tel Aviv BC", "היכל מנורה מבטחים", "תל אביב", 90, "#FFD500", ["מכבי ת\"א כדורסל", "Maccabi Tel Aviv Basketball", "Maccabi Playtika Tel Aviv"]],
  ["hapoel-jerusalem-bc", "הפועל ירושלים", "Hapoel Jerusalem BC", "היכל הספורט ירושלים (פיס ארנה)", "ירושלים", 84, "#D50000", ["הפועל ירושלים כדורסל", "Hapoel Jerusalem Basketball", "Hapoel Bank Yahav Jerusalem"]],
  ["hapoel-tel-aviv-bc", "הפועל תל אביב", "Hapoel Tel Aviv BC", "היכל מנורה מבטחים", "תל אביב", 86, "#D6001C", ["הפועל ת\"א כדורסל", "Hapoel Tel Aviv Basketball", "Hapoel IBI Tel Aviv"]],
  ["hapoel-holon", "הפועל חולון", "Hapoel Holon", "סיטי סנטר חולון", "חולון", 76, "#E53935", ["Hapoel Holon BC"]],
  ["hapoel-beer-sheva-bc", "הפועל באר שבע", "Hapoel Be'er Sheva BC", "היכל הספורט באר שבע", "באר שבע", 66, "#E31E24", ["הפועל ב\"ש כדורסל", "Hapoel Beer Sheva Basketball"]],
  ["maccabi-rishon-bc", "מכבי ראשון לציון", "Maccabi Rishon LeZion", "היכל רוממה (ספורטן)", "ראשון לציון", 68, "#1565C0", ["מכבי ראשון", "Maccabi Rishon"]],
  ["ironi-ness-ziona-bc", "עירוני נס ציונה", "Ironi Ness Ziona", null, "נס ציונה", 62, "#00796B", ["נס ציונה כדורסל"]],
  ["hapoel-gilboa-galil", "הפועל גלבוע/גליל", "Hapoel Gilboa Galil", null, "גלבוע", 64, "#C62828", ["גלבוע גליל", "Gilboa Galil"]],
  ["hapoel-eilat-bc", "הפועל אילת", "Hapoel Eilat", null, "אילת", 65, "#0277BD", ["Hapoel Eilat BC"]],
  ["bnei-herzliya-bc", "בני הרצליה", "Bnei Herzliya", null, "הרצליה", 58, "#F9A825", ["Bnei Herzliya BC"]]
]);

const EPL = mk("epl", "football", [
  ["arsenal", "ארסנל", "Arsenal", "Emirates Stadium", "לונדון", 90, "#EF0107"],
  ["aston-villa", "אסטון וילה", "Aston Villa", "Villa Park", "ברמינגהאם", 78, "#670E36"],
  ["bournemouth", "בורנמות'", "Bournemouth", "Vitality Stadium", "בורנמות'", 68, "#DA291C", ["בורנמות"]],
  ["brentford", "ברנטפורד", "Brentford", "Gtech Community Stadium", "לונדון", 68, "#E30613"],
  ["brighton", "ברייטון", "Brighton & Hove Albion", "American Express Stadium", "ברייטון", 72, "#0057B8", ["Brighton"]],
  ["burnley", "ברנלי", "Burnley", "Turf Moor", "ברנלי", 58, "#6C1D45"],
  ["chelsea", "צ'לסי", "Chelsea", "Stamford Bridge", "לונדון", 84, "#034694", ["צלסי"]],
  ["crystal-palace", "קריסטל פאלאס", "Crystal Palace", "Selhurst Park", "לונדון", 72, "#1B458F"],
  ["everton", "אברטון", "Everton", "Hill Dickinson Stadium", "ליברפול", 66, "#003399"],
  ["fulham", "פולהאם", "Fulham", "Craven Cottage", "לונדון", 69, "#000000"],
  ["leeds-united", "לידס יונייטד", "Leeds United", "Elland Road", "לידס", 62, "#FFCD00", ["לידס"]],
  ["liverpool", "ליברפול", "Liverpool", "Anfield", "ליברפול", 90, "#C8102E"],
  ["manchester-city", "מנצ'סטר סיטי", "Manchester City", "Etihad Stadium", "מנצ'סטר", 91, "#6CABDD", ["מנצסטר סיטי", "Man City"]],
  ["manchester-united", "מנצ'סטר יונייטד", "Manchester United", "Old Trafford", "מנצ'סטר", 80, "#DA291C", ["מנצסטר יונייטד", "Man United", "Man Utd"]],
  ["newcastle", "ניוקאסל יונייטד", "Newcastle United", "St James' Park", "ניוקאסל", 78, "#241F20", ["ניוקאסל"]],
  ["nottingham-forest", "נוטינגהאם פורסט", "Nottingham Forest", "City Ground", "נוטינגהאם", 70, "#DD0000", ["נוטינגהאם"]],
  ["sunderland", "סנדרלנד", "Sunderland", "Stadium of Light", "סנדרלנד", 60, "#EB172B"],
  ["tottenham", "טוטנהאם הוטספר", "Tottenham Hotspur", "Tottenham Hotspur Stadium", "לונדון", 80, "#132257", ["טוטנהאם", "Spurs"]],
  ["west-ham", "ווסטהאם יונייטד", "West Ham United", "London Stadium", "לונדון", 68, "#7A263A", ["ווסטהאם"]],
  ["wolves", "וולברהמפטון", "Wolverhampton Wanderers", "Molineux Stadium", "וולברהמפטון", 64, "#FDB913", ["וולבס", "Wolves"]]
]);

const LALIGA = mk("laliga", "football", [
  ["alaves", "דפורטיבו אלאבס", "Deportivo Alavés", "Mendizorroza", "ויטוריה", 62, "#005BAC", ["אלאבס", "Alaves"]],
  ["athletic-club", "אתלטיק בילבאו", "Athletic Club", "San Mamés", "בילבאו", 77, "#EE2523", ["Athletic Bilbao"]],
  ["atletico-madrid", "אתלטיקו מדריד", "Atlético Madrid", "Metropolitano", "מדריד", 86, "#CB3524", ["Atletico Madrid"]],
  ["barcelona", "ברצלונה", "FC Barcelona", "Estadi Olímpic Lluís Companys", "ברצלונה", 91, "#A50044", ["Barca", "Barcelona"]],
  ["celta-vigo", "סלטה ויגו", "Celta Vigo", "Balaídos", "ויגו", 66, "#8AC3EE"],
  ["elche", "אלצ'ה", "Elche", "Martínez Valero", "אלצ'ה", 58, "#00843D"],
  ["espanyol", "אספניול", "Espanyol", "RCDE Stadium", "ברצלונה", 60, "#007FC8"],
  ["getafe", "חטאפה", "Getafe", "Coliseum", "חטאפה", 62, "#005999"],
  ["girona", "ז'ירונה", "Girona", "Montilivi", "ז'ירונה", 66, "#CD2534"],
  ["levante", "לבאנטה", "Levante", "Ciutat de València", "ולנסיה", 58, "#B4053F"],
  ["mallorca", "מיורקה", "Mallorca", "Son Moix", "פלמה", 62, "#E20613"],
  ["osasuna", "אוסאסונה", "Osasuna", "El Sadar", "פמפלונה", 64, "#D91A21"],
  ["rayo-vallecano", "ראיו וייקאנו", "Rayo Vallecano", "Vallecas", "מדריד", 64, "#FFFFFF"],
  ["real-betis", "ריאל בטיס", "Real Betis", "Benito Villamarín", "סביליה", 74, "#0BB363", ["בטיס"]],
  ["real-madrid", "ריאל מדריד", "Real Madrid", "Santiago Bernabéu", "מדריד", 92, "#FEBE10"],
  ["real-oviedo", "ריאל אוביידו", "Real Oviedo", "Carlos Tartiere", "אוביידו", 55, "#1B3C8D", ["אוביידו"]],
  ["real-sociedad", "ריאל סוסיאדד", "Real Sociedad", "Reale Arena", "סן סבסטיאן", 74, "#0067B1", ["סוסיאדד"]],
  ["sevilla", "סביליה", "Sevilla", "Ramón Sánchez-Pizjuán", "סביליה", 70, "#D4021D"],
  ["valencia", "ולנסיה", "Valencia", "Mestalla", "ולנסיה", 68, "#EE3524"],
  ["villarreal", "וילאריאל", "Villarreal", "Estadio de la Cerámica", "וילאריאל", 74, "#FBE10F"]
]);

const UCL_GUESTS = mk("ucl", "football", [
  ["bayern-munich", "באיירן מינכן", "Bayern Munich", "Allianz Arena", "מינכן", 91, "#DC052D", ["באיירן"]],
  ["psg", "פריז סן ז'רמן", "Paris Saint-Germain", "Parc des Princes", "פריז", 90, "#004170", ["פ.ס.ז'", "PSG"]],
  ["inter-milan", "אינטר", "Inter Milan", "San Siro", "מילאנו", 86, "#0068A8", ["אינטר מילאנו", "Internazionale"]],
  ["borussia-dortmund", "בורוסיה דורטמונד", "Borussia Dortmund", "Signal Iduna Park", "דורטמונד", 80, "#FDE100", ["דורטמונד"]],
  ["juventus", "יובנטוס", "Juventus", "Allianz Stadium", "טורינו", 80, "#000000", ["יובה"]]
]);

const EUROLEAGUE_GUESTS = mk("euroleague", "basketball", [
  ["real-madrid-bc", "ריאל מדריד כדורסל", "Real Madrid Baloncesto", "WiZink Center", "מדריד", 92, "#FEBE10", ["Real Madrid Basketball"]],
  ["barcelona-bc", "ברצלונה כדורסל", "FC Barcelona Basket", "Palau Blaugrana", "ברצלונה", 88, "#A50044", ["Barcelona Basketball"]],
  ["olympiacos-bc", "אולימפיאקוס", "Olympiacos", "Peace and Friendship Stadium", "פיראוס", 88, "#E30613", ["Olympiacos Piraeus"]],
  ["panathinaikos-bc", "פנתינייקוס", "Panathinaikos", "OAKA", "אתונה", 89, "#007A33", ["Panathinaikos Athens"]],
  ["fenerbahce-bc", "פנרבחצ'ה", "Fenerbahçe Beko", "Ülker Sports Arena", "איסטנבול", 90, "#FFED00", ["Fenerbahce"]],
  ["partizan-bc", "פרטיזן בלגרד", "Partizan Belgrade", "Aleksandar Nikolić Hall", "בלגרד", 80, "#000000", ["Partizan"]]
]);

const NBA_ROWS: T[] = [
  ["atlanta-hawks", "אטלנטה הוקס", "Atlanta Hawks", "State Farm Arena", "אטלנטה", 66, "#E03A3E"],
  ["boston-celtics", "בוסטון סלטיקס", "Boston Celtics", "TD Garden", "בוסטון", 84, "#007A33"],
  ["brooklyn-nets", "ברוקלין נטס", "Brooklyn Nets", "Barclays Center", "ברוקלין", 52, "#000000"],
  ["charlotte-hornets", "שארלוט הורנטס", "Charlotte Hornets", "Spectrum Center", "שארלוט", 58, "#1D1160"],
  ["chicago-bulls", "שיקגו בולס", "Chicago Bulls", "United Center", "שיקגו", 58, "#CE1141"],
  ["cleveland-cavaliers", "קליבלנד קבלירס", "Cleveland Cavaliers", "Rocket Arena", "קליבלנד", 82, "#860038"],
  ["dallas-mavericks", "דאלאס מאבריקס", "Dallas Mavericks", "American Airlines Center", "דאלאס", 70, "#00538C"],
  ["denver-nuggets", "דנבר נאגטס", "Denver Nuggets", "Ball Arena", "דנבר", 84, "#0E2240"],
  ["detroit-pistons", "דטרויט פיסטונס", "Detroit Pistons", "Little Caesars Arena", "דטרויט", 70, "#C8102E"],
  ["golden-state-warriors", "גולדן סטייט ווריורס", "Golden State Warriors", "Chase Center", "סן פרנסיסקו", 76, "#1D428A"],
  ["houston-rockets", "יוסטון רוקטס", "Houston Rockets", "Toyota Center", "יוסטון", 80, "#CE1141"],
  ["indiana-pacers", "אינדיאנה פייסרס", "Indiana Pacers", "Gainbridge Fieldhouse", "אינדיאנפוליס", 74, "#002D62"],
  ["la-clippers", "לוס אנג'לס קליפרס", "LA Clippers", "Intuit Dome", "לוס אנג'לס", 66, "#C8102E"],
  ["la-lakers", "לוס אנג'לס לייקרס", "Los Angeles Lakers", "Crypto.com Arena", "לוס אנג'לס", 78, "#552583", ["לייקרס"]],
  ["memphis-grizzlies", "ממפיס גריזליס", "Memphis Grizzlies", "FedExForum", "ממפיס", 68, "#5D76A9"],
  ["miami-heat", "מיאמי היט", "Miami Heat", "Kaseya Center", "מיאמי", 68, "#98002E"],
  ["milwaukee-bucks", "מילווקי באקס", "Milwaukee Bucks", "Fiserv Forum", "מילווקי", 70, "#00471B"],
  ["minnesota-timberwolves", "מינסוטה טימברוולבס", "Minnesota Timberwolves", "Target Center", "מינאפוליס", 78, "#0C2340"],
  ["new-orleans-pelicans", "ניו אורלינס פליקנס", "New Orleans Pelicans", "Smoothie King Center", "ניו אורלינס", 58, "#0C2340"],
  ["new-york-knicks", "ניו יורק ניקס", "New York Knicks", "Madison Square Garden", "ניו יורק", 80, "#006BB6"],
  ["oklahoma-city-thunder", "אוקלהומה סיטית'אנדר", "Oklahoma City Thunder", "Paycom Center", "אוקלהומה סיטי", 92, "#007AC1", ["אוקלהומה"]],
  ["orlando-magic", "אורלנדו מג'יק", "Orlando Magic", "Kia Center", "אורלנדו", 72, "#0077C0"],
  ["philadelphia-76ers", "פילדלפיה 76", "Philadelphia 76ers", "Wells Fargo Center", "פילדלפיה", 66, "#006BB6", ["סיקסרס", "Sixers"]],
  ["phoenix-suns", "פיניקס סאנס", "Phoenix Suns", "Mortgage Matchup Center", "פיניקס", 62, "#1D1160"],
  ["portland-trail-blazers", "פורטלנד טרייל בלייזרס", "Portland Trail Blazers", "Moda Center", "פורטלנד", 58, "#E03A3E"],
  ["sacramento-kings", "סקרמנטו קינגס", "Sacramento Kings", "Golden 1 Center", "סקרמנטו", 62, "#5A2D81"],
  ["san-antonio-spurs", "סן אנטוניו ספרס", "San Antonio Spurs", "Frost Bank Center", "סן אנטוניו", 72, "#C4CED4"],
  ["toronto-raptors", "טורונטו ראפטורס", "Toronto Raptors", "Scotiabank Arena", "טורונטו", 62, "#CE1141"],
  ["utah-jazz", "יוטה ג'אז", "Utah Jazz", "Delta Center", "סולט לייק סיטי", 52, "#002B5C"],
  ["washington-wizards", "וושינגטון וויזרדס", "Washington Wizards", "Capital One Arena", "וושינגטון", 48, "#002B5C"]
];

export const TEAM_SEEDS: TeamSeed[] = [
  ...IL_PREMIER,
  ...IL_LEUMIT,
  ...IL_WINNER,
  ...EPL,
  ...LALIGA,
  ...UCL_GUESTS,
  ...EUROLEAGUE_GUESTS,
  ...mk("nba", "basketball", NBA_ROWS)
];
