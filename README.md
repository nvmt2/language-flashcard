# Lockscreen English 📱🇬🇧

App Android (Expo / React Native) hiện **thẻ học cụm từ & mẫu câu tiếng Anh** đè lên màn hình khóa, để mỗi lần bật màn hình là học được một câu.

- Giai đoạn 1: toàn bộ tính năng chạy trên **Expo Go** (JSON + AsyncStorage, không database)
- Giai đoạn 2: native module Kotlin để hiện thẻ trên lock screen thật (Xiaomi HyperOS)

📄 Spec: [#25](https://github.com/nvmt2/language-flashcard/issues/25). Mọi tài liệu là issue có label [`documentation`](https://github.com/nvmt2/language-flashcard/issues?q=label%3Adocumentation)
🗂️ Việc cần làm: xem GitHub Issues (milestone *Phase 1* / *Phase 2*).

## Chạy thử (Phase 1)

Cần Node.js 20 trở lên và app **Expo Go** (Expo SDK 58) trên điện thoại Android.

```bash
npm install
npx expo start          # quét QR bằng Expo Go
npx expo start --web    # hoặc chạy bản web trên PC
```

| Lệnh | Ý nghĩa |
|---|---|
| `npm test` | Unit test (Jest) |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm run lint` | ESLint |

## Build APK bằng EAS (Phase 2)

Phase 2 dùng native code nên **không chạy được trên Expo Go**, phải cài bản build riêng. Build chạy trên cloud, không cần Android Studio.

```bash
npx eas-cli@latest login                                    # lần đầu
npx eas-cli@latest init                                     # lần đầu: gắn projectId vào app.json
npx eas-cli@latest build --profile development --platform android
```

1. Build xong, mở link (hoặc QR) EAS trả về trên Xiaomi 15T và tải APK về cài. Cần cho phép "Cài ứng dụng không rõ nguồn gốc".
2. Trên PC chạy `npx expo start --dev-client`, sau đó mở app *Lockscreen English* vừa cài và chọn server (hoặc quét QR).
3. Sửa code JS thì app tự reload. Chỉ cần build lại khi thêm hoặc sửa native code (thư viện native, `modules/`, `app.json`).

| Profile | Dùng để | Lệnh |
|---|---|---|
| `development` | Dev client APK, có hot reload | `npx eas-cli@latest build -p android --profile development` |
| `preview` | APK độc lập để test thật (không cần PC) | `npx eas-cli@latest build -p android --profile preview` |

## Dùng trên điện thoại (bản MVP)

```bash
npx eas-cli@latest build -p android --profile preview   # APK độc lập, không cần PC
```

1. Cài APK từ link/QR của EAS.
2. Mở app → **Cài đặt → Màn hình khóa** → bật **Hiện trên màn hình khóa**, cho phép thông báo.
3. Bấm **Mở** ở từng quyền trong danh sách (Xiaomi: *Hiển thị trên màn hình khóa*, *Mở cửa sổ khi chạy nền*, *Tự khởi động*, *Pin không giới hạn*).
4. Tắt rồi bật màn hình → thẻ học hiện ra. Vuốt lên để đóng.

**Đã biết (để sau):** trên Xiaomi 15T thẻ có thể chỉ hiện sau khi mở khóa, chưa đè lên màn hình khóa. Xem #15.

## Cấu trúc

```
src/app/            # màn hình (Expo Router): index, lockscreen, edit/[id], settings
src/components/     # PhraseCard, AutoShowLockscreen
src/store/          # PhraseStore (context), phrases (AsyncStorage + thao tác), validate (import/export)
src/logic/          # picker (chọn câu), search
src/lib/            # TTS, share/import file, dialog, cầu nối lockscreen
src/data/seed.json  # 50 câu mẫu
```

QA Phase 1: [#26](https://github.com/nvmt2/language-flashcard/issues/26)
