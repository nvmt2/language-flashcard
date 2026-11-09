import { createBootCover, notifyCardShown, onCardShown } from '@/lib/bootCover';

jest.mock('@/lib/splash', () => ({ hideSplash: jest.fn() }));

describe('createBootCover', () => {
  it('starts covered and reveals once', () => {
    const cover = createBootCover();
    const listener = jest.fn();
    cover.subscribe(listener);
    expect(cover.isCovered()).toBe(true);

    cover.reveal();
    cover.reveal();
    expect(cover.isCovered()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Regression: reopening the app after Back (JS runtime still alive) remounts the UI.
  // The splash's "already hidden" flag is global, so nothing covered the home list
  // while the card was being pushed. Each mount must start covered again.
  it('covers again on every new mount, even after an earlier one was revealed', () => {
    const first = createBootCover();
    first.reveal();
    const second = createBootCover();
    expect(second.isCovered()).toBe(true);
  });

  it('stops notifying after unsubscribe', () => {
    const cover = createBootCover();
    const listener = jest.fn();
    const unsubscribe = cover.subscribe(listener);
    unsubscribe();
    cover.reveal();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('card shown signal', () => {
  it('reaches every subscriber and hides the splash', () => {
    const { hideSplash } = jest.requireMock('@/lib/splash') as { hideSplash: jest.Mock };
    const a = jest.fn();
    const b = jest.fn();
    const offA = onCardShown(a);
    const offB = onCardShown(b);

    notifyCardShown();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(hideSplash).toHaveBeenCalled();

    offA();
    notifyCardShown();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });
});
