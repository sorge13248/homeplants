import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'quick_action_tokens' })
@Index(['token'], { unique: true })
@Index(['userId'])
@Index(['roomPlantId'])
export class QuickActionToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  token!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  roomPlantId!: string;

  @Column({ type: 'varchar' })
  action!: 'water' | 'snooze';

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

