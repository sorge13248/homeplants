import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card card-container" (click)="onCardClick()">
      <!-- Card Image / Header -->
      <div class="image-wrapper">
        @if (imageUrl) {
          <img [src]="imageUrl" [alt]="title" class="cover-image" loading="lazy" />
        } @else {
          <div class="placeholder-image">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z" opacity="0.2"/>
              <path d="M12 22v-9" stroke-linecap="round"/>
              <path d="M12 13a5 5 0 0 0 5-5c0-3-5-5-5-5s-5 2-5 5a5 5 0 0 0 5 5z" stroke-linejoin="round"/>
            </svg>
          </div>
        }

        <!-- Status Badge -->
        @if (statusBadge) {
          <div class="badge-tag" [ngClass]="'badge-' + statusVariant">
            {{ statusBadge }}
          </div>
        }

        <!-- Action menu buttons top right -->
        <div class="top-actions" (click)="$event.stopPropagation()">
          @if (mapLink) {
            <a
              [href]="mapLink"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-btn"
              title="Apri sulla mappa"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
                <line x1="9" y1="3" x2="9" y2="18"></line>
                <line x1="15" y1="6" x2="15" y2="21"></line>
              </svg>
            </a>
          }
          @if (showActions) {
            <button
              type="button"
              class="icon-btn"
              (click)="onEdit($event)"
              title="Modifica"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn btn-del"
              (click)="onDelete($event)"
              title="Elimina"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          }
        </div>
      </div>

      <!-- Card Body -->
      <div class="card-content">
        <h3 class="card-title">{{ title }}</h3>
        @if (subtitle) {
          <div class="card-subtitle">{{ subtitle }}</div>
        }
        @if (description) {
          <p class="card-description">{{ description }}</p>
        }

        <!-- Bottom Quick Action Slot -->
        @if (quickActionLabel) {
          <div class="card-footer" (click)="$event.stopPropagation()">
            <button
              type="button"
              class="btn btn-sm"
              [ngClass]="quickActionVariant === 'primary' ? 'btn-primary' : 'btn-secondary'"
              (click)="onQuickAction($event)"
            >
              @if (quickActionIcon === 'droplet') {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                </svg>
              } @else if (quickActionIcon === 'plus') {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              }
              <span>{{ quickActionLabel }}</span>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .card-container {
      cursor: pointer;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .image-wrapper {
      position: relative;
      width: 100%;
      height: 170px;
      background: rgba(16, 185, 129, 0.08);
      overflow: hidden;
    }
    .cover-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s ease;
    }
    .card-container:hover .cover-image {
      transform: scale(1.04);
    }
    .placeholder-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      background: radial-gradient(circle, var(--color-primary-subtle) 0%, transparent 70%);
    }
    .badge-tag {
      position: absolute;
      bottom: 10px;
      left: 10px;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    .badge-default {
      background: rgba(30, 41, 59, 0.85);
      color: #f8fafc;
    }
    .badge-success {
      background: rgba(16, 185, 129, 0.9);
      color: #ffffff;
    }
    .badge-warning {
      background: rgba(245, 158, 11, 0.9);
      color: #ffffff;
    }
    .badge-danger {
      background: rgba(239, 68, 68, 0.9);
      color: #ffffff;
    }
    .top-actions {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 6px;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(15, 23, 21, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(6px);
      transition: all 0.2s ease;
      text-decoration: none;

      &:hover {
        background: var(--color-primary);
        transform: scale(1.1);
      }
      &.btn-del:hover {
        background: var(--color-danger);
      }
    }
    .card-content {
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-title {
      margin: 0 0 0.35rem 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.3;
    }
    .card-subtitle {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-primary);
      margin-bottom: 0.65rem;
    }
    .card-description {
      margin: 0;
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      flex: 1;
    }
    .card-footer {
      margin-top: 1rem;
      display: flex;
      justify-content: flex-end;
    }
  `],
})
export class AppCardComponent {
  @Input({ required: true }) title!: string;
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
