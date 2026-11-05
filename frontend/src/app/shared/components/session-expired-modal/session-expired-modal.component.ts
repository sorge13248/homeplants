import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-session-expired-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-expired-modal.component.html',
  styleUrl: './session-expired-modal.component.scss',
})
export class SessionExpiredModalComponent {
  readonly authService = inject(AuthService);
}

