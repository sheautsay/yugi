import { Injectable, Injector, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BattleSettingsService } from '../../core/battle-settings.service';
import { checkHand } from '../../core/hand';
import { LayoutRepository } from '../../core/layout-repository';
import { CardCount, HandLayoutPreset, HandRecognitionSlot, HandRegion, HandSize } from '../../core/models';
import { resolvedHand, screenshotSizeError } from '../../core/recognition';
import { CapturedFrame, platformHooks } from '../platform-hooks';
import { HandRecognitionService } from './hand-recognition.service';

/** How far the window's aspect ratio may differ from the saved layout before the boxes are considered off. */
const ASPECT_TOLERANCE = 0.02;

/** What one press of the capture shortcut (or button) led to. */
export type QuickResult =
  | { kind: 'error'; message: string }
  /** No hand layout saved for the game window yet: the user boxes the hand once on this capture. */
  | { kind: 'needs-layout'; bitmap: ImageBitmap; reason: string }
  /** Every card recognized with confidence and the hand is legal for the deck. */
  | { kind: 'done'; hand: number[]; ms: number }
  /** Some cards need the user's choice. */
  | { kind: 'confirm'; bitmap: ImageBitmap; regions: HandRegion[]; slots: HandRecognitionSlot[]; ms: number };

/** The ImageBitmap of a captured frame; the pixel buffer is only referenced while it is decoded. */
export async function frameToBitmap(frame: CapturedFrame): Promise<ImageBitmap> {
  return createImageBitmap(new ImageData(frame.rgba as Uint8ClampedArray<ArrayBuffer>, frame.width, frame.height));
}

/** Whether a saved layout still fits a window of this size. */
export function layoutFits(preset: Pick<HandLayoutPreset, 'aspectRatio' | 'handSize' | 'regions'>, width: number, height: number, handSize: HandSize): boolean {
  return preset.handSize === handSize && preset.regions.length === handSize && Math.abs(width / height - preset.aspectRatio) <= ASPECT_TOLERANCE;
}

/**
 * B4: capture the Master Duel window, apply the hand layout saved for it and recognize the hand — the whole "one key"
 * path. The picture stays in memory: it is never written to disk and is released as soon as it is not needed.
 */
@Injectable({ providedIn: 'root' })
export class GameCaptureService {
  private readonly recognition = inject(HandRecognitionService);
  private readonly layouts = inject(LayoutRepository);
  private readonly battle = inject(BattleSettingsService);

  /** Set while a capture is running, so a second press is ignored. */
  readonly busy = signal(false);

  available(): boolean {
    return !!platformHooks().captureGame;
  }

  async quick(main: readonly CardCount[], handSize: HandSize, name: (id: number) => string): Promise<QuickResult> {
    const capture = platformHooks().captureGame;
    if (!capture) return { kind: 'error', message: '只有 Windows 桌面版可以直接截取遊戲視窗。' };
    if (this.busy()) return { kind: 'error', message: '上一次截圖還在處理中。' };
    this.busy.set(true);
    const started = performance.now();
    try {
      let frame: CapturedFrame;
      try {
        frame = await capture();
      } catch (error) {
        return { kind: 'error', message: typeof error === 'string' ? error : error instanceof Error ? error.message : '無法截取遊戲視窗。' };
      }
      const sizeError = screenshotSizeError(frame.width, frame.height);
      if (sizeError) return { kind: 'error', message: sizeError };
      const bitmap = await frameToBitmap(frame);

      await this.battle.ready;
      const layoutId = this.battle.gameLayouts()[handSize];
      const preset = layoutId ? (await this.layouts.list()).find((p) => p.id === layoutId) : undefined;
      if (!preset) return { kind: 'needs-layout', bitmap, reason: `還沒有設定 ${handSize} 張手牌在遊戲視窗中的位置，請在這張截圖上框一次手牌。` };
      if (!layoutFits(preset, bitmap.width, bitmap.height, handSize)) {
        return { kind: 'needs-layout', bitmap, reason: '遊戲視窗的長寬比和上次框選時不同，請在這張截圖上重新框一次手牌。' };
      }

      const regions = preset.regions.map((r) => ({ ...r }));
      const counts = new Map(main.map((c) => [c.cardId, c.count]));
      const { slots } = await this.recognition.recognize(bitmap, regions, counts);
      const hand = resolvedHand(slots);
      const ms = Math.round(performance.now() - started);
      if (hand && checkHand(main, hand, handSize, name).errors.length === 0) {
        bitmap.close();
        return { kind: 'done', hand, ms };
      }
      return { kind: 'confirm', bitmap, regions, slots, ms };
    } finally {
      this.busy.set(false);
    }
  }

  /** Saves the boxes drawn on a game capture as the layout for this hand size (relative coordinates only). */
  async saveGameLayout(handSize: HandSize, regions: readonly HandRegion[], width: number, height: number): Promise<void> {
    const id = this.battle.gameLayouts()[handSize] ?? crypto.randomUUID();
    await this.layouts.save({
      schemaVersion: 1,
      id,
      name: `Master Duel 視窗（${handSize} 張）`,
      handSize,
      aspectRatio: width / height,
      regions: regions.map((r) => ({ ...r })),
      createdAt: new Date().toISOString(),
    });
    await this.battle.setGameLayout(handSize, id);
  }
}

/**
 * B4: requests to capture, from the shortcut (handled by the shell, which may first have to open the battle page) to the
 * battle page that does the work. A request made before the page exists waits until the page takes it.
 */
@Injectable({ providedIn: 'root' })
export class CaptureRequests {
  private readonly pendingRequest = signal(0);
  /** Bumped on every request; the battle page reacts to it. */
  readonly tick = this.pendingRequest.asReadonly();
  private taken = 0;

  request(): void {
    this.pendingRequest.update((n) => n + 1);
  }

  /** True once per request. */
  take(): boolean {
    if (this.taken === this.pendingRequest()) return false;
    this.taken = this.pendingRequest();
    return true;
  }
}

/**
 * B4: keeps the system-wide capture shortcut in step with the settings (registered only while the battle mode is on) and
 * turns a press into a capture request, opening the battle page first when another page is shown. Desktop only.
 */
@Injectable({ providedIn: 'root' })
export class CaptureShortcutService {
  private readonly battle = inject(BattleSettingsService);
  private readonly requests = inject(CaptureRequests);
  private readonly router = inject(Router);
  /** Why the shortcut could not be registered (shown in 設定), or ''. */
  readonly error = signal('');
  private started = false;

  start(): void {
    const hooks = platformHooks();
    if (this.started || !hooks.setCaptureShortcut || !hooks.onCaptureShortcut) return;
    this.started = true;
    effect(() => {
      const accelerator = this.battle.enabled() ? this.battle.shortcut() : null;
      void hooks.setCaptureShortcut!(accelerator).then(
        () => this.error.set(''),
        (e: unknown) => this.error.set(typeof e === 'string' ? e : e instanceof Error ? e.message : '無法註冊快捷鍵'),
      );
    }, { injector: this.injector });
    hooks.onCaptureShortcut(() => {
      if (!this.battle.enabled()) return;
      if (!this.router.url.startsWith('/battle')) void this.router.navigateByUrl('/battle');
      this.requests.request();
    });
  }

  private readonly injector = inject(Injector);
}
