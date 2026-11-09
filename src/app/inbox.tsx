import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';

import { InboxUrlForm } from '@/components/InboxUrlForm';
import { deleteInboxItems, describeInboxError, fetchInbox, resolveInboxUrl } from '@/lib/inbox';
import { choose, confirm, notify } from '@/lib/notify';
import {
  classify,
  createdAtMs,
  InboxItem,
  InboxItemStatus,
  phraseKey,
  splitByDay,
  startOfDay,
  toImport,
} from '@/logic/inbox';
import { usePhraseStore } from '@/store/PhraseStore';
import { colors, radius } from '@/theme';

/** Shared inbox of phrases sent from the PC (spec: GitHub issue #29). */
export default function InboxScreen() {
  const store = usePhraseStore();
  const url = resolveInboxUrl(store.data.settings);

  if (!url) {
    return (
      <View style={styles.root}>
        <View style={styles.setup}>
          <Text style={styles.setupIcon}>📭</Text>
          <Text style={styles.setupTitle}>Chưa kết nối hộp thư</Text>
          <Text style={styles.setupText}>Dán địa chỉ hộp thư MockAPI để nhận từ gửi từ PC.</Text>
        </View>
        <InboxUrlForm />
      </View>
    );
  }
  return <InboxList key={url} url={url} />;
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: InboxItem[] };

function InboxList({ url }: { url: string }) {
  const store = usePhraseStore();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onItems = useCallback((items: InboxItem[]) => {
    setLoad({ state: 'ready', items });
    const ids = new Set(items.map((i) => i.id));
    setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
  }, []);
  const onError = useCallback((e: unknown) => setLoad({ state: 'error', message: describeInboxError(e) }), []);

  const fetchItems = useCallback(() => fetchInbox(url).then(onItems, onError), [url, onItems, onError]);

  // Mounted with key={url}, so a URL change starts from a fresh loading state.
  useEffect(() => {
    let alive = true;
    fetchInbox(url).then(
      (items) => alive && onItems(items),
      (e) => alive && onError(e),
    );
    return () => {
      alive = false;
    };
  }, [url, onItems, onError]);

  const retry = () => {
    setLoad({ state: 'loading' });
    fetchItems();
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const now = new Date();
  const nowIso = now.toISOString();
  const existingKeys = useMemo(() => new Set(store.data.phrases.map((p) => phraseKey(p.phrase))), [store.data.phrases]);
  const items = load.state === 'ready' ? load.items : [];
  const groups = splitByDay(items, now);
  const status = (item: InboxItem) => classify(item, existingKeys, nowIso);
  const chosen = items.filter((i) => selected.has(i.id) && status(i) === 'selectable');

  const toggle = (item: InboxItem) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

  const addSelected = async () => {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    try {
      const added = await store.addPhrases(toImport(chosen, existingKeys, new Date().toISOString()));
      setSelected(new Set());
      notify(`✅ Đã thêm ${added.length} từ`);
    } catch {
      notify('Không lưu được từ vào máy 😢');
    } finally {
      setBusy(false);
    }
  };

  const deleteOld = async () => {
    if (busy || groups.older.length === 0) return;
    const total = groups.older.length;
    const ok = await confirm(
      `Xóa ${total} từ cũ?`,
      'Xóa vĩnh viễn khỏi hộp thư chung. Mọi người sẽ không thấy nữa.',
      'Xóa',
      true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      let remaining = groups.older.map((i) => i.id);
      let deleted = 0;
      for (;;) {
        const r = await deleteInboxItems(url, remaining);
        deleted += r.deleted;
        remaining = r.failed;
        if (remaining.length === 0) {
          notify(`🗑️ Đã xóa ${deleted} từ cũ.`);
          break;
        }
        const retry = await choose('Chưa xóa hết', `Đã xóa ${deleted}/${total}. Thử lại?`, [
          { text: 'Thôi', value: false, style: 'cancel' },
          { text: 'Thử lại', value: true },
        ]);
        if (!retry) break;
      }
    } finally {
      setBusy(false);
      await fetchItems();
    }
  };

  if (load.state === 'loading') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (load.state === 'error') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{load.message}</Text>
        <Pressable style={styles.secondary} onPress={retry}>
          <Text style={styles.secondaryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const sections = [
    { key: 'today', title: `Hôm nay (${groups.today.length})`, data: groups.today },
    { key: 'older', title: `Cũ hơn (${groups.older.length})`, data: groups.older },
  ];

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Row
            item={item}
            status={status(item)}
            checked={selected.has(item.id)}
            expanded={expanded === item.id}
            onToggle={() => toggle(item)}
            onExpand={() => setExpanded((cur) => (cur === item.id ? null : item.id))}
            now={now}
          />
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.empty}>{section.key === 'today' ? 'Hôm nay chưa có từ mới.' : 'Không có từ cũ.'}</Text>
          ) : section.key === 'older' ? (
            <Pressable
              onPress={deleteOld}
              disabled={busy}
              style={({ pressed }) => [styles.danger, (pressed || busy) && styles.dim]}>
              <Text style={styles.dangerText}>🗑️ Xóa {section.data.length} từ cũ khỏi hộp thư</Text>
            </Pressable>
          ) : null
        }
      />

      {chosen.length > 0 && (
        <Pressable
          onPress={addSelected}
          disabled={busy}
          style={({ pressed }) => [styles.addBar, (pressed || busy) && styles.dim]}>
          <Text style={styles.addText}>✅ Thêm {chosen.length} từ vào máy</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatTime(item: InboxItem, now: Date): string {
  const ms = createdAtMs(item);
  if (ms === null) return 'không rõ ngày';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return ms >= startOfDay(now) ? time : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function Row({
  item,
  status,
  checked,
  expanded,
  onToggle,
  onExpand,
  now,
}: {
  item: InboxItem;
  status: InboxItemStatus;
  checked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  now: Date;
}) {
  const selectable = status === 'selectable';
  const mark = status === 'alreadyAdded' ? '✓' : status === 'invalid' ? '⚠️' : checked ? '☑' : '☐';
  const example = text(item.example);
  const exampleVi = text(item.exampleVi);

  return (
    <View style={[styles.row, !selectable && styles.dim]}>
      <Pressable
        hitSlop={8}
        disabled={!selectable}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !selectable }}
        style={styles.check}>
        <Text style={[styles.checkText, checked && { color: colors.accent }]}>{mark}</Text>
      </Pressable>
      <Pressable style={styles.rowBody} onPress={onExpand}>
        <View style={styles.rowTop}>
          <Text style={styles.phrase} numberOfLines={expanded ? undefined : 1}>
            {text(item.phrase) || '(trống)'}
          </Text>
          <Text style={styles.time}>{formatTime(item, now)}</Text>
        </View>
        <Text style={styles.meaning} numberOfLines={expanded ? undefined : 1}>
          {status === 'invalid' ? 'Thiếu dữ liệu' : text(item.meaning)}
          {status === 'alreadyAdded' ? ' · đã có trong máy' : ''}
        </Text>
        {expanded && example !== '' && <Text style={styles.example}>“{example}”</Text>}
        {expanded && exampleVi !== '' && <Text style={styles.exampleVi}>{exampleVi}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  setup: { alignItems: 'center', gap: 8, marginVertical: 24 },
  setupIcon: { fontSize: 48 },
  setupTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  setupText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  errorText: { color: colors.text, fontSize: 16, textAlign: 'center' },
  list: { paddingBottom: 96, gap: 8 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 14,
  },
  check: { paddingTop: 1 },
  checkText: { color: colors.muted, fontSize: 20, width: 24, textAlign: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phrase: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  time: { color: colors.muted, fontSize: 12 },
  meaning: { color: colors.muted, fontSize: 14 },
  example: { color: colors.text, fontSize: 14, fontStyle: 'italic', marginTop: 6 },
  exampleVi: { color: colors.muted, fontSize: 13 },
  dim: { opacity: 0.5 },
  secondary: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  danger: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  addBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 6,
  },
  addText: { color: colors.bg, fontSize: 17, fontWeight: '800' },
});
