import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RoomPlant } from './room-plant.entity';
import { Attachment } from './attachment.entity';

export interface SeasonCareSchedule {
  sunExposure?: 'direct' | 'indirect' | 'filtered' | 'shade';
  placement?: 'indoor' | 'outdoor' | 'greenhouse';
  watering?: {
    frequencyDays?: number;
    quantity?: 'low' | 'moderate' | 'abundant';
    drySoilOnly?: boolean;
    advices?: string;
  };
}

export interface PlantSeasonalCare {
  spring?: SeasonCareSchedule;
  summer?: SeasonCareSchedule;
  autumn?: SeasonCareSchedule;
  winter?: SeasonCareSchedule;
}

export interface SoilRepottingCare {
  repottingSeason?: 'spring' | 'summer' | 'autumn' | 'winter' | 'any';
  potType?: string;
  soilType?: string;
  composition?: string;
}

export interface FertilizationCare {
  period?: string;
  frequencyDays?: number;
  fertilizerType?: string;
  notes?: string;
}

@Entity({ name: 'plants' })
@Index(['userId'])
export class Plant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  commonName!: string;

  @Column({ type: 'varchar', nullable: true })
  scientificName!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  seasonalCare!: PlantSeasonalCare | null;

  @Column({ type: 'simple-json', nullable: true })
  soilRepotting!: SoilRepottingCare | null;

  @Column({ type: 'simple-json', nullable: true })
  fertilization!: FertilizationCare | null;

  @OneToMany(() => Attachment, (attachment) => attachment.plant, { cascade: true })
  attachments!: Attachment[];

  @OneToMany(() => RoomPlant, (roomPlant) => roomPlant.plant, { cascade: true })
  roomPlants!: RoomPlant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

