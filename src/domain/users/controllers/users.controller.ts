import { Request, Response } from 'express';
import { UsersService } from '../services/users.service';
import { ProductsService } from '../../products/services/products.service';
import { AuthService } from '../../auth/services/auth.service';
import { EmailTemplates, ProductSuggestion } from '../../../shared/templates';
import { sendMail } from '../../../shared/utils/mailer';

export class UsersController {
  constructor(
    private usersService: UsersService,
    private productsService: ProductsService,
    private authService: AuthService
  ) {}

  async createUser(req: Request, res: Response) {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const user = await this.usersService.createUser({ name, email, password });
    return res.status(201).json(user);
  }

  async listUsers(req: Request, res: Response) {
    const users = await this.usersService.listUsers();
    return res.json(users);
  }

  async getMyProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const user = await this.usersService.findByIdWithOrders(userId);
    return res.json(user);
  }

  async addBalance(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { amount } = req.body as { amount: number };
    
    const user = await this.usersService.addBalance(userId, amount);
    
    // Only send email if user has notifications enabled
    if (user.notifyBalanceUpdates) {
      // Get suggested products within user's new balance
      const suggestedProducts = await this.productsService.getSuggestedProducts(user.balance);
      
      // Map products to template format (only if there are suggestions)
      const productSuggestions: ProductSuggestion[] | undefined =
        suggestedProducts.length > 0
          ? suggestedProducts.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
            }))
          : undefined;
      
      // Generate unsubscribe token using AuthService
      const unsubscribeToken = this.authService.generateUnsubscribeToken(user.id, user.email);
      const unsubscribeLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/notification-preferences?token=${unsubscribeToken}&notify=false`;
      
      // Send confirmation email with product suggestions
      const html = EmailTemplates.balanceAdded(
        user.name,
        amount.toFixed(2),
        user.balance.toFixed(2),
        unsubscribeLink,
        productSuggestions
      );
      
      await sendMail(
        user.email,
        '💰 Balance Added Successfully',
        html,
        `Your balance has been updated. New balance: $${user.balance.toFixed(2)}`
      );
    }
    
    return res.json({
      message: 'Balance added successfully',
      newBalance: user.balance,
    });
  }

  async updateProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { name, notifyBalanceUpdates } = req.body as { 
      name?: string; 
      notifyBalanceUpdates?: boolean;
    };
    
    // Get user
    const user = await this.usersService.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update fields if provided
    if (name !== undefined) {
      user.name = name;
    }
    if (notifyBalanceUpdates !== undefined) {
      user.notifyBalanceUpdates = notifyBalanceUpdates;
    }
    
    // Save using repository through service
    await this.usersService.updateNotificationPreferences(userId, {
      notifyBalanceUpdates: user.notifyBalanceUpdates,
    });
    
    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        notifyBalanceUpdates: user.notifyBalanceUpdates,
      },
    });
  }
}
