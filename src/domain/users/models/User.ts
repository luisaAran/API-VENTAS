import { Entity, PrimaryGeneratedColumn, Column, OneToMany, DeleteDateColumn } from 'typeorm';
import { Order } from '../../orders/models/Order';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  balance!: number;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role!: 'user' | 'admin';

  // Only store whether email is verified in the user model. Other tokens/codes
  // and refresh tokens are managed in the auth domain (in-memory or external store).
  @Column({ default: false })
  emailVerified!: boolean;

  // Notification preferences
  @Column({ default: true })
  notifyBalanceUpdates!: boolean;

  // Soft delete fields
  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  @Column({ default: false })
  isDeleted!: boolean;

  // Remove CASCADE delete - orders should remain for historical purposes
  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];
}
