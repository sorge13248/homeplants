import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401 || err.status === 403) {
          if (!req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/refresh')) {
            authService.handleSessionExpired();
          }
        }
      }
      return throwError(() => err);
    }),
  );
};

