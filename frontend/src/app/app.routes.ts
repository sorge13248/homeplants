import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'spaces',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
  {
    path: 'spaces',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/spaces/pages/spaces-list/spaces-list.component').then(
            (m) => m.SpacesListComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/spaces/pages/space-detail/space-detail.component').then(
            (m) => m.SpaceDetailComponent,
          ),
      },
      {
        path: ':id/rooms/:roomId',
        loadComponent: () =>
          import('./features/rooms/pages/room-detail/room-detail.component').then(
            (m) => m.RoomDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'plants',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/plants/pages/plant-catalog/plant-catalog.component').then(
            (m) => m.PlantCatalogComponent,
          ),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/plants/pages/plant-editor/plant-editor.component').then(
            (m) => m.PlantEditorComponent,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/plants/pages/plant-detail/plant-detail.component').then(
            (m) => m.PlantDetailComponent,
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./features/plants/pages/plant-editor/plant-editor.component').then(
            (m) => m.PlantEditorComponent,
          ),
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/pages/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'spaces',
  },
];

