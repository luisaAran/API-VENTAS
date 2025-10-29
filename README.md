# Ventas - E-commerce API (skeleton)

This repository contains a TypeScript+Express API skeleton following a DDD layout. It uses TypeORM with MySQL and Zod for validation. It includes a minimal authentication layer (JWT) and scaffolding for Users, Products and Orders.

Quick start

1. Copy `.env-example` to `.env` and update values.
2. Install dependencies:

```powershell
npm install
```

3. Start in development:

```powershell
npm run dev
```

Notes
- This is a minimal scaffold. Implement additional features (2FA flows, role administration, more validations, services and repository patterns) as needed.
- The `src/data-source.ts` file configures TypeORM using environment variables.

Project structure follows `ARCHITECTURE.md` with `src/domain/*` and `src/shared/*` folders.
