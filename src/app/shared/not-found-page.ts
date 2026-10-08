import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1>找不到頁面</h1>
      <p>網址可能有誤，或該資料已被刪除。</p>
      <a routerLink="/decks">返回牌組列表</a>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
