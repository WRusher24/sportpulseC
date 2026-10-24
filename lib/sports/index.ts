import type { Credentials } from "@/lib/server/credentials";
import { ApiFootballProvider } from "./api-football";
import { SportmonksProvider } from "./sportmonks";
import type { SportsProvider } from "./types";

/** Returns the live provider selected by the resolved credentials, or null for the offline baseline (mock adapter). */
export function getProvider(creds: Credentials["sports"]): SportsProvider | null {
  switch (creds.provider) {
    case "api-football":
      return new ApiFootballProvider(creds.apiFootballKey, creds.apiBasketballKey);
    case "sportmonks":
      return creds.sportmonksToken ? new SportmonksProvider(creds.sportmonksToken) : null;
    default:
      return null;
  }
}
