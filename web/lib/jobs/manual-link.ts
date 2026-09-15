import { validateJobUrl } from "@/lib/core";
import type { StoredJobPostingInput } from "./types";

export interface ManualLinkInput {
  url: string;
  title?: string | null | undefined;
  company?: string | null | undefined;
  location?: string | null | undefined;
  description?: string | null | undefined;
}

export type ManualLinkResult = { ok: true; input: StoredJobPostingInput } | { ok: false; error: string };

export const MANUAL_LINK_URL_ERROR =
  "Yalnızca doğrudan HTTPS ilan bağlantıları kabul edilir: LinkedIn (/jobs/view/ID), Kariyer.net (/is-ilani/...-ID) veya Indeed (/viewjob?jk=...). Kısaltılmış veya yönlendirme bağlantıları reddedilir.";

export const FIELD_LIMITS = { title: 240, company: 200, location: 200, description: 5000 } as const;

function optionalText(value: string | null | undefined, limit: number, label: string): string | null {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > limit) throw new RangeError(`${label} en fazla ${limit} karakter olabilir.`);
  return trimmed;
}

// Elle eklenen bağlantıyı çekirdek doğrulama kurallarından geçirir ve depo girdisine çevirir.
// Boş alanlar null kalır; manuel kayda Gmail e-posta kimliği yazılmaz.
export function prepareManualLink(input: ManualLinkInput, now: () => Date = () => new Date()): ManualLinkResult {
  const rawUrl = (input.url ?? "").trim();
  if (rawUrl.length === 0) return { ok: false, error: "İlan bağlantısı boş olamaz." };
  if (rawUrl.length > 2048) return { ok: false, error: "İlan bağlantısı çok uzun." };

  const validated = validateJobUrl(rawUrl);
  if (!validated) return { ok: false, error: MANUAL_LINK_URL_ERROR };

  try {
    return {
      ok: true,
      input: {
        source: validated.source,
        sourceJobId: validated.sourceJobId,
        url: validated.canonicalUrl,
        title: optionalText(input.title, FIELD_LIMITS.title, "Başlık"),
        company: optionalText(input.company, FIELD_LIMITS.company, "Şirket"),
        location: optionalText(input.location, FIELD_LIMITS.location, "Konum"),
        description: optionalText(input.description, FIELD_LIMITS.description, "Açıklama"),
        firstSeenAt: now().toISOString(),
        acquisitionMethod: "manual",
        sourceEmailId: null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof RangeError ? error.message : "Alanlar doğrulanamadı." };
  }
}
