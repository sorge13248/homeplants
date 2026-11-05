import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/spaces']);
    }
  }

  async handleLogin() {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.login();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Accesso non riuscito. Riprova più tardi.');
      this.loading.set(false);
    }
  }
}

