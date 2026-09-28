# ER Guard Mobile App

Expo React Native app for ER Guard by Medicare Plus.

## Structure

- `mobile/` — Expo Router app (TypeScript)
- `stitch_er_guard_mobile_splash_screen/` — HTML design references and `DESIGN.md` tokens

## Architecture

```
React Native app → Express API (medicareplus-api) → telegram-support-bot → PostgreSQL
```

The app calls `https://api.app.medicareplus.com.ph/api/patient/er-guard/*` and never connects directly to PostgreSQL.

## Setup

### Database (after clearing DB)

Run migrations in order on PostgreSQL:

1. `telegram-support-bot/scripts/pg_migration/schema_core.sql`
2. `telegram-support-bot/scripts/pg_migration/schema_missing_columns.sql`
3. `telegram-support-bot/scripts/pg_migration/schema_er_guard_app.sql`

### Ticketing service

Deploy `telegram-support-bot` with the new `er_guard_app_api` routes at `/api/v1/er-guard-app/*`.

### Express API

Mount `medicareplus-api/api/er_guard.js` (proxies to ticketing).

### Mobile app

```bash
cd mobile
npm install --legacy-peer-deps
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npm start
```

Bundle ID: `com.medicareplus.erguard`  
Deep link scheme: `erguard://checkout`

### Biometric preview testing

Use a native iOS build (not Expo Go) so the Face ID permission in `Info.plist` is included:

```bash
cd mobile
npx expo run:ios --device
```

After onboarding, tap **Preview home (dev)** or **Biometrics** on the sign-in screen. A native build starts with Face ID/Touch ID and can fall back to the device passcode. New password sign-ins and account creation ask whether to enable biometrics; the opt-in session is kept in SecureStore for later sign-in.

## Features (v1)

- Onboarding, email signup with OTP, login, forgot password
- Empty wallet: buy ER Guard / Plus (hosted checkout), link existing card
- Digital card wallet with activation handoff
- Accredited hospital locator
- Emergency calling (911, ER hotline) before login
- Profile, biometrics unlock, account deletion
