import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { ProductsService } from '../../products/services/products.service';
import { AuthService } from '../../auth/services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { requireAuth } from '../../../shared/middlewares/auth';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { addBalanceSchema, updateUserSchema, deleteUserSchema } from '../validations/users.validations';

export class UsersRoutes {
  public readonly router: Router;
  private controller: UsersController;

  constructor(service: UsersService, productsService: ProductsService, authService: AuthService) {
    this.router = Router();
    this.controller = new UsersController(service, productsService, authService);
    this.initializeRoutes();
  }
  private initializeRoutes() {
    // Get current user profile with orders - both users and admins
    this.router.get(
      '/me',
      requireAuth(['user', 'admin']),
      asyncHandler(this.controller.getMyProfile.bind(this.controller))
    );
    
    // Update user profile (name, notification preferences, etc.)
    this.router.patch(
      '/me',
      requireAuth(['user', 'admin']),
      asyncHandler(this.controller.updateProfile.bind(this.controller))
    );
    
    // Add balance to user account
    this.router.post(
      '/balance',
      requireAuth(['user', 'admin']),
      validateZod(addBalanceSchema),
      asyncHandler(this.controller.addBalance.bind(this.controller))
    );
    
    // Protected route - only admins can list all users
    this.router.get(
      '/',
      requireAuth(['admin']),
      asyncHandler(this.controller.listUsers.bind(this.controller))
    );

    // Update user (Admin only)
    this.router.put(
      '/:id',
      requireAuth(['admin']),
      validateZod(updateUserSchema),
      asyncHandler(this.controller.updateUser.bind(this.controller))
    );

    // Delete user (Admin only) - CASCADE deletes all orders and order items
    this.router.delete(
      '/:id',
      requireAuth(['admin']),
      validateZod(deleteUserSchema),
      asyncHandler(this.controller.deleteUser.bind(this.controller))
    );
  }
}
