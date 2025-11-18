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

  /**
   * Update user (Admin only)
   * Can update name, email, balance, and notification preferences
   * Note: Role field is excluded from the update schema for security
   * @param userId - ID of the user to update
   * @param updates - Fields to update (role excluded from validation)
   */
  async updateUser(
    userId: number,
    updates: {
      name?: string;
      email?: string;
      balance?: number;
      notifyBalanceUpdates?: boolean;
    }
  ): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    // If email is being updated, check for conflicts
    if (updates.email && updates.email !== user.email) {
      const existing = await this.userRepository.findByEmail(updates.email);
      if (existing) throw new ConflictError('Email already in use');
    }

    // Update fields if provided
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.balance !== undefined) user.balance = updates.balance;
    if (updates.notifyBalanceUpdates !== undefined) {
      user.notifyBalanceUpdates = updates.notifyBalanceUpdates;
    }

    return await this.userRepository.saveUser(user);
  }

  /**
   * Delete user (Admin only) - Soft Delete
   * Marks user as deleted while preserving order history for compliance
   * User data remains in database but becomes inaccessible for authentication and operations
   * @param userId - ID of the user to delete
   * @param adminId - ID of the admin performing the deletion
   * @throws ValidationError if trying to delete self or another admin
   */
  async deleteUser(userId: number, adminId: number): Promise<void> {
    // Note: We need to query directly without isDeleted filter to check the user's role
    const userRepo = this.userRepository['userRepo'];
    const user = await userRepo.findOne({ where: { id: userId } });
    
    if (!user) throw new NotFoundError('User');

    // Check if already deleted
    if (user.isDeleted) {
      throw new ValidationError('User is already deleted');
    }

    // Prevent admin from deleting themselves
    if (userId === adminId) {
      throw new ValidationError('You cannot delete your own account');
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      throw new ValidationError('Cannot delete another admin account. Demote to user first.');
    }

    // Soft delete: marks user as deleted, preserves data
    await this.userRepository.deleteUser(userId);
  }
}
