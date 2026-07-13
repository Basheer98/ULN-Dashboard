# Deployment & app store publishing guide

Complete checklist for GitHub → Railway (web API) → App Store & Play Store (mobile).

---

## Part 1 — Push code to GitHub

### 1.1 Create the repository

1. Go to [github.com/new](https://github.com/new)
2. Name: `uln-dashboard` (or your choice)
3. **Private** recommended (operations + billing data patterns)
4. Do **not** add README, .gitignore, or license (this repo already has them)

### 1.2 Push from your machine

```bash
cd "/Users/phantom/Desktop/ULN Dashboard"

git init
git add .
git commit -m "Initial commit: ULN dashboard, mobile app, and deployment config"

git branch -M main
git remote add origin https://github.com/YOUR_ORG/uln-dashboard.git
git push -u origin main
```

**Never commit:** `.env`, service account JSON files, `apps/web/uploads/`, or Play Store keys.

---

## Part 2 — Deploy web API on Railway

### 2.1 Create Railway project

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → select `uln-dashboard`
3. Railway detects `railway.json` / `nixpacks.toml` automatically

### 2.2 Add PostgreSQL

1. In the project → **+ New** → **Database** → **PostgreSQL**
2. Copy the `DATABASE_URL` from the Postgres service variables

### 2.3 Configure web service variables

On the **web service** (not Postgres), set:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Reference from Postgres service `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Yes | `openssl rand -base64 32` |
| `SESSION_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://YOUR-APP.up.railway.app` (after first deploy) |
| `NODE_ENV` | Yes | `production` |
| `STORAGE_PROVIDER` | Yes | `google_drive` for production receipts |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes* | From your GCP service account |
| `GOOGLE_PRIVATE_KEY` | Yes* | Full key with `\n` for newlines |
| `GOOGLE_DRIVE_RECEIPTS_FOLDER_ID` | Yes* | Shared Drive folder ID |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional | Project tracker sync |
| `GOOGLE_SHEETS_TAB_NAME` | Optional | e.g. `Sheet1` |
| `RESEND_API_KEY` | Optional | Email notifications |
| `EMAIL_FROM` | Optional | |
| `OFFICE_NOTIFICATION_EMAIL` | Optional | |
| `SENTRY_DSN` | Optional | Error monitoring |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | |

\* Use inline env vars on Railway — **do not** upload JSON files to the repo.

**Google Drive on Railway:** Use a **Shared Drive** (Google Workspace). Add the service account as **Content manager**. Regular My Drive folders will fail for service accounts.

### 2.4 Deploy & verify

1. Deploy triggers on push to `main`
2. `preDeployCommand` runs Prisma migrations automatically
3. Open `https://YOUR-APP.up.railway.app/api/health` → should return `{"status":"ok",...}`
4. Run seed **once** (Railway shell or locally against prod URL):

   ```bash
   DATABASE_URL="your-railway-url" npm run db:seed
   ```

5. Log in at `/login` and **change default passwords immediately**

### 2.5 Custom domain (recommended)

Railway → Settings → Networking → add `dashboard.urbanlinknetworks.com` (or your domain). Update `NEXT_PUBLIC_APP_URL` to match.

---

## Part 3 — Mobile app store preparation

### 3.1 Replace placeholder icons (required before store submit)

Current `apps/mobile/assets/*.png` files are tiny placeholders. Replace with:

| Asset | Size | File |
|-------|------|------|
| App icon | 1024×1024 | `icon.png` |
| Adaptive icon | 1024×1024 | `adaptive-icon.png` |
| Splash | 1284×2778 or similar | `splash-icon.png` |

Use your ULN branding (dark background `#09090b`, teal accent `#2dd4bf`).

### 3.2 Privacy policy (required both stores)

Host a privacy policy URL covering:

- Account data (email, name, role)
- Location not collected (unless you add it later)
- Camera / photos (receipt uploads)
- Push notifications (job assignments)
- Data stored on your Railway server
- Contact email for data requests

Example hosting: `https://urbanlinknetworks.com/privacy` or a Notion/Google Doc public page.

Add the URL later in App Store Connect and Play Console.

### 3.3 Update production API URL

After Railway deploy, edit `apps/mobile/eas.json`:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://YOUR-APP.up.railway.app/api/v1"
  }
}
```

Or set `EXPO_PUBLIC_API_URL` in [expo.dev](https://expo.dev) → your project → **Environment variables** (recommended).

---

## Part 4 — Expo Application Services (EAS)

EAS builds your iOS `.ipa` and Android `.aab` in the cloud (no Mac required for Android; Mac build machines used for iOS).

### 4.1 One-time setup

```bash
npm install -g eas-cli
eas login                    # free Expo account
cd apps/mobile
eas init                     # links to expo.dev, sets EAS_PROJECT_ID
```

`eas init` writes `EAS_PROJECT_ID` into your Expo project — commit `app.config.ts` changes if prompted.

### 4.2 Preview build (test before store)

```bash
cd apps/mobile
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Install on devices via QR link from expo.dev. Verify login, jobs, receipt upload against **production Railway API**.

### 4.3 Production builds

```bash
npm run mobile:build:ios
npm run mobile:build:android
```

Or from `apps/mobile`:

```bash
eas build --platform all --profile production
```

---

## Part 5 — Apple App Store (iOS)

**Cost:** Apple Developer Program — **$99/year**  
**Timeline:** First review often 1–3 days; plan 1–2 weeks for setup

### 5.1 Enroll

1. [developer.apple.com/programs](https://developer.apple.com/programs/) → enroll as **Organization** (Urban Link Networks) or Individual
2. Complete D-U-N-S number verification if Organization (can take days)
3. Note your **Team ID** (10 characters) — put in `apps/mobile/eas.json` → `submit.production.ios.appleTeamId`

### 5.2 Register bundle ID

1. [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)
2. **+** → App IDs → `com.urbanlinknetworks.field` (must match `app.config.ts`)

### 5.3 App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → New App
2. Platform: iOS  
   Name: **ULN Field**  
   Bundle ID: `com.urbanlinknetworks.field`  
   SKU: `uln-field-001`
3. Fill **App Privacy** questionnaire (data linked to user: email, photos for receipts)
4. Add **Privacy Policy URL**
5. Prepare screenshots (required sizes):
   - iPhone 6.7": 1290×2796 (at least 3 screenshots)
   - iPhone 6.5": 1284×2778
   - iPad if supporting tablet

### 5.4 Certificates & submit (EAS handles most)

First iOS build prompts for Apple credentials — choose **Let EAS handle credentials**.

Submit to App Store:

```bash
cd apps/mobile
eas submit --platform ios --profile production
```

Or upload the `.ipa` manually in Transporter app.

### 5.5 App Review tips

- Provide **demo login** in App Review notes (fielder account, not admin)
- Explain: internal workforce app for field technicians
- If login is required, say "no public signup — accounts created by employer"
- `ITSAppUsesNonExemptEncryption: false` is already set (standard HTTPS only)

---

## Part 6 — Google Play Store (Android)

**Cost:** **$25 one-time** registration  
**Timeline:** First app review often hours to a few days

### 6.1 Create developer account

1. [play.google.com/console](https://play.google.com/console) → create account
2. Complete identity verification and $25 payment

### 6.2 Create app

1. **Create app** → name: **ULN Field**
2. Package: `com.urbanlinknetworks.field` (must match `app.config.ts`)
3. App category: **Business** or **Productivity**
4. Declare **app access** — all features require login → provide test credentials

### 6.3 Store listing

- Short description (80 chars)
- Full description
- App icon 512×512
- Feature graphic 1024×500
- Phone screenshots (min 2)
- Privacy policy URL (required)

### 6.4 Data safety form

Declare collection of:

- Email (account)
- Photos (receipts)
- Device identifiers (push tokens)

Data encrypted in transit (HTTPS). Not sold to third parties.

### 6.5 Build & submit

EAS creates the signing keystore automatically on first Android build.

```bash
cd apps/mobile
eas submit --platform android --profile production
```

For automated submit, create a Play Console **service account** with release permissions and add JSON path to EAS secrets (advanced — or upload `.aab` manually in Play Console → **Testing → Internal testing** first).

**Recommended path:** Internal testing track → invite your team → fix issues → Production.

---

## Part 7 — Recommended launch order

```
1. GitHub push
2. Railway deploy + seed + change passwords
3. Verify web dashboard on production URL
4. Replace mobile app icons
5. eas init + preview builds → test on real phones
6. Purchase Apple Developer + Play Console accounts
7. Production EAS builds
8. Internal / TestFlight testing (iOS) + Internal testing (Android)
9. Store listings + privacy policy
10. Submit for review
```

---

## Part 8 — Ongoing operations

| Task | How |
|------|-----|
| Deploy web changes | Push to `main` → Railway auto-deploys |
| Database migration | Included in `preDeployCommand` on deploy |
| Mobile update | Bump `version` in `app.config.ts` → `eas build` → `eas submit` |
| API URL change | Update EAS env vars + rebuild mobile |
| Secrets rotation | Railway variables + rebuild; never in git |

---

## Checklist summary

### GitHub & Railway
- [ ] Repo created (private)
- [ ] Code pushed to `main`
- [ ] Railway project + Postgres linked
- [ ] All env vars set
- [ ] `/api/health` returns OK
- [ ] Seed run, default passwords changed
- [ ] Google Drive receipts working

### Mobile — before stores
- [ ] Real app icons (1024×1024)
- [ ] `EXPO_PUBLIC_API_URL` points to Railway
- [ ] Preview build tested on iOS + Android
- [ ] Privacy policy URL live

### Apple
- [ ] Developer account ($99/yr)
- [ ] Bundle ID registered
- [ ] App Store Connect app created
- [ ] Screenshots + metadata
- [ ] TestFlight tested
- [ ] Submitted for review

### Google Play
- [ ] Developer account ($25)
- [ ] Store listing complete
- [ ] Data safety form done
- [ ] Internal testing passed
- [ ] Production release submitted

---

## Support contacts

- **Railway:** [docs.railway.app](https://docs.railway.app)
- **Expo EAS:** [docs.expo.dev/eas](https://docs.expo.dev/eas)
- **Apple:** [developer.apple.com/support](https://developer.apple.com/support)
- **Google Play:** [support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)
