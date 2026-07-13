# ULN Dashboard

Operations dashboard and field mobile app for Urban Link Networks.

| App | Stack | Purpose |
|-----|-------|---------|
| **Web** (`apps/web`) | Next.js 15 | Admin, billing, finance, project import |
| **Mobile** (`apps/mobile`) | Expo 54 | Fielders — jobs, receipts, expenses |
| **Database** (`packages/database`) | PostgreSQL + Prisma | Shared data layer |

## Quick start (local)

```bash
npm install
docker compose up -d          # PostgreSQL
cp .env.example .env          # edit DATABASE_URL, secrets
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```

Mobile (separate terminal):

```bash
cd apps/mobile
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your API
npm start
```

Default seed logins are printed by `npm run db:seed`.

## Deploy & publish

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:

- Pushing to GitHub
- Railway production deploy (env vars, migrations, Google Drive)
- iOS App Store via Apple Developer + EAS
- Google Play via Play Console + EAS

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Web dev server |
| `npm run check` | Generate, typecheck, test, build |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed dev data |
| `npm run mobile:build:ios` | EAS production iOS build |
| `npm run mobile:build:android` | EAS production Android build |
