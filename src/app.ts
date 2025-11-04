import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { AuthModule, setOrdersService } from './domain/auth';
import { UsersModule, setAuthService } from './domain/users';
import { ProductsModule } from './domain/products';
import { OrdersModule } from './domain/orders';
import { errorHandler } from './shared/middlewares/errorHandler';
import { requestLogger, logRequestBody, errorLogger } from './shared/middlewares/logger';

// Inject OrdersService into AuthService to avoid circular dependency
setOrdersService(OrdersModule.service);

// Inject AuthService into UsersModule to avoid circular dependency
setAuthService(AuthModule.service);

export const app = express();

// Logging middlewares (MUST be before routes)
app.use(requestLogger); // Log all incoming requests
app.use(bodyParser.json());
app.use(cookieParser());
app.use(logRequestBody); // Log request body (sanitized)

// Routes
app.use('/api/auth', AuthModule.router);
app.use('/api/users', UsersModule.router);
app.use('/api/products', ProductsModule.router);
app.use('/api/orders', OrdersModule.router);
app.get('/', (req, res) => res.json({ ok: true, msg: 'Ventas API' }));

// Error handling middlewares (MUST be after routes)
app.use(errorLogger); // Log errors
app.use(errorHandler); // Handle errors

export default app;
