import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }

    // Mock global localStorage if not available or mocked
    if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.getItem) {
      (globalThis as any).localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          for (const key of Object.keys(mockStorage)) {
            delete mockStorage[key];
          }
        },
      };
    } else {
      try {
        localStorage.clear();
      } catch {
        // Ignored
      }
    }

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('should be created with initial preference', () => {
    expect(service).toBeTruthy();
    expect(['system', 'light', 'dark']).toContain(service.preference());
  });

  it('should allow setting preference to light', () => {
    service.setPreference('light');
    expect(service.preference()).toBe('light');
    expect(service.effectiveTheme()).toBe('light');
  });

  it('should allow setting preference to dark', () => {
    service.setPreference('dark');
    expect(service.preference()).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
  });
});
