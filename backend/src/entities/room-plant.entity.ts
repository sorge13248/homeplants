import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Room } from './room.entity';
import { Plant } from './plant.entity';
import { WateringLog } from './watering-log.entity';

@Entity({ name: 'room_plants' })
@Index(['userId'])
@Index(['roomId'])
@Index(['plantId'])
export class RoomPlant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  roomId!: string;

  @ManyToOne(() => Room, (room) => room.roomPlants, { onDelete: 'CASCADE' })
  room!: Room;

  @Column({ type: 'varchar' })
  plantId!: string;

  @ManyToOne(() => Plant, (plant) => plant.roomPlants, { onDelete: 'CASCADE' })
  plant!: Plant;

  @Column({ type: 'varchar', nullable: true })
  position!: string | null;

  @Column({ type: 'integer', nullable: true })
  customFrequencyDays!: number | null;

  @Column({ type: 'datetime', nullable: true })
  lastWateredAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextWateringDueAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  snoozedUntil!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => WateringLog, (log) => log.roomPlant, { cascade: true })
  wateringLogs!: WateringLog[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

