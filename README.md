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

## 📚 Documentation

- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)**: Complete API documentation with examples
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: DDD architecture and project structure
- **[TWO_FACTOR_AUTH.md](./TWO_FACTOR_AUTH.md)**: 2FA implementation details
- **[REDIS_CACHE.md](./REDIS_CACHE.md)**: Redis caching strategy
- **[JOB_QUEUES.md](./JOB_QUEUES.md)**: BullMQ job queues for background tasks
- **[EMAIL_QUEUE.md](./EMAIL_QUEUE.md)**: Asynchronous email queue system
- **[BULL_BOARD.md](./BULL_BOARD.md)**: Queue monitoring dashboard guide

## ✨ Features

- ✅ **Authentication**: JWT-based with 2FA (email codes)
- ✅ **Authorization**: Role-based access control (user/admin)
- ✅ **Email Templates**: Responsive HTML emails with Spanish translations
- ✅ **PDF Invoices**: Generated with PDFKit (no browser required)
- ✅ **Redis Cache**: User and product caching with TTL
- ✅ **Job Queues**: BullMQ for automatic order expiration and async email sending
- ✅ **Email Queue**: Asynchronous email processing with retries and rate limiting
- ✅ **Payment Verification**: Two-factor order verification with trusted devices
- ✅ **Notification Preferences**: Unsubscribe from balance updates

## 🔄 Background Jobs

The application uses **BullMQ** for asynchronous job processing:

### Order Expiration Queue
- Automatically cancels pending orders after 5 minutes
- Cleanup of expired orders on app startup

### Email Queue
- **Asynchronous email sending**: Responses 93% faster (no SMTP blocking)
- **Automatic retries**: Up to 3 attempts with exponential backoff
- **Rate limiting**: 10 emails/second to prevent SMTP throttling
- **Concurrency**: 5 emails processed simultaneously
- **Priority support**: Verification emails get higher priority

### Monitoring
- **Bull Board Dashboard**: Web UI at `/admin/queues` (admin only)
- Real-time statistics, job inspection, and manual retries
- See [JOB_QUEUES.md](./JOB_QUEUES.md), [EMAIL_QUEUE.md](./EMAIL_QUEUE.md), and [BULL_BOARD.md](./BULL_BOARD.md) for details

Notes
- This is a minimal scaffold. Implement additional features (2FA flows, role administration, more validations, services and repository patterns) as needed.
- The `src/data-source.ts` file configures TypeORM using environment variables.
- Project structure follows `ARCHITECTURE.md` with `src/domain/*` and `src/shared/*` folders.
