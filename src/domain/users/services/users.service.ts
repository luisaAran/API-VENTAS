import { AppDataSource } from '../../../data-source';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { ConflictError, NotFoundError } from '../../../shared/errors';

export class UsersService {
  async createUser(payload: { name: string; email: string; password: string }) {
    const { name, email, password } = payload;
    const userRepo = AppDataSource.getRepository(User);
    const existing = await userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictError('Email already used');

    const hashed = await bcrypt.hash(password, 10);
    const user = userRepo.create({ name, email, password: hashed });
    await userRepo.save(user);
    // omit password in return
    const { id, balance, emailVerified } = user;
    return { id, name, email, balance, emailVerified };
  }
  async listUsers() {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({ select: ['id', 'name', 'email', 'balance', 'emailVerified'] });
    return users;
  }
  async findByEmail(email: string): Promise<User | null> {
    const userRepo = AppDataSource.getRepository(User);
    return await userRepo.findOne({ where: { email } });
  }
  async findById(id: number): Promise<User | null> {
    const userRepo = AppDataSource.getRepository(User);
    return await userRepo.findOne({ where: { id } });
  }
  async updateEmailVerification(email: string, verified: boolean): Promise<void> {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundError('User');
    user.emailVerified = verified;
    await userRepo.save(user);
  }
}
