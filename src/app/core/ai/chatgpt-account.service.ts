import { Injectable, inject, signal } from '@angular/core';
import { AppDb } from '../db';
import { BRIDGE_DOWN, ChatGptModel, ChatGptStatus, chatGptModels, chatGptSignIn, chatGptSignOut, chatGptStatus } from './chatgpt';
import { AI_FETCH } from './providers';

const CHATGPT_WELCOME_KEY = 'chatgptWelcomeSeen';

/** The ChatGPT account as the local bridge reports it (CR-005); no token ever reaches this code. */
@Injectable({ providedIn: 'root' })
export class ChatGptAccountService {
  private readonly appDb = inject(AppDb);
  private readonly fetchFn = inject(AI_FETCH);

  readonly status = signal<ChatGptStatus>(BRIDGE_DOWN);
  /** Models of the signed-in account; null until listed. */
  readonly models = signal<ChatGptModel[] | null>(null);
  readonly error = signal('');
  readonly welcomeSeen = signal(true);

  /** Reads the bridge status and, when plan usage is granted, the account's actual model list. */
  async refresh(): Promise<void> {
    const status = await chatGptStatus(this.fetchFn);
    this.status.set(status);
    if (!status.sharing) {
      this.models.set(null);
      return;
    }
    try {
      this.models.set(await chatGptModels(this.fetchFn));
      this.error.set('');
    } catch (error) {
      this.models.set(null);
      this.error.set(`無法取得模型清單：${error instanceof Error ? error.message : String(error)}`);
    }
    const seen = await (await this.appDb.db()).get('meta', CHATGPT_WELCOME_KEY);
    this.welcomeSeen.set(!!seen);
  }

  /** The official sign-in page to open (the bridge starts the loopback callback first). */
  signIn(): Promise<string> {
    return chatGptSignIn(this.fetchFn);
  }

  async signOut(forget = false): Promise<{ revoked: boolean; message?: string }> {
    const result = await chatGptSignOut(this.fetchFn, forget);
    await this.refresh();
    return result;
  }

  async dismissWelcome(): Promise<void> {
    this.welcomeSeen.set(true);
    await (await this.appDb.db()).put('meta', { key: CHATGPT_WELCOME_KEY, value: true });
  }
}
