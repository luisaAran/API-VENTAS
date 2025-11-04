import { UsersRoutes } from './routes/users.routes';
import { UsersService } from './services/users.service';
import { UserRepository } from './repositories/user.repository';
import { ProductsModule } from '../products';
import type { AuthService } from '../auth/services/auth.service';

const userRepository = new UserRepository();
const service = new UsersService(userRepository);

// We'll initialize routes later after AuthService is available
let usersRoutes: UsersRoutes;

export function setAuthService(authService: AuthService) {
  usersRoutes = new UsersRoutes(service, ProductsModule.service, authService);
}

export const UsersModule = {
  get router() {
    if (!usersRoutes) {
      throw new Error('UsersModule not initialized. Call setAuthService first.');
    }
    return usersRoutes.router;
  },
  service,
  repository: userRepository,
};
