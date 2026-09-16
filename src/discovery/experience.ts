// Deneyim düzeyi çıkarımı.
//
// ÖNEMLİ: İş alarmı e-postalarının ilan kartlarında sitenin "deneyim düzeyi" alanı BULUNMAZ
// (kartta yalnızca başlık ve bazen "Şirket · Konum" satırı vardır). Bu yüzden düzey, ilan
// başlığındaki anahtar ifadelerden ÇIKARILIR ve her zaman "tahmin" olarak işaretlenir.
// Eşleşme yoksa hiçbir şey uydurulmaz; sonuç null olur.

export const EXPERIENCE_LEVELS = ["intern", "entry", "junior", "associate", "mid", "senior", "lead", "manager"] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  intern: "Stajyer",
  entry: "Yeni mezun / Giriş",
  junior: "Junior",
  associate: "Uzman yardımcısı",
  mid: "Uzman / Orta",
  senior: "Kıdemli",
  lead: "Takım lideri",
  manager: "Yönetici",
};

export interface ExperienceInference {
  level: ExperienceLevel;
  // Eşleşen ifade; arayüz "neden böyle sınıflandı" sorusunu yanıtlayabilsin diye taşınır.
  evidence: string;
  source: "title" | "description";
}

// Türkçe ekler ("Stajyeri", "Uzmanı", "Müdürü") için sözcük sonuna ek toleransı gerekir ve
// JS'in \b sınırı ASCII olduğundan ı/ş/ü gibi harflerde çalışmaz; Unicode bakış kısıtları kullanılır.
const NOT_LETTER_BEFORE = String.raw`(?<!\p{L})`;
const NOT_LETTER_AFTER = String.raw`(?!\p{L})`;
const SUFFIX = String.raw`\p{L}*`;

function rule(level: ExperienceLevel, body: string): { level: ExperienceLevel; pattern: RegExp } {
  return { level, pattern: new RegExp(`${NOT_LETTER_BEFORE}(?:${body})${NOT_LETTER_AFTER}`, "u") };
}

// Sıra önemlidir: bileşik ifadeler, içerdikleri tek kelimelerden önce denenir.
// Örn. "Müdür Yardımcısı" -> manager, "Uzman Yardımcısı" -> associate, "Uzman" -> mid.
const RULES: Array<{ level: ExperienceLevel; pattern: RegExp }> = [
  rule("intern", `stajyer${SUFFIX}|staj|internship|intern`),
  rule("entry", `yeni mezun${SUFFIX}|new grad(?:uate)?|entry[ -]?level|giriş seviyesi|başlangıç seviyesi|trainee`),
  rule("junior", `junior|jr\\.?`),
  rule(
    "manager",
    `müdür${SUFFIX}\\s+yardımcı${SUFFIX}|direktör${SUFFIX}\\s+yardımcı${SUFFIX}|assistant manager|associate director|` +
      `genel müdür${SUFFIX}|müdür${SUFFIX}|manager|direktör${SUFFIX}|director|head of|yönetici${SUFFIX}`,
  ),
  rule("lead", `takım lider${SUFFIX}|ekip lider${SUFFIX}|team lead(?:er)?|tech lead|lead|principal|baş mühendis${SUFFIX}|şef${SUFFIX}`),
  rule("senior", `senior|sr\\.?|kıdemli|deneyimli`),
  rule("associate", `uzman${SUFFIX}\\s+yardımcı${SUFFIX}|yardımcı\\s+uzman${SUFFIX}|associate|assistant|asistan${SUFFIX}`),
  rule("mid", `uzman${SUFFIX}|specialist|mid[ -]?level|orta düzey|expert`),
];

function collapse(value: string): string {
  return value.replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
}

// İki küçültme birlikte denenir: tr-TR "I" harfini "ı" yaptığı için "Intern" -> "ıntern" olur ve
// İngilizce unvanlar kaçar; sabit küçültme ise "İ" harfini birleşik noktayla bozar. İkisi de bakılır.
function haystacks(value: string): string[] {
  const turkish = collapse(value.toLocaleLowerCase("tr-TR"));
  const invariant = collapse(value.toLowerCase());
  return turkish === invariant ? [turkish] : [turkish, invariant];
}

function matchLevel(text: string): { level: ExperienceLevel; evidence: string } | null {
  const candidates = haystacks(text);
  for (const rule of RULES) {
    for (const haystack of candidates) {
      const match = haystack.match(rule.pattern);
      if (match?.[0]) return { level: rule.level, evidence: match[0].trim() };
    }
  }
  return null;
}

// Önce başlık, sonra (varsa) açıklama denenir. Hangi metinden çıkarıldığı sonuçta taşınır.
export function inferExperienceLevel(
  title: string | null | undefined,
  description: string | null | undefined = null,
): ExperienceInference | null {
  const fromTitle = title ? matchLevel(title) : null;
  if (fromTitle) return { ...fromTitle, source: "title" };
  const fromDescription = description ? matchLevel(description) : null;
  if (fromDescription) return { ...fromDescription, source: "description" };
  return null;
}

// "3+ yıl deneyim", "en az 5 yıl", "1-3 yıl tecrübe", "3 years of experience" gibi ifadelerden
// alt sınırı okur. Sayı yoksa veya makul aralıkta değilse null döner.
export function extractExperienceYears(text: string | null | undefined): number | null {
  if (!text) return null;
  const haystack = collapse(text.toLocaleLowerCase("tr-TR"));
  const pattern = /(\d{1,2})\s*(?:-|–|ile)?\s*(\d{1,2})?\s*\+?\s*(?:yıl|yil|sene|years?)\b/g;
  let best: number | null = null;
  for (const match of haystack.matchAll(pattern)) {
    const context = haystack.slice(Math.max(0, match.index - 40), match.index + match[0].length + 40);
    if (!/deneyim|tecrübe|experience/.test(context)) continue;
    const value = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isInteger(value) || value < 0 || value > 40) continue;
    best = best === null ? value : Math.min(best, value);
  }
  return best;
}

export function experienceLabel(inference: ExperienceInference | null): string {
  return inference ? EXPERIENCE_LABELS[inference.level] : "Belirtilmemiş";
}
