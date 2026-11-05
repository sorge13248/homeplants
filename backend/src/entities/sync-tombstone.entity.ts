import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sync_tombstones' })
@Index(['userId'])
@Index(['entityType', 'entityId'])
export class SyncTombstone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  entityType!: 'space' | 'room' | 'plant' | 'roomPlant' | 'attachment' | 'userSettings';

  @Column({ type: 'varchar' })
  entityId!: string;

  @CreateDateColumn()
  deletedAt!: Date;
}

