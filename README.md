# Lockscreen English 📱🇬🇧

App Android (Expo / React Native) hiện **thẻ học cụm từ & mẫu câu tiếng Anh** đè lên màn hình khóa, để mỗi lần bật màn hình là học được một câu.

- Giai đoạn 1: toàn bộ tính năng chạy trên **Expo Go** (JSON + AsyncStorage, không database)
- Giai đoạn 2: native module Kotlin để hiện thẻ trên lock screen thật (Xiaomi HyperOS)

📄 Spec: [#25](https://github.com/nvmt2/language-flashcard/issues/25). Mọi tài liệu là issue có label [`documentation`](https://github.com/nvmt2/language-flashcard/issues?q=label%3Adocumentation)
🗂️ Việc cần làm: xem GitHub Issues (milestone *Phase 1* / *Phase 2*).
🎨 Prototype bấm thử được (để trình bày với khách hàng): [Lockscreen English – Prototype](https://claude.ai/artifact/LxnvVpQWq2AVapiWW2SHWw). Gồm thẻ học, màn chính, hộp thư từ PC, cài đặt và thêm câu; dữ liệu mẫu, không gọi mạng.

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

## Hộp thư từ PC

Gửi từ mới từ PC (app bôi đen có AI) vào một **hộp thư chung** trên MockAPI, rồi chọn từ cần học ở màn **📥 Hộp thư** trên điện thoại. Thiết kế: [#29](https://github.com/nvmt2/language-flashcard/issues/29).

### 1. Tạo hộp thư trên MockAPI

1. Tạo project trên mockapi.io, rồi tạo resource tên **`inbox`**.
2. Schema: `phrase`, `meaning`, `example`, `exampleVi` (String), `tags` (Array), `createdAt` (Date). Xóa các field mẫu khác (`name`, `avatar`…) và **bỏ generator Faker của `createdAt`**, nếu không MockAPI sẽ tự điền ngày ngẫu nhiên khi thiếu.
3. Không tạo bản ghi mẫu. URL của hộp thư có dạng `https://<project-id>.mockapi.io/api/v1/inbox`.

⚠️ Ai có URL là đọc, ghi, xóa được hộp thư. Repo này public: **không dán URL vào code, issue hay PR**.

### 2. Gửi từ từ PC

App bôi đen gửi `POST <URL>` với body JSON theo [hợp đồng ở #29, mục 3](https://github.com/nvmt2/language-flashcard/issues/29): `phrase` và `meaning` bắt buộc; `example`, `exampleVi`, `tags` tùy chọn; nên có `createdAt` (ISO 8601) để chia nhóm Hôm nay / Cũ hơn.

```bash
curl -X POST "$INBOX_URL" -H "Content-Type: application/json" -d '{"phrase":"ubiquitous","meaning":"có mặt ở khắp nơi","createdAt":"2026-11-09T03:00:00Z"}'
```

### 3. Cấu hình URL cho app

App lấy URL theo thứ tự: **URL nhập trong app** (Cài đặt → Hộp thư từ PC) → **`EXPO_PUBLIC_INBOX_URL` lúc build** → chưa có thì màn Hộp thư hiện form để dán URL.

- **Chạy local:** tạo file `.env.local` (đã được git ignore) rồi chạy lại `npx expo start`:
  ```
  EXPO_PUBLIC_INBOX_URL=https://<project-id>.mockapi.io/api/v1/inbox
  ```
  Không đặt trong `.env` (cũng đã ignore, nhưng `.env.local` là chỗ dành cho giá trị riêng của máy bạn).
- **Build EAS:** lưu biến trên EAS một lần, mỗi lần build sẽ tự nạp. Profile `development` đọc env `development`, `preview` đọc `preview`, `production` đọc `production`:
  ```bash
  npx eas-cli@latest env:set --name EXPO_PUBLIC_INBOX_URL --value "https://<project-id>.mockapi.io/api/v1/inbox" --visibility sensitive --environment development --environment preview --environment production
  ```
  Dùng visibility `sensitive` hoặc `plaintext`. Biến `secret` **không** được nạp vào bản build.

⚠️ Biến `EXPO_PUBLIC_*` được nhúng thẳng vào APK. Không đưa APK lên chỗ công khai.

## Cấu trúc

```
src/app/            # màn hình (Expo Router): index, lockscreen, edit/[id], settings, inbox
src/components/     # PhraseCard, AutoShowLockscreen, InboxUrlForm
src/store/          # PhraseStore (context), phrases (AsyncStorage + thao tác), validate (import/export)
src/logic/          # picker (chọn câu), search, inbox (chia nhóm, lọc trùng từ hộp thư)
src/lib/            # TTS, share/import file, dialog, cầu nối lockscreen, client hộp thư MockAPI
src/data/seed.json  # 50 câu mẫu
```

QA Phase 1: [#26](https://github.com/nvmt2/language-flashcard/issues/26)
