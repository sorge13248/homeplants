import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'homeplants_theme_preference';

  readonly preference = signal<ThemePreference>(this.loadPreference());
  readonly systemIsDark = signal<boolean>(this.detectSystemDark());

  readonly effectiveTheme = computed<'light' | 'dark'>(() => {
    const pref = this.preference();
    if (pref === 'system') {
      return this.systemIsDark() ? 'dark' : 'light';
    }
    return pref;
  });

  constructor() {
    // Listen for OS theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        this.systemIsDark.set(e.matches);
      };
      mediaQuery.addEventListener('change', listener);
    }

    // Apply theme changes to <html> element
    effect(() => {
      const theme = this.effectiveTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }

  setPreference(pref: ThemePreference) {
    this.preference.set(pref);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, pref);
      }
    } catch {
      // Ignored
    }
  }

  private loadPreference(): ThemePreference {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(this.storageKey);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          return saved;
        }
      }
    } catch {
      // Ignored
    }
    return 'system';
  }

  private detectSystemDark(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }
}

