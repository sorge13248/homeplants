import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './layout/header/header.component';
import { SessionExpiredModalComponent } from './shared/components/session-expired-modal/session-expired-modal.component';
import { ToastService } from './core/toast.service';
import { SyncService } from './core/sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, SessionExpiredModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly toastService = inject(ToastService);
  private readonly syncService = inject(SyncService);
}
