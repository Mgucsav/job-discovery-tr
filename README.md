# Kişisel İş İlanı Keşif Sistemi — Aşama 1

Bu proje, LinkedIn, Kariyer.net ve Indeed üzerinde kullanıcı tarafından oluşturulan iş alarmı e-postalarından ilan keşfeder. Siteleri scrape etmez, site hesabına giriş yapmaz, aday arama API'si varmış gibi davranmaz ve başvuru göndermez.

> **Pilot ayrıştırıcı uyarısı:** Ayrıştırıcılar kişisel veri içermeyen temsili e-posta fixture'larıyla doğrulandı. Gerçek alarm e-postalarının güncel şablonları henüz görülmediği için canlı kullanımda çözümlenemeyen e-postalar raporlanmalı ve şablon değişikliklerine göre ayrıştırıcılar kontrollü biçimde güncellenmelidir.

## Çalışan mimari

Akış şöyledir:

```text
Gmail readonly API → MIME gövde normalizasyonu → URL çıkarma/doğrulama
                  → kaynak bazlı ilan sözleşmesi → JobRepository → koşu raporu
```

- Gmail erişimi yalnızca `https://www.googleapis.com/auth/gmail.readonly` OAuth kapsamını ister.
- Yalnızca ayarlanan Gmail etiketindeki iletiler okunur.
- LinkedIn, Kariyer.net ve Indeed için yalnızca izin verilen alan adlarındaki doğrudan HTTPS ilan yolları kabul edilir.
- `lnkd.in`, Indeed `/rc/clk`, bilinmeyen yönlendirme alan adları, HTTP bağlantıları ve kullanıcı bilgisi taşıyan URL'ler reddedilir.
- Takip sorguları atılır ve URL kanonik hale getirilir.
- Tekillik anahtarı `source + sourceJobId`'dir. Siteler arası benzer ilanlar birleştirilmez.
- Başlık yalnızca güvenilir bağlantı metninde varsa alınır; yoksa `null`/`missing` saklanır. Açıklama bu aşamada her zaman `missing`'dir.
- Her çalışmada Gmail durumu, okunan ve çözümlenemeyen e-posta sayısı, kaynak başına bulunan/yeni/tekrar ilanlar ile kaynak/depo hataları ayrı raporlanır. Sıfır ilan bir hata sayılmaz.

## Gereksinimler ve yerel kurulum

- Node.js 22 veya üzeri
- Bir Google Cloud projesi ve Gmail API etkinleştirmesi
- İş alarmı e-postalarının yönlendirildiği/teslim edildiği ayrı bir Gmail hesabı

Kurulum:

```powershell
npm install
Copy-Item .env.example .env.local
```

`.env.local` içinde en az `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` ve `GMAIL_JOB_LABEL` alanlarını doldurun. `.env.local` Git tarafından yok sayılır.

## Gmail OAuth kurulumu

1. Google Cloud Console'da Gmail API'yi etkinleştirin.
2. OAuth onay ekranını yapılandırın. Uygulama test modundaysa Gmail hesabınızı test kullanıcısı ekleyin.
3. `Desktop app` türünde bir OAuth istemcisi oluşturun.
4. İstemci kimliğini ve sırrını `.env.local` dosyasına koyun.
5. Gmail'de iş alarmı iletilerine tek ve açık bir etiket verin; tam etiket adını `GMAIL_JOB_LABEL` olarak ayarlayın.
6. Yetkilendirme yardımcısını başlatın:

```powershell
npm run oauth:setup
```

Komut yerel `127.0.0.1` callback sunucusu açar ve bir Google yetkilendirme adresi gösterir. Adresi tarayıcıda elle açın. Başarıdan sonra refresh token doğrudan gitignore kapsamındaki `.env.local` dosyasına yazılır; konsola basılmaz. Gmail parolası hiçbir zaman istenmez veya saklanmaz.

Google hesabından erişimi iptal etmek için Google Hesabı → Güvenlik → Üçüncü taraf erişimi bölümünden uygulamanın iznini kaldırın.

## Çalıştırma

Canlı Gmail etiketi üzerinde keşif:

```powershell
npm run discover
```

Varsayılan yerel çıktı `data/jobs.json` dosyasıdır. Koşu raporu JSON olarak terminale yazılır. `GMAIL_MAX_MESSAGES` bir çalışmadaki e-posta üst sınırını (1–500) belirler.

Gerçek Gmail erişimi olmadan fixture koşusu:

```powershell
npm run discover:fixtures
```

Kalite kontrolleri:

```powershell
npm test
npm run typecheck
npm run build
```

## Veri sözleşmesi

```ts
interface JobPosting {
  source: "linkedin" | "kariyer" | "indeed";
  sourceJobId: string;
  url: string;                  // kanonik ve doğrulanmış HTTPS adresi
  title: string | null;
  titleStatus: "present" | "missing";
  descriptionStatus: "missing";
  firstSeenAt: string;          // ISO-8601
  sourceEmailId: string;
}
```

İlk görülme zamanı ve onu sağlayan kaynak e-posta kimliği korunur. Daha eski bir e-posta sonradan işlenirse ilk görülme bilgisi geriye çekilir. Eksik başlık daha sonraki bir e-postada bulunursa tamamlanabilir.

## Veri güvenliği

- `.env`, `.env.*`, token dosyaları, `credentials.json`, `data/`, `private/`, `.eml`, `.mbox`, PDF ve Word/CV dosyaları `.gitignore` kapsamındadır.
- İstemci sırrı ve refresh token yalnızca yerel `.env.local` ortam dosyasındadır.
- Tam e-posta gövdeleri kalıcı depoya yazılmaz. Yalnızca ilan alanları ve Gmail e-posta kimliği tutulur.
- Fixture'lar hayalî kimlikler/şirket metinleri içerir; gerçek kişi, adres veya gerçek e-posta gövdesi içermez.
- Hata mesajları token'ı loglamaz. Google'ın hata yanıtının yalnızca sınırlı bir bölümü teşhis amacıyla gösterilir.

Yerel JSON deposu tek süreçli geliştirme/pilot kullanım içindir. **Vercel'in geçici dosya sistemi kalıcı veri tabanı değildir ve bu depo Vercel üretim kalıcılığı olarak tasarlanmamıştır.** `JobRepository` arayüzü, sonraki dağıtımda Postgres gibi kalıcı bir harici veri tabanı adaptörüyle değiştirilmelidir. Zamanlanmış görev de aynı keşif servisini çağırabilir; bu aşamada canlı zamanlama yoktur. Kalıcı depolama ve Vercel dağıtımı, aşağıdaki Aşama 2 web arayüzünde Supabase Postgres ile sağlanır; CLI keşfi henüz o veri tabanına bağlı değildir.

## Aşama 2: Web arayüzü (web/) ve Supabase kalıcılığı

`web/` klasörü, ilanları Supabase Postgres'te kalıcı tutan ve yalnızca tek bir hesabın kullandığı Next.js + TypeScript uygulamasıdır. Vercel'de **Root Directory = `web/`** olarak dağıtılır. Mevcut CLI komutları (`discover`, `discover:fixtures`, `oauth:setup`) değişmedi ve bu aşamada Supabase'e yazmıyor.

Yapabildikleri:

- Supabase Auth (e-posta + şifre) ile giriş; herkese açık kayıt kapalı.
- İlan listesi, kaynak filtresi (LinkedIn / Kariyer.net / Indeed), ilk görülme tarihine göre sıralama, "İlanı aç" ve "Sil".
- "Bağlantı ekle": yalnızca `validateJobUrl` kurallarından geçen doğrudan HTTPS ilan bağlantıları kabul edilir; URL kanonik hale getirilir. Başlık/şirket/konum/açıklama isteğe bağlıdır, boş alanlar `null` kalır. Manuel kayda Gmail e-posta kimliği yazılmaz.
- Boş veri tabanında açıkça "Henüz ilan yok; Gmail keşfi bağlı değil" gösterilir; örnek veri yoktur.

Bilinçli olarak yapmadıkları: otomatik başvuru, form doldurma, AI puanlama, canlı Gmail zamanlayıcısı, Gmail keşif sonuçlarını Supabase'e yazma (CLI hâlâ yerel JSON depoya yazar).

### Veri modeli ve güvenlik

- Şema: `supabase/migrations/20260912120000_job_postings.sql`. Tablo `public.job_postings`; tekillik anahtarı `owner_id + source + source_job_id`. Saklanan alanlar: kaynak, kaynak ilan ID'si, kanonik URL, başlık/şirket/konum/açıklama (varsa), `first_seen_at`, `acquisition_method` (`manual` | `gmail`) ve yalnızca Gmail kayıtları için `source_email_id` (check kısıtı ile zorlanır).
- `upsert_job_posting()` fonksiyonu `JsonFileJobRepository.upsert` ile aynı davranır: yeni ilan `inserted`; daha eski görülme ilk görülme bilgisini geri çeker; eksik alanlar tamamlanır; aksi hâlde `unchanged`. Fonksiyon `security invoker` olduğundan RLS çağıran kullanıcı adına uygulanır.
- Row Level Security açık. Politikalar yalnızca `authenticated` rolüne, `owner_id = auth.uid()` koşuluyla tanımlı. Politikalardan bağımsız olarak `anon` rolünün tablo ve fonksiyon üzerindeki tüm yetkileri iptal edilmiştir; anonim istekler boş sonuç değil yetki hatası alır.
- Next.js tarafında `@supabase/ssr` kullanılır. `proxy.ts` her istekte oturumu tazeler ve oturumsuz istekleri `/login`'e yönlendirir; sayfalar ve sunucu eylemleri ayrıca `auth.getUser()` ile doğrulanmış oturum ister (`getSession()` içindeki kullanıcı nesnesine güvenilmez). Kişisel sayfalar `force-dynamic`; statik çıktı üretilmez.
- Tarayıcıda yalnızca `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` bulunur. `service_role`/secret anahtar kullanılmaz. Tüm Supabase çağrıları sunucu tarafında yapılır.

### Yerel çalıştırma

```powershell
cd web
npm install
Copy-Item .env.example .env.local   # Supabase URL ve publishable key doldurun (Git dışıdır)
npm test
npm run typecheck
npm run build
npm run dev                         # http://localhost:3000
```

Migration'ı bağlı projeye uygulamak için (Supabase CLI ile giriş ve `supabase link` sonrası):

```powershell
npx supabase db push
```

Gerçek projeye karşı RLS/kalıcılık doğrulaması (şifre terminalde gizli girilir, hiçbir yere yazılmaz):

```powershell
cd web
npm run verify:supabase
```

Bu komut anonim okuma/yazmanın reddedildiğini, oturumla eklenen TEST kaydının yeniden okunduğunda durduğunu, tekrar eklemede `unchanged` döndüğünü, kaydın silindiğini ve oturum kapatılınca okumanın engellendiğini raporlar.

### Vercel

Proje GitHub deposundan içe aktarılır; **Root Directory: `web`**. Ortam değişkenleri: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `web/` uygulaması depo kökündeki `src/domain.ts` ve `src/discovery/parser.ts` dosyalarını doğrudan içe aktardığı için "Include source files outside of the Root Directory" ayarı açık olmalıdır (varsayılan açıktır).

## Bu aşamanın sınırları

Bu sürüm yalnızca ilan keşfeder. Şunları bilinçli olarak yapmaz:

- İlan uygunluğu veya AI puanlama
- İlan açıklamasını siteden çekme
- Sitelerde otomatik gezinme, giriş veya scraping
- CV okuma, uyarlama ya da üretme
- Başvuru gönderme
- Başvuru durumu/takibi
- Farklı sitelerdeki benzer ilanları aynı ilan diye birleştirme
- Zamanlanmış canlı görev (Gmail keşfi elle CLI ile çalıştırılır)

Gerçek pilotta `unresolvedEmails` artarsa kişisel içerik paylaşmak yerine mümkünse anonimleştirilmiş HTML yapısı üzerinden yeni bir fixture ve regresyon testi eklenmelidir.
