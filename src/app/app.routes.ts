import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'decks' },
  {
    path: 'decks',
    title: '牌組｜YGO Combo 助手',
    loadComponent: () => import('./features/decks/deck-list-page').then((m) => m.DeckListPage),
  },
  {
    path: 'decks/:deckId',
    title: '編輯牌組｜YGO Combo 助手',
    loadComponent: () => import('./features/decks/deck-edit-page').then((m) => m.DeckEditPage),
  },
  {
    path: 'decks/:deckId/hand',
    title: '起手與 Combo 查詢｜YGO Combo 助手',
    loadComponent: () => import('./features/opening-hand/hand-page').then((m) => m.HandPage),
  },
  {
    path: 'combos',
    title: 'Combo 管理｜YGO Combo 助手',
    loadComponent: () => import('./features/combo-editor/combo-list-page').then((m) => m.ComboListPage),
  },
  {
    path: 'combos/new',
    title: '新增 Combo｜YGO Combo 助手',
    loadComponent: () => import('./features/combo-editor/combo-edit-page').then((m) => m.ComboEditPage),
  },
  {
    path: 'combos/:comboId',
    title: 'Combo 詳細｜YGO Combo 助手',
    loadComponent: () => import('./features/combo-viewer/combo-detail-page').then((m) => m.ComboDetailPage),
  },
  {
    path: 'combos/:comboId/edit',
    title: '編輯 Combo｜YGO Combo 助手',
    loadComponent: () => import('./features/combo-editor/combo-edit-page').then((m) => m.ComboEditPage),
  },
  {
    path: 'settings',
    title: '設定｜YGO Combo 助手',
    loadComponent: () => import('./features/settings/settings-page').then((m) => m.SettingsPage),
  },
  {
    path: '**',
    title: '找不到頁面｜YGO Combo 助手',
    loadComponent: () => import('./shared/not-found-page').then((m) => m.NotFoundPage),
  },
];
