import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AutoBackupService } from './core/auto-backup.service';
import { CurrentDeckService } from './core/current-deck.service';
import { Icon } from './shared/icon';

interface NavItem {
  label: string;
  icon: string;
  link: () => string[];
  active: (url: string) => boolean;
  /** Shown under the label when the item needs a deck and none exists yet. */
  hint?: () => string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Icon],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly current = inject(CurrentDeckService);

  /** Current URL without query or fragment. */
  protected readonly url = signal(this.router.url);
  /** True once the user navigated inside the app, so "上一頁" has somewhere to go. */
  protected readonly canGoBack = signal(false);

  private readonly deckId = computed(() => this.current.deck()?.id ?? null);
  private readonly inDeck = (url: string, tail: string) => /^\/decks\/[^/]+\//.test(url) && url.endsWith(tail);

  protected readonly nav: NavItem[] = [
    { label: '首頁', icon: 'home', link: () => ['/home'], active: (u) => u === '/home' },
    { label: '牌組', icon: 'decks', link: () => ['/decks'], active: (u) => u === '/decks' || (/^\/decks\/[^/]+$/.test(u) && !u.endsWith('/hand')) },
    {
      label: '起手查詢',
      icon: 'hand',
      link: () => (this.deckId() ? ['/decks', this.deckId()!, 'hand'] : ['/decks']),
      active: (u) => this.inDeck(u, '/hand'),
      hint: () => (this.deckId() ? '' : '先建立或匯入牌組'),
    },
    {
      label: 'AI 展開分析',
      icon: 'ai',
      link: () => (this.deckId() ? ['/decks', this.deckId()!, 'analysis'] : ['/decks']),
      active: (u) => this.inDeck(u, '/analysis'),
      hint: () => (this.deckId() ? '' : '先建立或匯入牌組'),
    },
    { label: 'Combo 管理', icon: 'combos', link: () => ['/combos'], active: (u) => u.startsWith('/combos') },
    { label: '設定', icon: 'settings', link: () => ['/settings'], active: (u) => u.startsWith('/settings') },
  ];

  constructor() {
    // Desktop only: does nothing unless the host provides a backup folder.
    inject(AutoBackupService).start();
    let first = true;
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.url.set(e.urlAfterRedirects.split(/[?#]/)[0]);
      if (!first) this.canGoBack.set(true);
      first = false;
      // A deck may have been created, renamed or deleted on the page we come from.
      void this.current.refresh();
    });
  }

  /** Skip link: move keyboard focus to the page content (an in-page #fragment would make the router leave the page). */
  protected focusMain(): void {
    document.getElementById('main')?.focus();
  }

  protected back(): void {
    this.location.back();
  }
}
