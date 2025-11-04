import { UsersModule } from '../../domain/users';
import logger from '../utils/logger';
import { ConflictError } from '../errors';
const DEFAULT_ADMIN = {
  name: 'Admin',
  email: 'juanp.olavem@autonoma.edu.co',
  password: 'Admin123!',
};
const DEFAULT_ADMIN_2 = {
  name: 'Admin_2',
  email: 'juanpabloolavemunoz2006@outlook.com',
  password: 'Admin123'
}
export const createDefaultAdmin = async () => {
  try {
    await createAdminFromCredentials(DEFAULT_ADMIN_2);
    await createAdminFromCredentials(DEFAULT_ADMIN);
    logger.info('⚠️  IMPORTANT: Change these credentials in production!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    if (error instanceof ConflictError) {
      logger.info('✅ Default admin user already exists');
      return;
    }
    logger.error('❌ Error creating default admin user:', error);
    throw error;
  }
};
export const getDefaultAdminCredentials = () => ({
  email: DEFAULT_ADMIN.email,
  password: DEFAULT_ADMIN.password,
});

/**
 * Creates an admin user with custom credentials
 * @param credentials - Object containing name, email, and password for the new admin
 * @returns Promise<void>
 * @throws Error if admin creation fails
 */
export const createAdminFromCredentials = async (credentials: {
  name: string;
  email: string;
  password: string;
}): Promise<void> => {
  try {
    const usersService = UsersModule.service;
    const existingUser = await usersService.findByEmail(credentials.email);
    if (existingUser) {
      logger.warn(`⚠️  User with email ${credentials.email} already exists`);
      throw new ConflictError('User with this email already exists');
    }
    await usersService.createUser({
      name: credentials.name,
      email: credentials.email,
      password: credentials.password,
    });
    const admin = await usersService.findByEmail(credentials.email);
    if (admin) {
      admin.emailVerified = true;
      admin.role = 'admin';
      await UsersModule.repository.saveUser(admin);
    }
    logger.info('🔐 Admin user created successfully!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`📧 Admin Email: ${credentials.email}`);
    logger.info(`👤 Admin Name:  ${credentials.name}`);
    logger.info('🔑 Admin Password: ' + credentials.password);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    logger.error('❌ Error creating admin user from credentials:', error);
    throw error;
  }
};
