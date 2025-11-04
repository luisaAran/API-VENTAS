import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { UserRepository } from '../repositories/user.repository';

export class UsersService {
  constructor(private userRepository: UserRepository) {}
  async createUser(payload: { name: string; email: string; password: string }) {
    const { name, email, password } = payload;

    const existing = await this.userRepository.findByEmail(email);
    if (existing) throw new ConflictError('Email already used');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.userRepository.createUser({
      name,
      email,
      password: hashed,
    });

    // omit password in return
    const { id, balance, emailVerified, role } = user;
    return { id, name, email, balance, emailVerified, role };
  }

  async listUsers() {
    return await this.userRepository.findAll();
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  /**
   * Find user by email for authentication (includes password, bypasses cache)
   * This method should ONLY be used for login/authentication purposes
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return await this.userRepository.findByEmailWithPassword(email);
  }

  async findById(id: number): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async findByIdWithOrders(id: number) {
    const user = await this.userRepository.findByIdWithOrders(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }
  async updateEmailVerification(email: string, verified: boolean): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundError('User');
    
    user.emailVerified = verified;
    await this.userRepository.saveUser(user);
  }

  /**
   * Validate if user has sufficient balance for a purchase
   * @returns true if balance is sufficient, false otherwise
   */
  async hasBalance(userId: number, amount: number): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    return user.balance >= amount;
  }
  /**
   * Deduct balance from user account
   * Use this for purchases, refunds, etc.
   * @throws NotFoundError if user not found
   * @throws ValidationError if insufficient balance
   */
  async deductBalance(userId: number, amount: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    if (user.balance < amount) {
      throw new ValidationError(
        `Insufficient balance. Required: $${amount}, Available: $${user.balance}`
      );
    }
    
    user.balance -= amount;
    return await this.userRepository.saveUser(user);
  }

  /**
   * Add balance to user account
   * Use this for refunds, deposits, etc.
   */
  async addBalance(userId: number, amount: number): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    user.balance += amount;
    return await this.userRepository.saveUser(user);
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: number,
    preferences: { notifyBalanceUpdates: boolean }
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    user.notifyBalanceUpdates = preferences.notifyBalanceUpdates;
    return await this.userRepository.saveUser(user);
  }

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(userId: number): Promise<{ notifyBalanceUpdates: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    
    return {
      notifyBalanceUpdates: user.notifyBalanceUpdates,
    };
  }
}
