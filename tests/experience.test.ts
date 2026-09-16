import assert from "node:assert/strict";
import test from "node:test";
import { extractExperienceYears, inferExperienceLevel } from "../src/discovery/experience.ts";

test("başlıktaki düzey ifadeleri doğru sınıflandırılır", () => {
  const cases: Array<[string, string]> = [
    ["Veri Analisti Stajyeri", "intern"],
    ["Data Analyst Intern", "intern"],
    ["Yeni Mezun Yazılım Geliştirici", "entry"],
    ["Associate Data & AI Engineering Consultant - New Graduate (Entry Level)", "entry"],
    ["Junior Data Analyst", "junior"],
    ["Jr. Business Analyst", "junior"],
    ["Finans Uzman Yardımcısı", "associate"],
    ["Associate Analyst", "associate"],
    ["SQL Yazılım Geliştirme Uzmanı", "mid"],
    ["Data Specialist", "mid"],
    ["Senior Data Analyst", "senior"],
    ["Kıdemli Veri Mühendisi", "senior"],
    ["Takım Lideri - Veri Platformu", "lead"],
    ["Tech Lead", "lead"],
    ["Veri Analitiği Müdürü", "manager"],
    ["Engineering Manager", "manager"],
  ];
  for (const [title, expected] of cases) {
    assert.equal(inferExperienceLevel(title)?.level, expected, title);
  }
});

test("bileşik unvanlarda daha belirgin ifade kazanır", () => {
  // "Müdür Yardımcısı" yönetim kademesidir; "Uzman Yardımcısı" değildir.
  assert.equal(inferExperienceLevel("Finans Müdür Yardımcısı")?.level, "manager");
  assert.equal(inferExperienceLevel("Muhasebe Uzman Yardımcısı")?.level, "associate");
  // "Senior Manager" yönetim; "Senior Analyst" kıdem.
  assert.equal(inferExperienceLevel("Senior Manager, Analytics")?.level, "manager");
  assert.equal(inferExperienceLevel("Senior Analyst")?.level, "senior");
  // Stajyerlik her zaman önce gelir.
  assert.equal(inferExperienceLevel("Uzman Yardımcısı Stajyeri")?.level, "intern");
});

test("düzey belirten ifade yoksa tahmin üretilmez", () => {
  for (const title of ["Analyst", "Data Solutions Analyst/TechnoPark", "Veri Analisti", "", null, undefined]) {
    assert.equal(inferExperienceLevel(title ?? null), null, String(title));
  }
});

test("başlıkta düzey yoksa açıklamaya bakılır ve kaynak taşınır", () => {
  const fromTitle = inferExperienceLevel("Senior Data Analyst", "3 yıl deneyim");
  assert.equal(fromTitle?.source, "title");
  assert.equal(fromTitle?.evidence, "senior");

  const fromDescription = inferExperienceLevel("Veri Analisti", "Aranan nitelikler: junior düzeyde adaylar");
  assert.equal(fromDescription?.level, "junior");
  assert.equal(fromDescription?.source, "description");
});

test("yıl bilgisi yalnızca deneyim bağlamında okunur ve alt sınır alınır", () => {
  assert.equal(extractExperienceYears("En az 5 yıl deneyim gereklidir"), 5);
  assert.equal(extractExperienceYears("1-3 yıl tecrübeli adaylar"), 1);
  assert.equal(extractExperienceYears("3+ years of experience with SQL"), 3);
  assert.equal(extractExperienceYears("Şirket 20 yıldır sektörde"), null);
  assert.equal(extractExperienceYears("Deneyim aranmamaktadır"), null);
  assert.equal(extractExperienceYears(null), null);
});
