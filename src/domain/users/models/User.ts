import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
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

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance!: number;

  // Only store whether email is verified in the user model. Other tokens/codes
  // and refresh tokens are managed in the auth domain (in-memory or external store).
  @Column({ default: false })
  emailVerified!: boolean;

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];
}
