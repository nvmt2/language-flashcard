import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhraseCard } from '@/components/PhraseCard';
import { QuizCard, QuizResult } from '@/components/QuizCard';
import { notifyCardShown } from '@/lib/bootCover';
import { dismissLockscreen, ensureUnlocked, isPhoneLocked, nativeLockscreenEnabled } from '@/lib/lockscreenBridge';
import { notify } from '@/lib/notify';
import { useSpeech } from '@/lib/useSpeech';
import { graduatedByWeek, isCorrectAnswer, QUIZ_TARGET } from '@/logic/quiz';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';

const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 1.2;

export default function LockscreenScreen() {
  const store = usePhraseStore();
  const { available: canSpeak, speak } = useSpeech();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const started = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [translateY] = useState(() => new Animated.Value(0));
  const [quizInput, setQuizInput] = useState('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizTyped, setQuizTyped] = useState('');

  const current = store.data.phrases.find((p) => p.id === currentId) ?? null;
  // Mastered phrases are quizzed; a phrase that just graduated keeps its quiz card until "Tiếp tục".
  const isQuiz = !!current && current.status !== 'learning';
  const streak = current?.status === 'graduated' ? QUIZ_TARGET : (current?.quizStreak ?? 0);
  const weekCount = useMemo(() => graduatedByWeek(store.data.phrases).thisWeek, [store.data.phrases]);

  const resetQuiz = () => {
    setQuizInput('');
    setQuizResult(null);
    setQuizTyped('');
  };

  const next = useCallback(async () => {
    setFlipped(false);
    resetQuiz();
    Keyboard.dismiss();
    try {
      const p = await store.showNext();
      setCurrentId(p?.id ?? null);
    } catch {
      notify('Không lưu được tiến độ 😢');
    }
  }, [store]);

  useEffect(() => {
    if (store.ready && !started.current) {
      started.current = true;
      next().finally(() => setLoaded(true));
    }
  }, [store.ready, next]);

  // Start or reopen: drop the splash and the boot cover only once the first card is on screen.
  useEffect(() => {
    if (loaded) notifyCardShown();
  }, [loaded]);

  // With the native feature on, the card stays mounted behind the keyguard after
  // dismiss(). Prepare the next card as soon as the app LEAVES the screen, so SCREEN_ON
  // brings back a card that is already rendered, instead of an empty screen (the close
  // animation left the card off-screen) that only fills in after 'active'.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!nativeLockscreenEnabled()) return;
      if (state === 'background') {
        translateY.setValue(0);
        next();
      } else if (state === 'active') {
        translateY.setValue(0); // safety net if 'background' was missed
      }
    });
    return () => sub.remove();
  }, [next, translateY]);

  // Over the keyguard, Back must not reveal the rest of the app: send the card away instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isPhoneLocked()) return false;
      dismissLockscreen();
      return true;
    });
    return () => sub.remove();
  }, []);

  const addPhrase = async () => {
    if (await ensureUnlocked()) router.replace('/edit/new');
  };

  const close = useCallback(() => {
    Animated.timing(translateY, { toValue: -1000, duration: 180, useNativeDriver: true }).start(() =>
      dismissLockscreen(),
    );
  }, [translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => translateY.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -SWIPE_DISTANCE || g.vy < -SWIPE_VELOCITY) close();
          else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [translateY, close],
  );

  const markMastered = async () => {
    if (!current) return;
    try {
      await store.setStatus(current.id, 'mastered');
      notify('Đã thuộc ✅ Lần sau sẽ kiểm tra bạn');
      await next();
    } catch {
      notify('Không lưu được 😢');
    }
  };

  const answer = async (correct: boolean, typed: string) => {
    if (!current) return;
    Keyboard.dismiss();
    try {
      const graduated = await store.answerQuiz(current.id, correct);
      setQuizTyped(typed);
      setQuizResult(graduated ? 'graduated' : correct ? 'correct' : 'wrong');
    } catch {
      notify('Không lưu được 😢');
    }
  };

  const checkAnswer = () => {
    if (!current || quizResult) return;
    if (!quizInput.trim()) {
      notify('Gõ gì đó đã nào ✍️');
      return;
    }
    answer(isCorrectAnswer(quizInput, current.phrase), quizInput.trim());
  };

  const demote = async () => {
    if (!current) return;
    try {
      await store.setStatus(current.id, 'learning');
      resetQuiz();
      Keyboard.dismiss();
      notify('Đã chuyển về Đang học');
    } catch {
      notify('Không lưu được 😢');
    }
  };

  return (
    <View style={styles.root} {...pan.panHandlers}>
      <StatusBar hidden />
      <Animated.View style={[styles.fill, { transform: [{ translateY }] }]}>
        <SafeAreaView style={styles.fill}>
          <KeyboardAvoidingView style={styles.fill} behavior="padding">
          <View style={styles.top}>
            <Text style={styles.brand}>Lockscreen English</Text>
            <Pressable onPress={close} hitSlop={16} accessibilityLabel="Đóng">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.center}>
            {!loaded ? null : current && isQuiz ? (
              <QuizCard
                phrase={current}
                streak={streak}
                result={quizResult}
                typed={quizTyped}
                input={quizInput}
                onChangeInput={setQuizInput}
                onSubmit={checkAnswer}
                weekCount={weekCount}
              />
            ) : current ? (
              <PhraseCard phrase={current} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {store.data.phrases.length
                    ? 'Tốt nghiệp hết rồi 🎓 Thêm từ mới để học tiếp nhé!'
                    : 'Chưa có câu nào, thêm câu đi bạn ơi 🥲'}
                </Text>
                <Pressable style={styles.primary} onPress={addPhrase}>
                  <Text style={styles.primaryText}>➕ Thêm câu</Text>
                </Pressable>
              </View>
            )}
          </View>

          {current && isQuiz && !quizResult && (
            <View style={styles.quizActions}>
              <View style={styles.actions}>
                <ActionButton label="🤷 Không nhớ" onPress={() => answer(false, '')} />
                <ActionButton label="Kiểm tra" onPress={checkAnswer} tone="primary" />
              </View>
              <Pressable onPress={demote} hitSlop={8}>
                <Text style={styles.demote}>↩️ Chưa thuộc lắm, cho học lại</Text>
              </Pressable>
            </View>
          )}

          {current && isQuiz && quizResult && (
            <View style={styles.actions}>
              {canSpeak && <ActionButton label="🔊 Đọc" onPress={() => speak(current.phrase)} />}
              <ActionButton label="Tiếp tục ▶" onPress={next} tone="primary" />
            </View>
          )}

          {current && !isQuiz && (
            <View style={styles.actions}>
              {canSpeak && (
                <ActionButton
                  label="🔊 Đọc"
                  onPress={() => speak(flipped && current.example ? `${current.phrase}. ${current.example}` : current.phrase)}
                />
              )}
              <ActionButton label="✅ Đã thuộc" onPress={markMastered} tone="success" />
              <ActionButton label="⏭️ Câu khác" onPress={next} />
            </View>
          )}

          <Text style={styles.swipeHint}>Vuốt lên để đóng</Text>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone?: 'success' | 'primary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'success' && { borderColor: colors.success },
        tone === 'primary' && styles.actionPrimary,
        pressed && { opacity: 0.6 },
      ]}>
      <Text style={[styles.actionText, tone === 'primary' && styles.actionPrimaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  brand: { color: colors.muted, fontSize: 13, letterSpacing: 1 },
  close: { color: colors.muted, fontSize: 22 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingHorizontal: 16 },
  action: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    borderRadius: radius,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  actionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent, paddingHorizontal: 24 },
  actionPrimaryText: { color: colors.bg, fontWeight: '800' },
  quizActions: { alignItems: 'center', gap: 6 },
  demote: { color: colors.warn, fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  swipeHint: { color: colors.muted, textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  empty: { alignItems: 'center', gap: 20 },
  emptyText: { color: colors.text, fontSize: 18, textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: radius, paddingVertical: 12, paddingHorizontal: 20 },
  primaryText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
});
