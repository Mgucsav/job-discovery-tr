# job-discovery-tr — Personal Job Discovery System

A personal, single-user system that discovers job postings from the **job-alert e-mails** that LinkedIn, Kariyer.net and Indeed send to your Gmail, stores them durably in **Cloud Firestore**, and shows them in a private **Next.js web app** deployed on **Vercel**.

It deliberately does **not** scrape job sites, log into them, pretend to have a candidate-search API, or submit applications. Everything it knows comes from e-mails you asked the job sites to send you, plus links you paste in yourself.

> Turkish version of this document: [README.tr.md](README.tr.md)

Live instance (private, login required): `https://job-discovery-tr.vercel.app`

---

## Table of contents

1. [What it does today](#what-it-does-today)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Data model](#data-model)
5. [Security model](#security-model)
6. [Requirements](#requirements)
7. [Setup](#setup)
   - [1. Firebase project](#1-firebase-project)
   - [2. Local environment files](#2-local-environment-files)
   - [3. Gmail: alerts, label, OAuth](#3-gmail-alerts-label-oauth)
   - [4. Telegram notifications (optional)](#4-telegram-notifications-optional)
   - [5. Vercel](#5-vercel)
8. [Running](#running)
9. [Scheduling (Windows Task Scheduler)](#scheduling-windows-task-scheduler)
10. [Verification and tests](#verification-and-tests)
11. [Operational notes](#operational-notes)
12. [Limitations and roadmap](#limitations-and-roadmap)

---

## What it does today

**Discovery (CLI, `npm run discover`)**

- Reads only the messages under one Gmail label (default `Is-Alarmi`) using the read-only Gmail API scope `https://www.googleapis.com/auth/gmail.readonly`.
- Normalises each MIME message (text + HTML parts), extracts links, and keeps only **direct, HTTPS job-posting URLs** on the allowed domains:
  - LinkedIn: `https://www.linkedin.com/jobs/view/<id>` (also `/comm/jobs/view/…`, slugged variants, and `/jobs/…?currentJobId=<id>` from search/recommendation pages)
  - Kariyer.net: `https://www.kariyer.net/is-ilani/<slug>-<id>`
  - Indeed: `https://tr.indeed.com/viewjob?jk=<key>`, `/jobs?…&vjk=<key>`, and the `/rc/clk?jk=<key>` / `/pagead/clk?jk=<key>` click links (the key is read from the URL; no redirect is ever followed)
- Rejects shortened/opaque links (`lnkd.in`, `engage.indeed.com`, unknown redirectors), plain `http://`, and URLs carrying user info. Tracking parameters are dropped and the URL is canonicalised.
- Deduplicates by `source + sourceJobId`. Similar postings on different sites are **not** merged.
- Reads the e-mail job card structurally: the link text is split at cell boundaries, the first line becomes the title, a second line of the form "Company · Location" fills company and location. Generic button labels ("Görüntüleyin", "Apply") are never used as titles; anything unknown stays `null`. Description is always "missing" at this stage.
- Writes the postings to the configured store:
  - `JOB_STORE=firestore` (production): the same Firestore account the web app reads, tagged `acquisitionMethod: "gmail"` with the Gmail message id.
  - `JOB_STORE=json` (default / local pilot): `data/jobs.json`.
- Prints a run report (Gmail status, e-mails read, unresolved e-mails, per-source found/new/duplicate counts, repository errors) and, with Firestore, persists the report so the web app can show "last discovery".

**Web app (`web/`)**

- Email + password login for exactly one account (public sign-up is disabled in Firebase Auth).
- Job list with source filter (LinkedIn / Kariyer.net / Indeed), acquisition filter (manual / Gmail), **experience-level filter (inferred)**, first-seen sorting, "Open posting" and "Delete".
- "Add link": paste a job URL; it passes through the same `validateJobUrl` rules as the discovery pipeline, is canonicalised and stored with `acquisitionMethod: "manual"`. Title / company / location / description are optional and stay `null` when empty.
- Shows the last Gmail discovery run (time, e-mails read, new / duplicate / unresolved). With an empty database it says explicitly that there are no postings yet and whether discovery has ever run — no sample data is shown as if it were real.
- **Application tracking** follows the real-life flow. The job list carries a single **"Başvurdum"** button (with the CV you used, pre-selected to your default CV). Applying moves the posting out of the list and into **/applications**, which is organised as tabs: **Aktif** (waiting for an answer) → **Görüşmeler**, **Teklifler**, **Reddedilenler**, **Geri çekilenler**. When the answer e-mail arrives you move the application with one click. The application date is stamped the first time you mark it and never moves; the decision date is stamped when the outcome changes; the CV and the note stay editable. A later Gmail discovery of the same posting never touches the application record.
- **Application stats** (`/stats`): per-CV performance (applications, waiting, interview, offer, rejected, response rate, positive rate) plus the same breakdown by inferred experience level and by source — the answer to "which CV works for which kind of job". CV names are snapshotted on the record, so statistics survive deleting a CV.
- **Period tracking** (`/trends`): the current 7/30/90-day window against the previous window of the same length — postings discovered, applications sent, positive answers (interview + offer), rejections, plus apply / response / positive rates — and an eight-week breakdown. Counts come from the dates on the records themselves (`firstSeenAt`, `appliedAt`, `decidedAt`); a percentage change is shown only when the previous window is non-zero.
- **My CVs** (`/cvs`): upload up to 10 fixed CVs (PDF or DOCX, max 4 MB each), give each a label, mark one as default, download or delete. Files live only in your Firestore account and are streamed by the server after session verification; the upcoming application assistant will pick the CV from here.
- A small JSON API (`/api/login`, `/api/logout`, `/api/jobs`, `/api/cvs`, `/api/cvs/{id}`) with the same session checks, used by the end-to-end verification script.

**Experience level (inferred, never claimed as the site's field)**

- The alert e-mails' job cards carry only a title and sometimes a "Company · Location" line — **no seniority field**. Reading the site's own "Experience level" would require opening the job page, which this project deliberately does not do.
- So the level is *derived* from the title (and, when you paste one yourself, the description) by a rule-based classifier in `src/discovery/experience.ts`: `intern`, `entry`, `junior`, `associate`, `mid`, `senior`, `lead`, `manager`. Turkish suffixes are handled ("Stajyeri", "Uzmanı", "Müdürü"), compound titles resolve to the more specific level ("Müdür Yardımcısı" → manager, "Uzman Yardımcısı" → associate, "Senior Manager" → manager), and both Turkish and invariant lower-casing are tried so that "Intern" does not become "ıntern".
- Titles with no level wording stay **unclassified** — nothing is guessed. Every level shown in the UI and in Telegram is labelled "(tahmin)" / inferred, with the matched phrase available as a tooltip.
- The level is **not stored**; it is recomputed on every read, so improving the rules instantly reclassifies existing postings. `extractExperienceYears` additionally reads "3+ yıl deneyim" / "3 years of experience" style phrases from a description when one exists.

**Notifications (Telegram)**

- After every discovery run the CLI sends a Telegram message listing the postings that were **first seen in that run** (source, title when known, link). Nothing is sent when there is nothing new; Gmail/store failures produce a short warning instead of silence. Messages are HTML-escaped and split to respect Telegram's 4096-character limit.
- Optional: without `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` the run report just says `not_configured`. The web app shows the notification outcome of the last run.

**Automation**

- A Windows Task Scheduler task runs discovery twice a day on your machine (see [Scheduling](#scheduling-windows-task-scheduler)).

---

## Architecture

```text
 LinkedIn / Kariyer.net / Indeed job-alert e-mails
                    │
                    ▼
     Gmail (label "Is-Alarmi", read-only OAuth)
                    │  src/gmail/client.ts
                    ▼
   MIME normalisation → link extraction → URL validation
                    │  src/discovery/parser.ts
                    ▼
        JobPosting contract (source + sourceJobId key)
                    │  src/discovery/service.ts
                    ▼
   JobRepository ── FirestoreJobRepository ──► Cloud Firestore ◄── Next.js web app (Vercel)
                └── JsonFileJobRepository ──► data/jobs.json         web/ (Admin SDK, session cookies)
                    │
                    ▼
              run report (stdout + users/{uid}/discoveryRuns)
```

The shared Firestore document logic (`src/storage/job-posting-documents.ts`, `src/storage/job-posting-store.ts`) is written against a small structural interface instead of `firebase-admin`, so the CLI and the web app use **one implementation** of the merge rule while each keeps its own `firebase-admin` instance.

---

## Repository layout

```text
.
├── src/                         # CLI core (Node 22+, TypeScript, ESM)
│   ├── cli.ts                   # npm run discover
│   ├── fixture-cli.ts           # npm run discover:fixtures (no Gmail access)
│   ├── config.ts                # environment → AppConfig (store selection)
│   ├── domain.ts                # JobPosting / StoredJobPosting / run report contracts
│   ├── discovery/parser.ts      # link extraction, validateJobUrl, parseJobAlertEmail
│   ├── discovery/service.ts     # runDiscovery + run report
│   ├── gmail/                   # read-only Gmail client, OAuth helper (npm run oauth:setup)
│   ├── firebase/admin.ts        # firebase-admin bootstrap for the CLI
│   └── storage/
│       ├── repository.ts        # JobRepository interface
│       ├── json-file-repository.ts
│       ├── memory-repository.ts
│       ├── job-posting-documents.ts   # pure document logic (ids, merge rule, parsing)
│       └── job-posting-store.ts       # structural store interface + FirestoreJobRepository
├── tests/                       # node:test suites for the core (fixtures contain no personal data)
├── web/                         # Next.js 16 app (App Router, TypeScript)
│   ├── app/                     # pages, server actions, /api routes, proxy.ts
│   ├── components/
│   ├── lib/auth/                # Identity Toolkit sign-in, session cookies
│   ├── lib/firebase/            # firebase-admin bootstrap for the web app
│   ├── lib/jobs/                # manual link preparation, list query, repository wrappers
│   ├── lib/core.ts              # re-exports the shared core from ../src
│   ├── scripts/verify-firebase.ts
│   └── tests/
├── scripts/                     # Windows scheduler runner + registration script
├── firestore.rules              # deny-all client rules
├── firestore.indexes.json
└── firebase.json
```

---

## Data model

### `JobPosting` (discovery contract, `src/domain.ts`)

```ts
interface JobPosting {
  source: "linkedin" | "kariyer" | "indeed";
  sourceJobId: string;
  url: string;                    // canonical, validated HTTPS URL
  title: string | null;
  titleStatus: "present" | "missing";
  company: string | null;         // from the e-mail card when present ("Company · Location")
  location: string | null;
  descriptionStatus: "missing";
  firstSeenAt: string;            // ISO-8601
  sourceEmailId: string;          // Gmail message id that first surfaced the posting
}
```

### Firestore layout

```text
users/{uid}/jobPostings/{source}__{sourceJobId}
users/{uid}/discoveryRuns/{startedAt}
users/{uid}/cvs/{cvId}                  # CV metadata
users/{uid}/cvs/{cvId}/chunks/{index}   # file bytes in 700 KB chunks
```

Posting document fields: `ownerId`, `source`, `sourceJobId`, `url`, `title`, `company`, `location`, `description`, `application` (`{ status, appliedAt, decidedAt, cvId, cvName, notes, updatedAt }` or absent) (each optional field is `null` when unknown), `firstSeenAt`, `acquisitionMethod` (`"manual"` | `"gmail"`), `sourceEmailId` (`null` for manual entries — a fake Gmail id is never written), `createdAt`, `updatedAt`. Time fields are ISO-8601 strings, so lexicographic order equals chronological order and no Firestore `Timestamp` objects cross module boundaries.

The document id is the uniqueness key (owner + source + source job id).

CV files are stored in Firestore instead of Cloud Storage because Cloud Storage for Firebase requires the Blaze (billing) plan on new projects. Each file is split into 700 KB chunks (Firestore's document limit is 1 MiB), written atomically with its metadata (name, file name, kind, size, SHA-256, chunk count, default flag) and verified against the hash when read back. Type detection uses the extension **and** magic bytes (`%PDF-` / ZIP header for `.docx`).

### Merge rule (identical for CLI and web)

When a posting already exists:

1. If the incoming sighting is **older**, `firstSeenAt`, `acquisitionMethod` and `sourceEmailId` are moved back to it (the earliest sighting wins).
2. Missing `title` / `company` / `location` / `description` are filled in; existing values are **never** overwritten.
3. Otherwise the write is reported as `unchanged`.

Outcomes: `inserted` | `updated` | `unchanged`. This is the same behaviour the local JSON repository has had since phase 1 and it is covered by unit tests with an in-memory store.

---

## Security model

- **Firestore rules deny all client access** (`allow read, write: if false`). Data is reached only through the app server or the CLI, both using the Firebase Admin SDK with a service account. Anonymous requests and even the owner's own ID token get `403` when they call Firestore directly.
- **Ownership is path-based**: the `uid` always comes from a verified session cookie (web) or from `JOB_OWNER_EMAIL` resolved via Firebase Auth (CLI) — never from request data.
- **Sessions**: the login form posts email + password to a server action; the server calls the Identity Toolkit REST API, then creates a Firebase **session cookie** (`HttpOnly`, `Secure` in production, `SameSite=Lax`, 5 days). Every page, server action and API route verifies it with `verifySessionCookie(cookie, checkRevoked = true)`. `proxy.ts` only redirects requests that carry no cookie at all; it is not an authorisation boundary. Logout revokes the user's refresh tokens and clears the cookie.
- **Nothing Firebase-related reaches the browser**: no client SDK, no API key. The only secrets are server-side environment variables (Vercel encrypted env / local `.env.local`), all git-ignored.
- **Sign-up is disabled** in Firebase Authentication; the one account is created from the Firebase console.
- **Gmail** access is read-only, restricted to one label; full e-mail bodies are never persisted — only posting fields and the Gmail message id.
- `.gitignore` covers `.env*`, `data/`, `private/`, service-account keys, `.next/`, `.vercel/`, `.eml/.mbox`, PDFs and Word documents (CVs).

---

## Requirements

- Node.js **22+** (tested on 24)
- A Firebase project (Spark/free plan is enough): Authentication (Email/Password) and Cloud Firestore
- A Google Cloud OAuth "Desktop app" client for the Gmail API (the Firebase project *is* a Google Cloud project — reuse it)
- A Gmail account that receives your job alerts
- A Vercel account connected to GitHub (for the web app)

---

## Setup

### 1. Firebase project

1. Create a Firebase project (Analytics optional).
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Authentication → Users → Add user** — create your own account (this is the only account that will ever log in).
4. **Authentication → Settings → User actions → uncheck "Enable create (sign-up)"** so nobody else can register through the public API key.
5. **Firestore Database → Create database** — Standard edition, database id `(default)`, a European location (e.g. `europe-west3`), *production mode*.
6. Deploy the rules from this repository (they deny all client access):

   ```powershell
   npx firebase-tools login
   npx firebase-tools deploy --only firestore --project <your-project-id>
   ```

   (If the CLI login does not work in your browser, the rules can also be pasted into the console's *Rules* tab, or published through the Firebase Rules REST API with the service account.)
7. **Project settings → Service accounts → Generate new private key.** Keep the downloaded JSON outside git (for example under `private/`). You need three values from it: `project_id`, `client_email`, `private_key`.
8. The **Web API key** is under *Project settings → General* (a web app must exist; create one if the list is empty). It is used only server-side to forward the password to Identity Toolkit.

### 2. Local environment files

Root `.env.local` (used by the CLI):

```dotenv
# Gmail OAuth desktop client (Google Cloud Console)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://127.0.0.1:53682/oauth2/callback
GMAIL_REFRESH_TOKEN=            # written by npm run oauth:setup
GMAIL_JOB_LABEL=Is-Alarmi
GMAIL_MAX_MESSAGES=100

# Store: json (data/jobs.json) or firestore (shared with the web app)
JOB_STORE=firestore
JOB_OWNER_EMAIL=you@example.com # the account that logs into the web app

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=           # PEM; "\n" escapes are accepted

# Optional Telegram notifications
TELEGRAM_BOT_TOKEN=             # from @BotFather
TELEGRAM_CHAT_ID=               # written by npm run telegram:setup
APP_URL=https://job-discovery-tr.vercel.app   # appended to notifications
```

`web/.env.local` (used by the web app; the same values also go to Vercel):

```dotenv
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_WEB_API_KEY=
```

Both files are git-ignored. `.env.example` files document every variable.

### 3. Gmail: alerts, label, OAuth

1. Create job alerts on LinkedIn, Kariyer.net and Indeed (daily e-mail digests) for the searches you care about.
2. In Gmail, create a filter `from:(linkedin.com OR kariyer.net OR indeed.com)` → *Apply label* → `Is-Alarmi` (or whatever you set in `GMAIL_JOB_LABEL`).
3. In Google Cloud Console (same project as Firebase):
   - enable the **Gmail API**;
   - configure the **OAuth consent screen** (External, testing mode) and add your Gmail address as a **test user**;
   - create an OAuth client of type **Desktop app** and copy its client id/secret into the root `.env.local`.
4. Authorise once:

   ```powershell
   npm install
   npm run oauth:setup
   ```

   The helper starts a loopback server on `127.0.0.1:53682`, prints an authorisation URL, and after consent writes the refresh token straight into `.env.local` (it is never printed). Only the read-only Gmail scope is requested; your Gmail password is never asked for.

   Revoke access at any time from *Google Account → Security → Third-party access*.

### 4. Telegram notifications (optional)

1. In Telegram, open **@BotFather** → `/newbot` → choose a name and a username ending in `bot` → copy the token into the root `.env.local` as `TELEGRAM_BOT_TOKEN`.
2. Open your new bot in Telegram and send it any message (this creates the private chat).
3. Run:

   ```powershell
   npm run telegram:setup
   ```

   The helper reads the bot's updates, stores your private chat id as `TELEGRAM_CHAT_ID` in `.env.local` and sends a confirmation message. From then on every discovery run notifies you about new postings.

### 5. Vercel

1. Import the GitHub repository as a new project.
2. **Root Directory: `web`**, framework Next.js. Keep *"Include source files outside of the Root Directory"* enabled — the web app imports the shared core from `../src`.
3. Add the four environment variables from `web/.env.local` (Production + Preview).
4. Deploy. Every push to `master` redeploys.

---

## Running

Core (repository root):

```powershell
npm install
npm test                 # node:test suites
npm run typecheck
npm run build            # tsc → dist/ (imports are rewritten from .ts to .js)
npm run discover         # live Gmail → configured store, prints the run report
npm run discover:fixtures  # parses the bundled fixture e-mails into memory (no Gmail access)
npm run oauth:setup      # one-time Gmail authorisation
npm run telegram:setup   # one-time Telegram chat id discovery + test message
```

Web app:

```powershell
cd web
npm install
npm test
npm run typecheck
npm run build
npm run dev              # http://localhost:3000
```

Exit code of `npm run discover` is `1` when any source or repository error occurred; zero postings is **not** an error.

---

## Scheduling (Windows Task Scheduler)

`scripts/register-discovery-task.ps1` registers a task named **JobDiscovery** that runs `scripts/run-discovery.cmd` every day at **09:00 and 18:00** (runs at next start-up if a slot was missed, only when a network is available). Output is appended to `data/discover.log`.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-discovery-task.ps1
Start-ScheduledTask -TaskName JobDiscovery          # run once now
Unregister-ScheduledTask -TaskName JobDiscovery     # remove
```

---

## Verification and tests

**Unit tests**

- Root: URL validation and canonicalisation, HTML title extraction, experience-level classification (Turkish suffixes, compound titles, no false positives) and years extraction, fixture parsing, JSON repository first-seen semantics, run-report accounting, Firestore store semantics via an in-memory store (merge rule, ownership paths, run summaries, malformed-document handling), CV chunking/integrity/default handling and upload validation, Telegram message formatting/splitting and Bot API calls against a fake `fetch`, application state transitions (application date pinned, decision date re-stamped only on change, `none` clears the record), the statistics aggregation and the period comparison (non-overlapping windows, weekly buckets, no division by zero).
- Web: manual-link preparation, list query parsing/filtering, a guard that `firestore.rules` still denies everything.

**End-to-end against the deployed app** (`web/scripts/verify-firebase.ts`):

```powershell
cd web
npm run verify:firebase -- --base-url https://<your-app>.vercel.app
```

It asks for your e-mail and (hidden) password locally, then checks: unauthenticated `/` redirects to `/login` and `/api/jobs` returns 401; login yields an `HttpOnly` session cookie; a TEST posting is inserted, is visible when the page is fetched again, re-adding returns `unchanged`, deleting removes it; a tiny TEST PDF is uploaded as a CV, listed, downloaded back with a matching SHA-256, refused to anonymous requests (401) and deleted; after logout the old cookie is rejected; direct Firestore REST calls (anonymous and with the user's own ID token) return 403. Only status codes and booleans are printed.

---

## Operational notes

- **Unresolved e-mails** in the run report are messages under the label that contained no valid posting link (e.g. LinkedIn's "companies hiring near you" digests). They are counted, not guessed at. If real alert e-mails stop parsing, LinkedIn/Kariyer.net/Indeed probably changed their template: add an anonymised fixture and adjust `src/discovery/parser.ts`.
- `firebase-admin` is pinned to **13.x** in both packages: 14.x pulls the ESM-only `jose@6`, which the Vercel serverless runtime cannot `require()`.
- The web app's `firebase-admin` Firestore client uses `preferRest: true` for faster cold starts.
- Rotating the service-account key: generate a new key in Firebase, update both `.env.local` files and the Vercel environment, then delete the old key in Google Cloud IAM.
- Firebase CLI login is optional; everything in this repository was provisioned with the service account and Google REST APIs.

---

## Limitations and roadmap

Deliberately **not** implemented in this version:

- Fetching job descriptions from the sites, scraping or automated browsing
- AI scoring / CV matching
- Submitting applications, form filling, application tracking
- Merging similar postings across sites
- Cloud-hosted scheduling (discovery runs on your own machine)

Planned next (human-in-the-loop "assisted apply" track):

1. Per-posting match score with reasons, computed from the stored CVs
3. A saved answer bank for recurring application questions
4. A local browser assistant that pre-fills applications and stops at the review step — you press *Submit*

---

## License

Private project; no license granted.
