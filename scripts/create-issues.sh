#!/usr/bin/env bash
# Tạo labels, milestones và issues từ spec.
# Dùng: ./scripts/create-issues.sh owner/repo
set -euo pipefail
REPO="${1:?Usage: $0 owner/repo}"
SPEC_URL="https://github.com/nvmt2/language-flashcard/issues/25"

# Chỉ dùng REST API (gh api) để chạy được cả ở môi trường chặn GraphQL.
# Chạy lại nhiều lần cũng an toàn: label được cập nhật, milestone/issue đã có thì bỏ qua.

label() { # name color description
  gh api -X PATCH "repos/$REPO/labels/$1" -f color="$2" -f description="$3" >/dev/null 2>&1 ||
    gh api "repos/$REPO/labels" -f name="$1" -f color="$2" -f description="$3" >/dev/null
}
milestone_number() {
  gh api "repos/$REPO/milestones?state=all&per_page=100" --jq ".[] | select(.title==\"$1\") | .number"
}
milestone() { # title description
  [ -n "$(milestone_number "$1")" ] ||
    gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null
}
EXISTING_TITLES="$(gh api --paginate "repos/$REPO/issues?state=all&per_page=100" --jq '.[] | select(.pull_request|not) | .title')"
issue() { # title labels(comma) milestone  (body từ stdin)
  local body; body="$(cat)"
  if grep -Fxq -- "$1" <<<"$EXISTING_TITLES"; then echo "↷ bỏ qua (đã có): $1"; return; fi
  body="$body"$'\n\n'"📄 Spec: $SPEC_URL"
  local args=(-f title="$1" -f body="$body" -F milestone="$(milestone_number "$3")")
  local l; IFS=',' read -ra ls <<<"$2"; for l in "${ls[@]}"; do args+=(-f "labels[]=$l"); done
  gh api "repos/$REPO/issues" "${args[@]}" --jq '"#\(.number) \(.title)"'
}

label phase-1 "0e8a16" "Giai đoạn 1 – Expo Go"
label phase-2 "5319e7" "Giai đoạn 2 – Native lockscreen"
label setup   "c5def5" "Tooling / cấu hình"
label feature "1d76db" "Tính năng"
label logic   "fbca04" "Logic thuần, có unit test"
label ui      "f9d0c4" "Giao diện"
label native  "b60205" "Kotlin / Android native"
label spike   "d93f0b" "Thử nghiệm khả thi"
label test    "bfdadc" "Testing / QA"

M1="Phase 1 – Expo Go MVP"; M2="Phase 2 – Native lockscreen"
milestone "$M1" "Toàn bộ tính năng chạy trên Expo Go, JSON + AsyncStorage"
milestone "$M2" "Hiện thẻ học đè lên màn hình khóa trên Xiaomi 15T"

# ───────────────────────── PHASE 1 ─────────────────────────
issue "[P1] Khởi tạo project Expo + TypeScript + Expo Router + Jest" "phase-1,setup" "$M1" <<'EOF'
## Mục tiêu
Khung project chạy được trên Expo Go.

## Việc cần làm
- [ ] `npx create-expo-app` (TypeScript, Expo Router), SDK ổn định mới nhất
- [ ] Cài `@react-native-async-storage/async-storage`, `expo-speech`, `expo-document-picker`, `expo-file-system`, `expo-sharing`
- [ ] Cấu hình Jest với `jest-expo`, có 1 test mẫu chạy pass
- [ ] Đặt `scheme: "lockscreenenglish"` trong `app.json` (dùng cho deep link ở giai đoạn 2)
- [ ] Tạo khung thư mục `app/`, `src/{data,store,logic,components}` theo spec §5

## Done khi
- `npx expo start` → quét QR trên Expo Go mở được app
- `npm test` pass
EOF

issue "[P1] Định nghĩa types + bộ câu mẫu seed.json (~50 câu)" "phase-1,feature" "$M1" <<'EOF'
## Việc cần làm
- [ ] `src/types.ts`: `Phrase`, `PhraseStatus`, `AppData` đúng spec §6
- [ ] `src/data/seed.json`: khoảng 50 cụm từ/mẫu câu thông dụng (idiom, giao tiếp hằng ngày, công sở), mỗi câu có `phrase`, `meaning`, `example`, `exampleVi`, `tags`
- [ ] Mọi phần tử trong seed phải pass `validate` (issue store/validate)

## Done khi
- Seed được import và typecheck không lỗi
EOF

issue "[P1] Thuật toán chọn câu picker.ts + unit test" "phase-1,logic" "$M1" <<'EOF'
## Mô tả
Hàm thuần `pick(phrases, recentIds, random = Math.random): Phrase | null` và `markSeen(data, id)`, theo spec §7.

## Quy tắc
1. `phrases` rỗng → trả về `null`
2. Loại các câu có id nằm trong `recentIds` (tối đa 5). Nếu không còn câu nào thì dùng lại toàn bộ
3. `random() < 0.9` → chọn nhóm `learning`, ngược lại chọn `mastered`. Nhóm được chọn rỗng thì dùng nhóm còn lại
4. Trong nhóm: trọng số `1 / (1 + seenCount)`
5. `markSeen`: `seenCount++`, `lastSeenAt = now`, đẩy id vào `recentIds` (cắt còn 5)

## Test bắt buộc
- [ ] Danh sách rỗng
- [ ] Không chọn câu nằm trong recent; tất cả đều recent thì vẫn trả về một câu
- [ ] `random` cố định → nhóm đúng (0.5 → learning, 0.95 → mastered)
- [ ] Nhóm rỗng thì dùng nhóm còn lại
- [ ] `seenCount` thấp được chọn nhiều hơn (mô phỏng 10k lần)
- [ ] `markSeen` giữ `recentIds` ≤ 5
EOF

issue "[P1] Store: load/save AppData qua AsyncStorage, CRUD, migrate, xử lý JSON hỏng" "phase-1,logic" "$M1" <<'EOF'
## Mô tả
`src/store/phrases.ts`: một key duy nhất `lockscreen-english/data`, ghi lại toàn bộ JSON sau mỗi thay đổi (spec §6, §9).

## Việc cần làm
- [ ] `load()`: chưa có key → tạo từ seed; có key → `JSON.parse` + `migrate()`
- [ ] JSON hỏng → sao lưu sang `lockscreen-english/corrupt-<timestamp>`, nạp lại seed, trả về cờ cảnh báo
- [ ] `addPhrase`, `updatePhrase`, `deletePhrase`, `setStatus`, `markSeen`, `updateSettings`, `resetToSeed`
- [ ] React hook/context (ví dụ `usePhraseStore()`) để các màn hình dùng chung state
- [ ] Ghi thất bại → không mất state trong bộ nhớ, ném lỗi để UI hiện toast

## Test
- [ ] Lần đầu chạy nạp seed
- [ ] JSON hỏng → có bản sao lưu + seed
- [ ] `migrate` giữ nguyên dữ liệu version 1
- [ ] CRUD (mock AsyncStorage)
EOF

issue "[P1] Validate + logic Import/Export JSON" "phase-1,logic" "$M1" <<'EOF'
## Mô tả
`src/store/validate.ts` cùng logic import/export (spec §8).

## Việc cần làm
- [ ] `validatePhrase(x)`: `phrase` và `meaning` là chuỗi không rỗng; điền mặc định `status`, `seenCount`, `createdAt`; sinh `id` nếu thiếu
- [ ] `parseImport(text)`: nhận `{ phrases: [...] }` hoặc mảng `[...]`, trả về `{ valid, skipped }`
- [ ] `mergeImport(data, valid, mode: "merge" | "replace")`: merge thì trùng `id` ghi đè
- [ ] `buildExport(data)` → `{ version, phrases }`

## Test
- [ ] Hai dạng input đều nhận được; file không phải JSON → lỗi rõ ràng
- [ ] Bỏ qua phần tử lỗi và đếm đúng
- [ ] Merge vs replace
EOF

issue "[P1] Component PhraseCard + màn hình /lockscreen" "phase-1,ui,feature" "$M1" <<'EOF'
## Mô tả
Màn hình quan trọng nhất. Ở giai đoạn 2, native sẽ mở đúng route này (spec §4).

## Việc cần làm
- [ ] `PhraseCard`: nền tối, `phrase` cỡ chữ to; chạm để lật xem `meaning`, `example`, `exampleVi`
- [ ] Nút ✅ Đã thuộc (`mastered`, rồi chuyển câu khác) / "Chưa thuộc lắm" nếu câu đang `mastered`
- [ ] Nút ⏭️ Câu khác (dùng `pick` + `markSeen`)
- [ ] Vuốt lên hoặc nút đóng → về `/`. Gom vào một hàm `dismiss()` để giai đoạn 2 thay bằng native
- [ ] Danh sách rỗng → "Chưa có câu nào, thêm câu đi bạn ơi 🥲" + nút ➕
- [ ] Toàn màn hình, ẩn status bar

## Done khi
- Test tay trên Expo Go: lật thẻ, đánh dấu thuộc, đổi câu, vuốt đóng đều chạy
EOF

issue "[P1] Đọc phát âm (TTS) bằng expo-speech" "phase-1,feature" "$M1" <<'EOF'
## Việc cần làm
- [ ] Nút 🔊 trên thẻ đọc `phrase` (và `example` nếu đã lật) bằng giọng `en-US`
- [ ] Kiểm tra `Speech.getAvailableVoicesAsync()`: không có giọng tiếng Anh thì ẩn nút
- [ ] Bấm lại khi đang đọc → dừng rồi đọc lại
EOF

issue "[P1] Trang chủ: danh sách, tìm kiếm, lọc, thống kê" "phase-1,ui,feature" "$M1" <<'EOF'
## Việc cần làm
- [ ] `FlatList` các câu (hiện `phrase`, `meaning`, badge trạng thái)
- [ ] Ô tìm kiếm theo `phrase`/`meaning` (không phân biệt hoa thường, bỏ dấu)
- [ ] Lọc: Tất cả / Đang học / Đã thuộc
- [ ] Thống kê: "X đang học · Y đã thuộc"
- [ ] Nút ➕ → `/edit/new`; chạm vào câu → `/edit/[id]`
- [ ] Nút mở `/lockscreen` thủ công và `/settings`
EOF

issue "[P1] Màn hình thêm/sửa câu /edit/[id]" "phase-1,ui,feature" "$M1" <<'EOF'
## Việc cần làm
- [ ] Form: `phrase`*, `meaning`*, `example`, `exampleVi`, `tags` (nhập cách nhau bằng dấu phẩy)
- [ ] `id = new` → tạo mới; ngược lại → sửa
- [ ] Validate trường bắt buộc, hiện lỗi ngay dưới ô nhập
- [ ] Nút xóa (có hộp thoại xác nhận) khi đang sửa
- [ ] Lưu → quay lại danh sách
EOF

issue "[P1] Màn hình Cài đặt + UI Import/Export" "phase-1,ui,feature" "$M1" <<'EOF'
## Việc cần làm
- [ ] Công tắc "Tự hiện thẻ khi mở app" (`settings.autoShowOnOpen`)
- [ ] Export: ghi file `lockscreen-english-YYYYMMDD.json` bằng `expo-file-system`, mở share sheet bằng `expo-sharing`
- [ ] Import: `expo-document-picker` → `parseImport` → hỏi chọn Gộp hay Thay thế (thay thế phải xác nhận) → báo "Đã nhập X câu, bỏ qua Y câu lỗi"
- [ ] Khôi phục bộ câu mẫu (có xác nhận)
- [ ] Hiện cảnh báo nếu lúc load phát hiện dữ liệu hỏng
EOF

issue "[P1] Tự mở thẻ học khi app chuyển từ nền lên (giả lập lockscreen)" "phase-1,feature" "$M1" <<'EOF'
## Mô tả
Mô phỏng trải nghiệm "bật màn hình là thấy câu" ngay trên Expo Go.

## Việc cần làm
- [ ] Lắng nghe `AppState`: khi `background → active` (và lúc cold start) và `autoShowOnOpen = true` → `router.push('/lockscreen')`
- [ ] Không push thêm nếu đang ở `/lockscreen`
- [ ] Không bật khi vừa từ share sheet hoặc document picker quay về (tránh đè lên luồng import/export)
EOF

issue "[P1] QA checklist trên Expo Go (Xiaomi 15T)" "phase-1,test" "$M1" <<'EOF'
## Checklist
- [ ] Lần đầu mở có 50 câu mẫu
- [ ] Thêm / sửa / xóa câu, tắt app mở lại dữ liệu vẫn còn
- [ ] Thẻ: lật, 🔊, ✅, ⏭️, vuốt đóng
- [ ] Câu vừa hiện không lặp lại trong 5 lượt tiếp theo
- [ ] Export → Import (gộp và thay thế) trên chính máy
- [ ] Import file lỗi được báo đúng
- [ ] Chuyển ra nền rồi quay lại → tự hiện thẻ (tắt cài đặt thì không hiện)
- [ ] `npm test` pass
EOF

# ───────────────────────── PHASE 2 ─────────────────────────
issue "[P2] Cấu hình EAS Build (development + preview APK)" "phase-2,setup" "$M2" <<'EOF'
## Việc cần làm
- [ ] `eas.json`: profile `development` (`developmentClient: true`, APK) và `preview` (`buildType: apk`)
- [ ] Cài `expo-dev-client`
- [ ] Đặt `android.package` trong `app.json`
- [ ] Ghi hướng dẫn build và cài APK vào README

## Done khi
- Cài được dev build trên Xiaomi 15T và hot reload JS vẫn chạy
EOF

issue "[P2] SPIKE: kiểm chứng hiện activity đè lên màn hình khóa trên Xiaomi 15T" "phase-2,spike,native" "$M2" <<'EOF'
## Câu hỏi
Trên HyperOS (Xiaomi 15T), một foreground service bắt được `SCREEN_ON` có mở được activity với `setShowWhenLocked(true)` đè lên màn hình khóa không? Cần những quyền gì?

## Cách thử (code bỏ đi sau khi xong)
- [ ] Local module tối giản: foreground service + receiver `SCREEN_ON` → `startActivity` (deep link `lockscreenenglish://lockscreen`)
- [ ] Thử lần lượt: chưa có quyền → thêm `SYSTEM_ALERT_WINDOW` → thêm các quyền MIUI (popup nền, hiển thị trên màn hình khóa, autostart)
- [ ] Nếu thất bại: thử phương án dự phòng là notification `fullScreenIntent` (`USE_FULL_SCREEN_INTENT`)

## Kết quả cần có
Comment vào issue này: cách nào chạy được, danh sách quyền tối thiểu, độ trễ. Kết quả này quyết định cách làm các issue P2 còn lại.
EOF

issue "[P2] Native module lockscreen: foreground service + SCREEN_ON + mở /lockscreen" "phase-2,native,feature" "$M2" <<'EOF'
## Mô tả
`modules/lockscreen` (`npx create-expo-module --local`, Kotlin), theo spec §10. Làm theo kết quả của issue SPIKE.

## Việc cần làm
- [ ] Foreground service `specialUse` + notification kênh ưu tiên thấp ("Lockscreen English đang chạy")
- [ ] Đăng ký động receiver `ACTION_SCREEN_ON` → mở deep link `lockscreenenglish://lockscreen`
- [ ] Activity bật `setShowWhenLocked(true)` / `setTurnScreenOn(true)` khi mở từ đường này
- [ ] API cho JS: `isSupported()`, `start()`, `stop()`, `isRunning()`, `dismiss()` (→ `moveTaskToBack(true)`)
- [ ] Phía JS: `dismiss()` của màn `/lockscreen` gọi native nếu `isSupported()`, ngược lại `router.back()`
- [ ] Trong Expo Go / web: `isSupported() === false`, không crash
EOF

issue "[P2] Tự khởi động lại service sau khi reboot (BOOT_COMPLETED)" "phase-2,native" "$M2" <<'EOF'
## Việc cần làm
- [ ] Receiver `BOOT_COMPLETED` (+ `RECEIVE_BOOT_COMPLETED` permission)
- [ ] Chỉ khởi động service nếu người dùng đang bật tính năng (lưu cờ trong SharedPreferences)
- [ ] Test: reboot máy → bật màn hình → thẻ hiện
EOF

issue "[P2] Màn hướng dẫn cấp quyền cho Xiaomi/HyperOS" "phase-2,native,ui" "$M2" <<'EOF'
## Việc cần làm
- [ ] Native: `getPermissions()` trả trạng thái quyền overlay, notifications, battery optimization (quyền nào MIUI không cho đọc thì trả `unknown`)
- [ ] Native: `openPermissionSettings(kind)`: overlay, notifications, battery, autostart, MIUI app permission editor (`miui.intent.action.APP_PERM_EDITOR`), có fallback về App Info
- [ ] UI: danh sách từng quyền, trạng thái ✅/❓, nút "Mở cài đặt", kèm mô tả ngắn bằng tiếng Việt
- [ ] Tự kiểm tra lại khi app quay về foreground
EOF

issue "[P2] Công tắc 'Hiện trên màn hình khóa' trong Settings + QA trên thiết bị" "phase-2,feature,test" "$M2" <<'EOF'
## Việc cần làm
- [ ] Công tắc trong `/settings` (chỉ hiện khi `isSupported()`): bật → kiểm tra quyền → `start()`; tắt → `stop()`
- [ ] Khi bật native lockscreen thì tự tắt `autoShowOnOpen` (tránh hiện thẻ 2 lần)

## QA trên Xiaomi 15T (bản preview APK)
- [ ] Bật màn hình → thẻ hiện trong ≤ 1 giây, không cần mở khóa
- [ ] Vuốt → về màn hình khóa thật, mở khóa bình thường
- [ ] Dùng vài giờ, máy ngủ sâu (Doze) vẫn hoạt động
- [ ] Reboot → vẫn hoạt động
- [ ] Đang gọi điện / đang mở camera → thẻ không chen vào
EOF

echo "✅ Done: https://github.com/$REPO/issues"
