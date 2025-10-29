import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from './domain/users/models/User';
import { Product } from './domain/products/models/Product';
import { Order } from './domain/orders/models/Order';
import { OrderItem } from './domain/orders/models/OrderItem';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ventas_db',
  synchronize: true,
  logging: false,
  entities: [User, Product, Order, OrderItem],
  migrations: [],
  subscribers: [],
});

export default AppDataSource;
