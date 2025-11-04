import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();
import { app } from './app';
import { AppDataSource } from './data-source';
import logger from './shared/utils/logger';
import { createDefaultAdmin, getDefaultAdminCredentials } from './shared/config/seedAdmin';

const PORT = process.env.PORT || 3000;

AppDataSource.initialize()
  .then(async () => {
    logger.info('✅ Data Source has been initialized successfully!');
    logger.info(`📊 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    await createDefaultAdmin();
    app.listen(PORT, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`🚀 Server listening on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📝 Logs directory: ./logs/`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const adminCreds = getDefaultAdminCredentials();
      logger.info('');
      logger.info('👤 DEFAULT ADMIN CREDENTIALS:');
      logger.info(`   Email:    ${adminCreds.email}`);
      logger.info(`   Password: ${adminCreds.password}`);
      logger.info('   ⚠️  These must be changed in Production Stage!!');
      logger.info('');
    });
  })
  .catch((err) => {
    logger.error('❌ Error during Data Source initialization:', err);
    process.exit(1);
  });