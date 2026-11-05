import { Injectable } from '@angular/core';

export type MapProvider = 'osm' | 'google' | 'apple' | 'bing';

@Injectable({ providedIn: 'root' })
export class MapProviderService {
  getMapUrl(locationText: string, provider: MapProvider = 'osm'): string {
    const query = encodeURIComponent(locationText.trim());
    switch (provider) {
      case 'google':
        return `https://www.google.com/maps/search/?api=1&query=${query}`;
      case 'apple':
        return `https://maps.apple.com/?q=${query}`;
      case 'bing':
        return `https://www.bing.com/maps?q=${query}`;
      case 'osm':
      default:
        return `https://www.openstreetmap.org/search?query=${query}`;
    }
  }

  getProviderName(provider: MapProvider): string {
    switch (provider) {
      case 'google':
        return 'Google Maps';
      case 'apple':
        return 'Apple Maps';
      case 'bing':
        return 'Bing Maps';
      case 'osm':
      default:
        return 'OpenStreetMap';
    }
  }
}

