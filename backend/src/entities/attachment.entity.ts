import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Plant } from './plant.entity';

@Entity({ name: 'attachments' })
@Index(['userId'])
@Index(['plantId'])
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  plantId!: string | null;

  @ManyToOne(() => Plant, (plant) => plant.attachments, { onDelete: 'CASCADE', nullable: true })
  plant!: Plant | null;

  @Column({ type: 'varchar', nullable: true })
  spaceId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  roomId!: string | null;

  @Column({ type: 'varchar', default: 'photo' })
  kind!: string;

  @Column({ type: 'varchar' })
  fileName!: string;

  @Column({ type: 'varchar', nullable: true })
  originalName!: string | null;

  @Column({ type: 'varchar' })
  mimeType!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({ type: 'integer', default: 0 })
  sortOrder!: number;

  @Column({ type: 'varchar' })
  path!: string;

  @Column({ type: 'varchar', nullable: true })
  previewPath!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

