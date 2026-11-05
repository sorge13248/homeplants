import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_settings' })
@Index(['userId'])
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  userId!: string;

  @Column({ type: 'varchar', default: 'osm' })
  preferredMapProvider!: 'osm' | 'google' | 'apple' | 'bing';

  @Column({ type: 'varchar', default: 'system' })
  themePreference!: 'system' | 'light' | 'dark';

  @Column({ type: 'boolean', default: true })
  emailNotificationsEnabled!: boolean;

  @Column({ type: 'varchar', default: '08:00' })
  notificationTime!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

