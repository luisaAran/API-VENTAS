import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column()
  name!: string;
  @Column({ type: 'text', nullable: true })
  description?: string;
  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  price!: number;
  @Column({ type: 'int', default: 0 })
  stock!: number;
}
