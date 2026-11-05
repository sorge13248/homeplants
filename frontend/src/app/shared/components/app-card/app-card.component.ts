import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-card.component.html',
  styleUrl: './app-card.component.scss',
})
export class AppCardComponent {
  @Input({ required: true }) title!: string;
  @Input() location?: string | null = null;
  @Input() subtitle?: string | null = null;
  @Input() description?: string | null = null;
  @Input() imageUrl?: string | null = null;
  @Input() statusBadge?: string | null = null;
  @Input() statusVariant: 'default' | 'success' | 'warning' | 'danger' = 'default';
  @Input() mapLink?: string | null = null;
  @Input() showActions = true;
  @Input() quickActionLabel?: string | null = null;
  @Input() quickActionIcon?: string | null = null;
  @Input() quickActionVariant: 'primary' | 'secondary' = 'primary';

  @Output() cardClick = new EventEmitter<void>();
  @Output() quickAction = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  onCardClick() {
    this.cardClick.emit();
  }

  onQuickAction(e: Event) {
    e.stopPropagation();
    this.quickAction.emit();
  }

  onEdit(e: Event) {
    e.stopPropagation();
    this.edit.emit();
  }

  onDelete(e: Event) {
    e.stopPropagation();
    this.delete.emit();
  }
}
