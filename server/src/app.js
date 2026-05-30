import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import { notFound, errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import donorsRouter from './routes/donors.js';
import slipsRouter from './routes/slips.js';
import handoversRouter from './routes/handovers.js';
import settingsRouter from './routes/settings.js';
import importRouter from './routes/import.js';
import auditRouter from './routes/audit.js';
import schemesRouter from './routes/schemes.js';
import uploadsRouter from './routes/uploads.js';
import formTemplatesRouter from './routes/formTemplates.js';
import registrationsRouter from './routes/registrations.js';
import documentsRouter from './routes/documents.js';
import expensesRouter from './routes/expenses.js';
import budgetsRouter from './routes/budgets.js';
import donorMergeRouter from './routes/donorMerge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // --- Security & parsing ---
  // CSP tuned for this app: allow Cloudinary images, Google Fonts, same-origin assets.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'https://api.cloudinary.com'],
          formAction: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(mongoSanitize());

  // --- CORS allowlist (incl. Capacitor origins) ---
  const allowlist = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowlist.includes('*') || allowlist.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // --- Rate limiters ---
  const isDev = process.env.NODE_ENV !== 'production';
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 3000 : 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please try again later.' },
  });
  const publicDonationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 6000 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
  });

  // --- API Routes ---
  app.use('/health', healthRouter);
  app.use('/api/auth', authLimiter, authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/schemes', schemesRouter);
  app.use('/api/donors', donorsRouter);
  app.use('/api/slips', slipsRouter);
  app.use('/api/handovers', handoversRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/form-templates', formTemplatesRouter);
  app.use('/api/registrations', registrationsRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/donor-merge', donorMergeRouter);

  app.locals.publicDonationLimiter = publicDonationLimiter;

  // Unhandled API routes return JSON 404 (before the SPA catch-all).
  app.use('/api', notFound);

  // --- Static client (production) ---
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    // SPA fallback: anything not starting with /api or /health returns index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.use(notFound);
  }

  app.use(errorHandler);

  return app;
}
