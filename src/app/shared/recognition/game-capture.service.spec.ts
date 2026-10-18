import { TestBed } from '@angular/core/testing';
import { BattleSettingsService } from '../../core/battle-settings.service';
import { DB_NAME } from '../../core/db';
import { LayoutRepository } from '../../core/layout-repository';
import { HandRecognitionSlot, HandRegion } from '../../core/models';
import { installPlatformHooks } from '../platform-hooks';
import { CaptureRequests, GameCaptureService, layoutFits } from './game-capture.service';
import { HandRecognitionService } from './hand-recognition.service';

// B4: the one-key path — capture, remembered layout, recognition — with the host and the recognizer replaced by fakes.

const MAIN = [
  { cardId: 1, count: 3 },
  { cardId: 2, count: 3 },
  { cardId: 3, count: 3 },
  { cardId: 4, count: 3 },
  { cardId: 5, count: 3 },
  { cardId: 6, count: 25 },
];
const name = (id: number) => `card ${id}`;
const row = (n: number): HandRegion[] => Array.from({ length: n }, (_, i) => ({ x: 0.2 + i * 0.1, y: 0.8, w: 0.09, h: 0.15 }));
const slot = (index: number, cardId: number, status: HandRecognitionSlot['status']): HandRecognitionSlot => ({
  index,
  region: row(5)[index],
  candidates: [{ cardId, score: status === 'confident' ? 0.9 : 0.6 }],
  status,
  ...(status === 'confident' ? { chosenCardId: cardId } : {}),
});

describe('layoutFits (B4)', () => {
  const preset = { aspectRatio: 16 / 9, handSize: 5 as const, regions: row(5) };
  it('accepts the same hand size and window shape, at any window size', () => {
    expect(layoutFits(preset, 1920, 1080, 5)).toBe(true);
    expect(layoutFits(preset, 1280, 720, 5)).toBe(true);
  });
  it('refuses another hand size or a different window shape', () => {
    expect(layoutFits(preset, 1920, 1080, 6)).toBe(false);
    expect(layoutFits(preset, 1600, 1200, 5)).toBe(false);
  });
});

describe('CaptureRequests (B4)', () => {
  it('hands each request out once, also when it was made before anyone asked', () => {
    const requests = new CaptureRequests();
    expect(requests.take()).toBe(false);
    requests.request();
    expect(requests.take()).toBe(true);
    expect(requests.take()).toBe(false);
  });
});

describe('GameCaptureService.quick (B4)', () => {
  let slots: HandRecognitionSlot[] = [];
  let closed = 0;
  const originalBitmap = globalThis.createImageBitmap;
  const originalImageData = (globalThis as { ImageData?: unknown }).ImageData;

  const make = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DB_NAME, useValue: `capture-${crypto.randomUUID()}` },
        { provide: HandRecognitionService, useValue: { recognize: async () => ({ slots, missingReferences: [] }) } },
      ],
    });
    return TestBed.inject(GameCaptureService);
  };

  beforeEach(() => {
    closed = 0;
    // jsdom has no image decoding: a frame becomes a stand-in bitmap of the same size.
    (globalThis as { ImageData?: unknown }).ImageData = class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    };
    globalThis.createImageBitmap = (async (image: { width: number; height: number }) => ({ width: image.width, height: image.height, close: () => void closed++ })) as unknown as typeof createImageBitmap;
    installPlatformHooks({ captureGame: async () => ({ width: 1920, height: 1080, rgba: new Uint8ClampedArray(1920 * 1080 * 4) }) });
  });

  afterEach(() => {
    globalThis.createImageBitmap = originalBitmap;
    (globalThis as { ImageData?: unknown }).ImageData = originalImageData;
  });

  it('without the desktop host it explains that only the Windows app can capture', async () => {
    installPlatformHooks({});
    const result = await make().quick(MAIN, 5, name);
    expect(result).toEqual({ kind: 'error', message: '只有 Windows 桌面版可以直接截取遊戲視窗。' });
  });

  it('shows the host message when the game window is not found', async () => {
    installPlatformHooks({ captureGame: () => Promise.reject('找不到 Master Duel 視窗。') });
    const result = await make().quick(MAIN, 5, name);
    expect(result).toEqual({ kind: 'error', message: '找不到 Master Duel 視窗。' });
  });

  it('asks for the hand to be boxed once when no layout is remembered', async () => {
    const result = await make().quick(MAIN, 5, name);
    expect(result.kind).toBe('needs-layout');
  });

  it('applies the remembered layout; a fully confident, legal hand is done at once and the picture is released', async () => {
    const service = make();
    await service.saveGameLayout(5, row(5), 1920, 1080);
    slots = [1, 2, 3, 4, 5].map((id, i) => slot(i, id, 'confident'));
    const result = await service.quick(MAIN, 5, name);
    expect(result.kind).toBe('done');
    expect(result.kind === 'done' && result.hand).toEqual([1, 2, 3, 4, 5]);
    expect(closed).toBe(1);
  });

  it('hands uncertain cards to the user with the boxes and the picture', async () => {
    const service = make();
    await service.saveGameLayout(5, row(5), 1920, 1080);
    slots = [slot(0, 1, 'confident'), slot(1, 2, 'uncertain'), slot(2, 3, 'confident'), slot(3, 4, 'confident'), slot(4, 5, 'confident')];
    const result = await service.quick(MAIN, 5, name);
    expect(result.kind).toBe('confirm');
    expect(result.kind === 'confirm' && result.regions.length).toBe(5);
    expect(closed).toBe(0);
  });

  it('asks to box again when the window shape changed since the layout was drawn', async () => {
    const service = make();
    await service.saveGameLayout(5, row(5), 1600, 1200);
    const result = await service.quick(MAIN, 5, name);
    expect(result.kind).toBe('needs-layout');
  });

  it('remembers one layout per hand size and keeps its id when boxed again', async () => {
    const service = make();
    await service.saveGameLayout(6, row(6), 1920, 1080);
    const id = TestBed.inject(BattleSettingsService).gameLayouts()[6];
    await service.saveGameLayout(6, row(6), 1920, 1080);
    expect(TestBed.inject(BattleSettingsService).gameLayouts()[6]).toBe(id);
    expect((await TestBed.inject(LayoutRepository).list()).filter((p) => p.handSize === 6)).toHaveLength(1);
  });
});
