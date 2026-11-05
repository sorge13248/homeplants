import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RoomPlant } from './room-plant.entity';

@Entity({ name: 'watering_logs' })
@Index(['userId'])
@Index(['roomPlantId'])
export class WateringLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  roomPlantId!: string;

  @ManyToOne(() => RoomPlant, (rp) => rp.wateringLogs, { onDelete: 'CASCADE' })
  roomPlant!: RoomPlant;

  @Column({ type: 'datetime' })
  wateredAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', default: 'web' })
  source!: 'web' | 'email-quick-action' | 'bulk-room';

  @CreateDateColumn()
  createdAt!: Date;
}

