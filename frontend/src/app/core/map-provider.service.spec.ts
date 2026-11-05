import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MapProviderService } from './map-provider.service';

describe('MapProviderService', () => {
  let service: MapProviderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapProviderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate correct OpenStreetMap URL', () => {
    const url = service.getMapUrl('Via Roma 10, Milano', 'osm');
    expect(url).toContain('openstreetmap.org/search?query=Via%20Roma%2010%2C%20Milano');
  });

  it('should generate correct Google Maps URL', () => {
    const url = service.getMapUrl('Via Roma 10, Milano', 'google');
    expect(url).toContain('google.com/maps/search/?api=1&query=Via%20Roma%2010%2C%20Milano');
  });

  it('should generate correct Apple Maps URL', () => {
    const url = service.getMapUrl('Via Roma 10, Milano', 'apple');
    expect(url).toContain('maps.apple.com/?q=Via%20Roma%2010%2C%20Milano');
  });

  it('should generate correct Bing Maps URL', () => {
    const url = service.getMapUrl('Via Roma 10, Milano', 'bing');
    expect(url).toContain('bing.com/maps?q=Via%20Roma%2010%2C%20Milano');
  });

  it('should return human readable provider names', () => {
    expect(service.getProviderName('osm')).toBe('OpenStreetMap');
    expect(service.getProviderName('google')).toBe('Google Maps');
    expect(service.getProviderName('apple')).toBe('Apple Maps');
    expect(service.getProviderName('bing')).toBe('Bing Maps');
  });
});

