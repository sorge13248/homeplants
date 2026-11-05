import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Space } from './space.entity';
import { RoomPlant } from './room-plant.entity';

@Entity({ name: 'rooms' })
@Index(['userId'])
@Index(['spaceId'])
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  spaceId!: string;

  @ManyToOne(() => Space, (space) => space.rooms, { onDelete: 'CASCADE' })
  space!: Space;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverPhotoUrl!: string | null;

  @OneToMany(() => RoomPlant, (roomPlant) => roomPlant.room, { cascade: true })
  roomPlants!: RoomPlant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

