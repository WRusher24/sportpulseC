import type { MatchDTO } from "@/lib/types";

export const isLiveStatus = (s: MatchDTO["status"]) => s === "first_half" || s === "second_half" || s === "half_time" || s === "extra_time";
