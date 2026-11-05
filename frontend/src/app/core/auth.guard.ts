import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.loading()) {
    // Wait until loading finishes
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        if (!authService.loading()) {
          clearInterval(timer);
          resolve();
        }
      }, 30);
    });
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  authService.rememberCurrentUrl();
  return router.parseUrl('/login');
};

