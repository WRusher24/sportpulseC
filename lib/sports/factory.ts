import type { Repo } from "@/lib/data/repo";
import type { Credentials } from "@/lib/server/credentials";
import { getProvider } from "./index";

/** Loads the club/league catalogue the free providers need for name matching, then builds the provider. */
export async function providerFor(repo: Repo, sports: Credentials["sports"]) {
  if (sports.provider === "mock") return null;
  const [teams, leagues] = await Promise.all([repo.listTeams(), repo.listLeagues()]);
  return getProvider(sports, teams, leagues);
}
