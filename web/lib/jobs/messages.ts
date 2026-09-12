import type { UpsertOutcome } from "./types";

export const OUTCOME_MESSAGES: Record<UpsertOutcome, string> = {
  inserted: "İlan eklendi.",
  updated: "İlan zaten kayıtlıydı; eksik alanlar tamamlandı.",
  unchanged: "Bu ilan zaten kayıtlı; değişiklik yapılmadı.",
};
