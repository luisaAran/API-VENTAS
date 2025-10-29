import { UsersModule } from '../users';
import { AuthRoutes } from './routes/auth.routes';
import { AuthService } from './services/auth.service';

const service = new AuthService(UsersModule.service);
const authRoutes = new AuthRoutes(service);

export const AuthModule = {
  router: authRoutes.router,
  service,
};
