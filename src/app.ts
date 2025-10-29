import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { AuthModule } from './domain/auth';
import { UsersModule } from './domain/users';
import { ProductsModule } from './domain/products';
import { errorHandler } from './shared/middlewares/errorHandler';

export const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/api/auth', AuthModule.router);
app.use('/api/users', UsersModule.router);
app.use('/api/products', ProductsModule.router);
app.get('/', (req, res) => res.json({ ok: true, msg: 'Ventas API' }));
// Error handler middleware debe ir al final
app.use(errorHandler);
export default app;
