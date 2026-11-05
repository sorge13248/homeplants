import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthUser,
  OidcConfig,
  PlantItem,
  RoomItem,
  RoomPlantItem,
  SpaceItem,
  UserSettings,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Auth & Config
  getOidcConfig(): Observable<OidcConfig> {
    return this.http.get<OidcConfig>('/api/auth/config');
  }

  getOidcMetadata(): Observable<any> {
    return this.http.get<any>('/api/auth/metadata');
  }

  getMe(): Observable<AuthUser> {
    return this.http.get<AuthUser>('/api/me');
  }

  // Spaces
  getSpaces(): Observable<SpaceItem[]> {
    return this.http.get<SpaceItem[]>('/api/spaces');
  }

  getSpace(id: string): Observable<SpaceItem> {
    return this.http.get<SpaceItem>(`/api/spaces/${id}`);
  }

  createSpace(data: Partial<SpaceItem>): Observable<SpaceItem> {
    return this.http.post<SpaceItem>('/api/spaces', data);
  }

  updateSpace(id: string, data: Partial<SpaceItem>): Observable<SpaceItem> {
    return this.http.put<SpaceItem>(`/api/spaces/${id}`, data);
  }

  deleteSpace(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/spaces/${id}`);
  }

  // Rooms
  getRooms(spaceId?: string): Observable<RoomItem[]> {
    let params = new HttpParams();
    if (spaceId) {
      params = params.set('spaceId', spaceId);
    }
    return this.http.get<RoomItem[]>('/api/rooms', { params });
  }

  getRoom(id: string): Observable<RoomItem> {
    return this.http.get<RoomItem>(`/api/rooms/${id}`);
  }

  createRoom(data: Partial<RoomItem>): Observable<RoomItem> {
    return this.http.post<RoomItem>('/api/rooms', data);
  }

  updateRoom(id: string, data: Partial<RoomItem>): Observable<RoomItem> {
    return this.http.put<RoomItem>(`/api/rooms/${id}`, data);
  }

  deleteRoom(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/rooms/${id}`);
  }

  // Plants
  getPlants(): Observable<PlantItem[]> {
    return this.http.get<PlantItem[]>('/api/plants');
  }

  getPlant(id: string): Observable<PlantItem> {
    return this.http.get<PlantItem>(`/api/plants/${id}`);
  }

  createPlant(data: Partial<PlantItem>): Observable<PlantItem> {
    return this.http.post<PlantItem>('/api/plants', data);
  }

  updatePlant(id: string, data: Partial<PlantItem>): Observable<PlantItem> {
    return this.http.put<PlantItem>(`/api/plants/${id}`, data);
  }

  deletePlant(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/plants/${id}`);
  }

  // Room Plants
  getRoomPlants(roomId?: string): Observable<RoomPlantItem[]> {
    let params = new HttpParams();
    if (roomId) {
      params = params.set('roomId', roomId);
    }
    return this.http.get<RoomPlantItem[]>('/api/room-plants', { params });
  }

  getRoomPlant(id: string): Observable<RoomPlantItem> {
    return this.http.get<RoomPlantItem>(`/api/room-plants/${id}`);
  }

  createRoomPlant(data: Partial<RoomPlantItem>): Observable<RoomPlantItem> {
    return this.http.post<RoomPlantItem>('/api/room-plants', data);
  }

  updateRoomPlant(id: string, data: Partial<RoomPlantItem>): Observable<RoomPlantItem> {
    return this.http.put<RoomPlantItem>(`/api/room-plants/${id}`, data);
  }

  deleteRoomPlant(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`/api/room-plants/${id}`);
  }

  waterRoomPlant(id: string, body?: { date?: string; notes?: string }): Observable<RoomPlantItem> {
    return this.http.post<RoomPlantItem>(`/api/room-plants/${id}/water`, body || {});
  }

  waterAllInRoom(roomId: string): Observable<RoomPlantItem[]> {
    return this.http.post<RoomPlantItem[]>(`/api/room-plants/room/${roomId}/water-all`, {});
  }

  snoozeRoomPlant(id: string, hours: number): Observable<RoomPlantItem> {
    return this.http.post<RoomPlantItem>(`/api/room-plants/${id}/snooze`, { hours });
  }

  // Settings
  getSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>('/api/settings');
  }

  updateSettings(data: Partial<UserSettings>): Observable<UserSettings> {
    return this.http.put<UserSettings>('/api/settings', data);
  }

  sendTestNotification(): Observable<{ success: boolean; sent: boolean; message: string }> {
    return this.http.post<{ success: boolean; sent: boolean; message: string }>(
      '/api/settings/test-notification',
      {},
    );
  }

  // Attachments
  uploadAttachment(
    file: File | Blob,
    metadata?: { plantId?: string; spaceId?: string; roomId?: string; sortOrder?: number },
  ): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata?.plantId) formData.append('plantId', metadata.plantId);
    if (metadata?.spaceId) formData.append('spaceId', metadata.spaceId);
    if (metadata?.roomId) formData.append('roomId', metadata.roomId);
    if (metadata?.sortOrder !== undefined) formData.append('sortOrder', String(metadata.sortOrder));

    return this.http.post('/api/attachments/upload', formData);
  }

  // Sync
  sync(payload: any): Observable<any> {
    return this.http.post('/api/sync', payload);
  }

  getFullState(): Observable<any> {
    return this.http.get('/api/sync/full-state');
  }
}
