> English version: [README.md](README.md)

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
- `lnkd.in`, `engage.indeed.com` gibi kapalı yönlendirmeler, HTTP bağlantıları ve kullanıcı bilgisi taşıyan URL'ler reddedilir. LinkedIn `?currentJobId=`, Indeed `?vjk=` ve `/rc/clk?jk=` biçimleri kimlik adresten okunarak (yönlendirme takip edilmeden) kabul edilir.
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
  company: string | null;       // e-posta kartındaki "Şirket · Konum" satırından
  location: string | null;
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

Yerel JSON deposu tek süreçli geliştirme/pilot kullanım içindir. **Vercel'in geçici dosya sistemi kalıcı veri tabanı değildir ve bu depo Vercel üretim kalıcılığı olarak tasarlanmamıştır.** `JobRepository` arayüzü, sonraki dağıtımda Postgres gibi kalıcı bir harici veri tabanı adaptörüyle değiştirilmelidir. Zamanlanmış görev de aynı keşif servisini çağırabilir; bu aşamada canlı zamanlama yoktur. Kalıcı depolama ve Vercel dağıtımı, aşağıdaki Aşama 2 web arayüzünde Firebase (Firestore) ile sağlanır; Aşama 3 ile CLI keşfi de aynı depoya yazar.

## Aşama 2: Web arayüzü (web/) ve Firebase kalıcılığı

`web/` klasörü, ilanları Cloud Firestore'da kalıcı tutan ve yalnızca tek bir Firebase Authentication hesabının kullandığı Next.js + TypeScript uygulamasıdır. Vercel'de **Root Directory = `web/`** olarak dağıtılır. Mevcut CLI komutları (`discover`, `discover:fixtures`, `oauth:setup`) korunur; `discover` Aşama 3 ile `JOB_STORE=firestore` seçildiğinde aynı Firestore hesabına yazar.

Yapabildikleri:

- E-posta + şifre ile giriş (Firebase Authentication); herkese açık kayıt kapalı.
- İlan listesi, kaynak filtresi (LinkedIn / Kariyer.net / Indeed), ilk görülme tarihine göre sıralama, "İlanı aç" ve "Sil".
- "Bağlantı ekle": yalnızca `validateJobUrl` kurallarından geçen doğrudan HTTPS ilan bağlantıları kabul edilir; URL kanonik hale getirilir. Başlık/şirket/konum/açıklama isteğe bağlıdır, boş alanlar `null` kalır. Manuel kayda Gmail e-posta kimliği yazılmaz.
- Boş veri tabanında açıkça "Henüz ilan yok; Gmail keşfi bağlı değil" gösterilir; örnek veri yoktur.

Bilinçli olarak yapmadıkları: otomatik başvuru, form doldurma, AI puanlama, canlı (bulut) Gmail zamanlayıcısı. Gmail keşfi Aşama 3 ile aynı Firestore hesabına yazar (aşağıda).

### Veri modeli ve güvenlik

- Firestore yerleşimi: `users/{uid}/jobPostings/{source__sourceJobId}`. Belge kimliği tekillik anahtarıdır (sahip + kaynak + kaynak ilan ID'si). Alanlar: `ownerId`, `source`, `sourceJobId`, kanonik `url`, `title`/`company`/`location`/`description` (varsa, yoksa `null`), `firstSeenAt`, `acquisitionMethod` (`manual` | `gmail`), yalnızca Gmail kayıtları için `sourceEmailId`, `createdAt`, `updatedAt`.
- `web/lib/jobs/merge.ts` içindeki birleştirme kuralı `JsonFileJobRepository.upsert` ile aynıdır: yeni ilan `inserted`; daha eski görülme ilk görülme bilgisini ve edinilme kaynağını geri çeker; eksik alanlar tamamlanır, mevcut değer ezilmez; aksi hâlde `unchanged`. Yazma bir Firestore transaction'ı içinde yapılır.
- `firestore.rules` **tüm istemci/anonim erişimi reddeder** (`allow read, write: if false`). Veriye yalnızca uygulamanın sunucu tarafı (Admin SDK) doğrulanmış oturumla erişir; `uid` her zaman oturum çerezinden türetilir, istekten alınmaz.
- Oturum: giriş sunucu tarafında Identity Toolkit REST ile yapılır, Admin SDK `createSessionCookie` ile **HttpOnly, Secure, SameSite=Lax** çerez üretilir. Her sayfa, sunucu eylemi ve route handler `verifySessionCookie(…, checkRevoked=true)` ile doğrulanmış kullanıcı ister; `proxy.ts` yalnızca çerezi olmayan istekleri `/login`'e yönlendirir ve tek başına yetki kaynağı değildir. Çıkışta refresh token'lar iptal edilir. Kişisel sayfalar `force-dynamic`; statik çıktı üretilmez.
- Tarayıcıya hiçbir Firebase yapılandırması (API anahtarı dahil) gönderilmez. Sunucu ortam değişkenleri: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (servis hesabı), `FIREBASE_WEB_API_KEY`. Servis hesabı anahtarı yalnızca Vercel proje ayarlarında ve yerel `web/.env.local` içinde bulunur; `*service-account*.json` ve `*-firebase-adminsdk-*.json` dosyaları `.gitignore` kapsamındadır.
- JSON API (`/api/login`, `/api/logout`, `/api/jobs`) aynı oturum doğrulamasını ve aynı depo fonksiyonlarını kullanır; gövdeli istekler yalnızca `application/json` kabul eder.

### Yerel çalıştırma

```powershell
cd web
npm install
Copy-Item .env.example .env.local   # Firebase servis hesabı ve Web API anahtarı (Git dışıdır)
npm test
npm run typecheck
npm run build
npm run dev                         # http://localhost:3000
```

Firestore kurallarını dağıtmak için (`npx firebase-tools login` sonrası, depo kökünde):

```powershell
npx firebase-tools deploy --only firestore --project <firebase-proje-id>
```

Gerçek uygulamaya karşı uçtan uca doğrulama (şifre terminalde gizli girilir, hiçbir yere yazılmaz):

```powershell
cd web
npm run verify:firebase -- --base-url https://<uygulama>.vercel.app
```

Bu komut oturumsuz isteklerin `/login`'e yönlendirildiğini ve API'nin 401 verdiğini, girişle eklenen TEST kaydının sayfa yeniden istendiğinde göründüğünü, tekrar eklemede `unchanged` döndüğünü, kaydın silindiğini, çıkıştan sonra eski çerezin geçersiz olduğunu ve doğrudan Firestore isteklerinin (anonim ve kullanıcının kendi ID token'ı ile) 403 aldığını raporlar.

### Vercel

Proje GitHub deposundan içe aktarılır; **Root Directory: `web`**. Ortam değişkenleri: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_WEB_API_KEY`. `web/` uygulaması depo kökündeki `src/domain.ts` ve `src/discovery/parser.ts` dosyalarını doğrudan içe aktardığı için "Include source files outside of the Root Directory" ayarı açık olmalıdır (varsayılan açıktır).

## Aşama 3: Gmail keşfi → Firestore (web ile ortak depo)

`npm run discover` artık `JOB_STORE=firestore` ile bulduğu ilanları doğrudan web arayüzünün okuduğu Firestore hesabının altına yazar; yerel JSON deposu (`JOB_STORE=json`, varsayılan) korunur.

- Ortak belge mantığı depo kökünde: `src/storage/job-posting-documents.ts` (belge kimliği, birleştirme kuralı, ayrıştırma) ve `src/storage/job-posting-store.ts` (`FirestoreJobRepository`, `upsert/list/delete`, koşu özeti). Web (`web/lib/core.ts`) aynı modülleri içe aktarır; birleştirme kuralı tek yerde yaşar.
- Yerleşim: `users/{uid}/jobPostings/{source__sourceJobId}` ve `users/{uid}/discoveryRuns/{startedAt}`. Zaman alanları ISO-8601 metindir.
- Gmail kayıtları `acquisitionMethod: gmail` + `sourceEmailId` ile yazılır; elle eklenen bir ilan daha eski bir e-postada görülürse ilk görülme bilgisi ve edinilme kaynağı geriye çekilir, elle girilen alanlar korunur.
- Her koşu sonunda rapor Firestore'a kaydedilir; web'de "Son Gmail keşfi: …" satırı görünür. Koşu hiç yoksa arayüz bunu açıkça söyler.
- Sahip hesap `JOB_OWNER_EMAIL` ile belirlenir; uid Firebase Auth'tan çözülür. CLI, web ile aynı servis hesabı değişkenlerini (`FIREBASE_*`) kullanır.
- Kök modüller `.ts` uzantılı göreli içe aktarım kullanır (`rewriteRelativeImportExtensions`); `dist/` çıktısı yine `.js`'e yazılır ve Turbopack aynı dosyaları doğrudan çözer.

Çalıştırma (Gmail OAuth kurulumu tamamlandıktan sonra):

```powershell
npm run discover          # .env.local: JOB_STORE=firestore, JOB_OWNER_EMAIL=<web hesabı>
```

Günlük otomatik çalışma (Windows Görev Zamanlayıcı, her gün 09:00 ve 18:00; kaçırılırsa bilgisayar açılınca çalışır). Çıktı `data/discover.log` dosyasına eklenir:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-discovery-task.ps1
```

Görev `scripts/run-discovery.cmd` betiğini çağırır; kaldırmak için `Unregister-ScheduledTask -TaskName JobDiscovery`.

## Deneyim düzeyi (tahmin)

İş alarmı e-postalarının ilan kartlarında sitenin "deneyim düzeyi" alanı **yoktur**; kartta yalnızca başlık ve bazen "Şirket · Konum" satırı bulunur. Bu yüzden düzey, `src/discovery/experience.ts` içindeki kural tabanlı sınıflandırıcıyla **başlıktan** (elle girilen açıklama varsa ondan da) çıkarılır: stajyer, yeni mezun/giriş, junior, uzman yardımcısı, uzman/orta, kıdemli, takım lideri, yönetici.

- Türkçe ekler ("Stajyeri", "Uzmanı", "Müdürü") ve bileşik unvanlar gözetilir: "Müdür Yardımcısı" → yönetici, "Uzman Yardımcısı" → uzman yardımcısı, "Senior Manager" → yönetici.
- Başlıkta düzey ifadesi yoksa **hiçbir tahmin üretilmez**; ilan "Belirtilmemiş" grubunda kalır.
- Düzey saklanmaz, her okumada yeniden hesaplanır; kural iyileştikçe eski ilanlar da yeniden sınıflanır. Arayüzde ve Telegram mesajında her zaman "(tahmin)" etiketiyle gösterilir.

## Başvuru takibi ve CV performansı

Her ilan satırının altında küçük bir form var: **durum** (Başvurdum / Görüşme / Teklif / Reddedildi / Geri çektim / Başvurmadım), **kullanılan CV** ve kısa **not**.

- Başvuru tarihi ilk işaretlemede yazılır ve sonraki güncellemelerde değişmez; sonuç tarihi durum değiştiğinde yazılır.
- Kullanılan CV'nin adı kayda kopyalanır; CV'yi sonradan silseniz bile istatistik anlamlı kalır.
- Gmail keşfi aynı ilanı tekrar gördüğünde başvuru kaydına dokunmaz (yalnızca eksik başlık/şirket/konum tamamlanır).
- **İstatistikler** sayfası (`/stats`): CV başına başvuru sayısı, yanıt bekleyen, görüşme, teklif, red, yanıt oranı ve olumlu oran; aynı kırılım deneyim düzeyine (tahmin) ve kaynağa göre de verilir. Oranlar yalnızca sizin kaydettiğiniz başvurulardan hesaplanır; tahmin veya dış veri yoktur.

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
