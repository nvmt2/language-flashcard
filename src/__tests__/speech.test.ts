import * as Speech from 'expo-speech';

import { speakEnglish } from '@/lib/useSpeech';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

const speak = Speech.speak as jest.Mock;

beforeEach(() => speak.mockClear());

describe('speakEnglish', () => {
  // Regression: expo-speech on Android builds the locale with Locale.Builder().setLanguage(),
  // which only accepts a bare language subtag. 'en-US' threw IllformedLocaleException and
  // silently fell back to the device language (Vietnamese).
  it('passes a bare language code', async () => {
    await speakEnglish('break the ice', jest.fn());
    expect(speak).toHaveBeenCalledWith('break the ice', expect.objectContaining({ language: 'en' }));
  });

  it('reports speech errors instead of failing silently', async () => {
    const onError = jest.fn();
    await speakEnglish('break the ice', onError);
    const options = speak.mock.calls[0][1];
    options.onError(new Error('no engine'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports a synchronous failure too', async () => {
    speak.mockImplementationOnce(() => {
      throw new Error('too long');
    });
    const onError = jest.fn();
    await speakEnglish('break the ice', onError);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
