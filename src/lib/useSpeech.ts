import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

import { notify } from '@/lib/notify';

/**
 * Bare language subtag only. On Android expo-speech builds the locale with
 * `Locale.Builder().setLanguage()`, which rejects "en-US" and silently falls back to the
 * device language (Vietnamese), so English was read by a Vietnamese voice or not at all.
 */
const LANGUAGE = 'en';

const SPEECH_ERROR = 'Không đọc được. Kiểm tra âm lượng media và giọng đọc tiếng Anh trong Cài đặt';

/** Speaks `text` in English, calling `onError` instead of failing silently. */
export async function speakEnglish(text: string, onError: () => void) {
  try {
    await Speech.stop();
    Speech.speak(text, { language: LANGUAGE, rate: 0.95, onError: () => onError() });
  } catch {
    onError();
  }
}

/**
 * Text-to-speech for English. `available` is false only when the device reports voices
 * and none of them is English (an empty list means "unknown", so we keep the button).
 */
export function useSpeech() {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!alive || voices.length === 0) return;
        setAvailable(voices.some((v) => v.language?.toLowerCase().startsWith('en')));
      })
      .catch(() => {});
    return () => {
      alive = false;
      Speech.stop();
    };
  }, []);

  const speak = useCallback((text: string) => speakEnglish(text, () => notify(SPEECH_ERROR)), []);

  return { available, speak };
}
