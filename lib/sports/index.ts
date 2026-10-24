import type { Credentials } from "@/lib/server/credentials";
import type { LeagueDTO, TeamDTO } from "@/lib/types";
import { ApiFootballProvider } from "./api-football";
import { ChainProvider } from "./chain";
import { EspnProvider } from "./espn";
import { PortalProvider } from "./portals";
import { SportmonksProvider } from "./sportmonks";
import type { SportsProvider } from "./types";

/**
 * Builds the live-data provider for the resolved credentials. The default ("auto") needs no key at all:
 * [paid provider if a key exists] -> ESPN public JSON -> Israeli portal scraping. "mock" disables live data.
 */
export function getProvider(creds: Credentials["sports"], teams: TeamDTO[], leagues: LeagueDTO[]): SportsProvider | null {
  const paid = (): SportsProvider | null =>
    creds.apiFootballKey && creds.provider !== "sportmonks"
      ? new ApiFootballProvider(creds.apiFootballKey, creds.apiBasketballKey)
      : creds.sportmonksToken
        ? new SportmonksProvider(creds.sportmonksToken)
        : null;

  switch (creds.provider) {
    case "mock":
      return null;
    case "api-football":
      return new ApiFootballProvider(creds.apiFootballKey, creds.apiBasketballKey);
    case "sportmonks":
      return creds.sportmonksToken ? new SportmonksProvider(creds.sportmonksToken) : null;
    case "espn":
      return new EspnProvider();
    case "portals":
      return new PortalProvider(teams, leagues);
    default: {
      const chain = [paid(), new EspnProvider(), new PortalProvider(teams, leagues)].filter((p): p is SportsProvider => Boolean(p));
      return new ChainProvider(chain);
    }
  }
}
