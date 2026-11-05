import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface ConfirmModalData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-modal confirm-dialog">
      <h2 class="dialog-title">{{ data.title }}</h2>
      <p class="dialog-message">{{ data.message }}</p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-outline" (click)="cancel()">
          {{ data.cancelLabel || 'Annulla' }}
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-danger]="data.confirmVariant === 'danger'"
          [class.btn-primary]="data.confirmVariant !== 'danger'"
          (click)="confirm()"
        >
          {{ data.confirmLabel || 'Conferma' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 1.75rem 2rem;
      max-width: 440px;
      width: 90vw;
    }
    .dialog-title {
      margin: 0 0 0.75rem 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .dialog-message {
      margin: 0 0 1.5rem 0;
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `],
})
export class ConfirmModalComponent {
  readonly data: ConfirmModalData = inject(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<boolean>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

