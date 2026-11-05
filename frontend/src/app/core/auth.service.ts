import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthUser, OidcConfig } from './models';

interface OidcMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

interface MinimalCachedUser {
  displayName: string;
  pictureUrl?: string | null;
}

const AUTH_STORAGE_KEY = 'homeplants_auth_user';
const RETURN_URL_STORAGE_KEY = 'homeplants_auth_return_url';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly oidcConfig = signal<OidcConfig | null>(null);
  readonly oidcMetadata = signal<OidcMetadata | null>(null);
  readonly profile = signal<AuthUser | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly sessionExpired = signal(false);

  private sessionPingTimer: ReturnType<typeof setTimeout> | null = null;
  private isRenewingSession = false;
  private silentRefreshPromise: Promise<boolean> | null = null;
  private lastRefreshedAt = Date.now();

  sessionPingIntervalMs = 30_000;
  proactiveRefreshIntervalMs = 4 * 60_000;

  readonly isAuthenticated = computed(() => Boolean(this.profile()));
  readonly displayName = computed(() => this.profile()?.displayName ?? 'Giardiniere');
  readonly email = computed(() => this.profile()?.email ?? null);
  readonly pictureUrl = computed(() => this.profile()?.pictureUrl ?? null);
  readonly initials = computed(() => {
    const source = this.displayName().trim();
    return (
      source
        .split(/\s+/)
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'HP'
    );
  });

  constructor() {
    const cached = this.getCachedProfile();
    if (cached) {
      this.profile.set(cached);
      this.loading.set(false);
    }

    effect(() => {
      const authenticated = this.isAuthenticated();
      untracked(() => {
        if (authenticated) {
          this.startSessionPing();
        } else {
          this.stopSessionPing();
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.stopSessionPing();
    });

    // Proactive refresh on window focus / visibility change
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onVisibilityOrFocus = () => {
        if (document.visibilityState === 'visible' && this.isAuthenticated()) {
          const elapsed = Date.now() - this.lastRefreshedAt;
          if (elapsed >= this.proactiveRefreshIntervalMs) {
            void this.silentRefresh();
          }
        }
      };

      document.addEventListener('visibilitychange', onVisibilityOrFocus);
      window.addEventListener('focus', onVisibilityOrFocus);

      this.destroyRef.onDestroy(() => {
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
        window.removeEventListener('focus', onVisibilityOrFocus);
      });
    }

    void this.initialize();
  }

  async initialize() {
    if (!this.profile()) {
      this.loading.set(true);
    }
    try {
      await this.loadProfile();
    } finally {
      this.loading.set(false);
    }

    void this.loadOidcConfig();
  }

  async loadOidcConfig() {
    const config = await firstValueFrom(this.api.getOidcConfig().pipe(catchError(() => of(null))));
    if (!config) {
      return;
    }
    this.oidcConfig.set(config);

    if (config.issuerUrl && config.clientId) {
      const metadata = await firstValueFrom(this.api.getOidcMetadata().pipe(catchError(() => of(null))));
      this.oidcMetadata.set(metadata);
    }
  }

  async login() {
    window.location.assign('/api/auth/login');
  }

  async completeCallback(url: string) {
    this.loading.set(true);
    try {
      await this.loadProfile();
      this.sessionExpired.set(false);
      this.startSessionPing();
      return true;
    } finally {
      this.loading.set(false);
    }
  }

  logout() {
    this.stopSessionPing();
    this.setCachedProfile(null);
    void firstValueFrom(this.http.post('/api/auth/logout', {}).pipe(catchError(() => of(null)))).finally(() => {
      this.profile.set(null);
      void this.router.navigateByUrl('/login');
    });
  }

  startSessionPing(): void {
    this.stopSessionPing();

    if (!this.isAuthenticated() || this.isRenewingSession) {
      return;
    }

    this.sessionPingTimer = setTimeout(async () => {
      this.sessionPingTimer = null;
      await this.checkSession();
      if (this.isAuthenticated() && !this.isRenewingSession) {
        this.startSessionPing();
      }
    }, this.sessionPingIntervalMs);
  }

  stopSessionPing(): void {
    if (this.sessionPingTimer) {
      clearTimeout(this.sessionPingTimer);
      this.sessionPingTimer = null;
    }
  }

  async checkSession(): Promise<boolean> {
    if (!this.isAuthenticated() || this.isRenewingSession) {
      return false;
    }

    const elapsed = Date.now() - this.lastRefreshedAt;
    if (elapsed >= this.proactiveRefreshIntervalMs) {
      const refreshed = await this.silentRefresh();
      if (refreshed) return true;
    }

    try {
      const profile = await firstValueFrom(this.http.get<AuthUser>('/api/me'));
      if (profile) {
        this.profile.set(profile);
        this.setCachedProfile(profile);
        this.sessionExpired.set(false);
        return true;
      }
      this.handleSessionExpired();
      return false;
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
        this.handleSessionExpired();
        return false;
      }
      return true;
    }
  }

  handleSessionExpired(): void {
    this.stopSessionPing();
    this.sessionExpired.set(true);
  }

  async renewSession(): Promise<boolean> {
    if (this.isRenewingSession) return false;
    this.isRenewingSession = true;
    this.stopSessionPing();

    try {
      const refreshed = await this.silentRefresh();
      if (refreshed && this.isAuthenticated()) {
        this.sessionExpired.set(false);
        this.startSessionPing();
        return true;
      }

      this.rememberCurrentUrl();
      await this.login();
      return true;
    } catch {
      this.sessionExpired.set(true);
      return false;
    } finally {
      this.isRenewingSession = false;
    }
  }

  silentRefresh(): Promise<boolean> {
    if (this.silentRefreshPromise) {
      return this.silentRefreshPromise;
    }

    this.silentRefreshPromise = this.doSilentRefresh().finally(() => {
      this.silentRefreshPromise = null;
    });

    return this.silentRefreshPromise;
  }

  private async doSilentRefresh(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ refreshed: boolean; expiresIn?: number }>('/api/auth/refresh', {}).pipe(
          catchError(() => of(null)),
        ),
      );

      if (res?.refreshed) {
        this.lastRefreshedAt = Date.now();
        await this.loadProfileSilently();
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  }

  private async loadProfileSilently(): Promise<boolean> {
    try {
      const profile = await firstValueFrom(this.http.get<AuthUser>('/api/me').pipe(catchError(() => of(null))));
      if (profile) {
        this.profile.set(profile);
        this.setCachedProfile(profile);
        this.sessionExpired.set(false);
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  }

  rememberCurrentUrl(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const path = window.location.pathname + window.location.search;
        if (path && path !== '/login' && !path.startsWith('/auth/callback')) {
          window.sessionStorage.setItem(RETURN_URL_STORAGE_KEY, path);
        }
      }
    } catch {
      // Ignored
    }
  }

  consumeReturnUrl(): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const url = window.sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
        window.sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
        return url;
      }
    } catch {
      // Ignored
    }
    return null;
  }

  private async loadProfile() {
    try {
      const profile = await firstValueFrom(
        this.http.get<AuthUser>('/api/me').pipe(
          catchError((err: unknown) => {
            if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
              return of(null);
            }
            return of(this.profile());
          }),
        ),
      );

      if (profile) {
        this.profile.set(profile);
        this.setCachedProfile(profile);
        this.sessionExpired.set(false);
        return;
      }
    } catch {
      // Ignored
    }

    this.profile.set(null);
    this.setCachedProfile(null);
  }

  private getCachedProfile(): AuthUser | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<MinimalCachedUser>;
          if (parsed && typeof parsed.displayName === 'string' && parsed.displayName.trim()) {
            return {
              id: '',
              subject: '',
              displayName: parsed.displayName,
              email: null,
              pictureUrl: typeof parsed.pictureUrl === 'string' ? parsed.pictureUrl : null,
            };
          }
        }
      }
    } catch {
      // Ignored
    }
    return null;
  }

  private setCachedProfile(profile: AuthUser | null): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (profile?.displayName) {
          const minimal: MinimalCachedUser = {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl ?? null,
          };
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(minimal));
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch {
      // Ignored
    }
  }
}

