import { UsersModule } from '../../domain/users';
import logger from '../utils/logger';
import { ConflictError } from '../errors';

// Default admin credentials
const DEFAULT_ADMIN = {
  name: 'Admin',
  email: 'juanp.olavem@autonoma.edu.co',
  password: 'Admin123!',
};

export const createDefaultAdmin = async () => {
  try {
    const usersService = UsersModule.service;
    const existingAdmin = await usersService.findByEmail(DEFAULT_ADMIN.email);
    if (existingAdmin) {
      logger.info('✅ Default admin user already exists');
      return;
    }
    await usersService.createUser({
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    });
    const admin = await usersService.findByEmail(DEFAULT_ADMIN.email);
    if (admin) {
      admin.emailVerified = true;
      admin.role = 'admin';
      await UsersModule.repository.saveUser(admin);
    }
    logger.info('🔐 Default admin user created successfully!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('📧 Admin Email:    ' + DEFAULT_ADMIN.email);
    logger.info('🔑 Admin Password: ' + DEFAULT_ADMIN.password);
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
