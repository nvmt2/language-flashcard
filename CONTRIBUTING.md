# Contributing

Mọi dev và mọi session Claude đều theo các quy tắc này. Reviewer kiểm tra tên branch, PR title và PR description trước khi approve.

## Types

Branch, commit và PR title dùng chung một danh sách type:

| Type | Dùng cho |
|------|----------|
| `feat` | Feature mới hoặc thay đổi hành vi người dùng thấy được |
| `fix` | Sửa bug |
| `docs` | Chỉ sửa tài liệu trong repo (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`...) |
| `style` | Format hoặc chỉnh giao diện, không đổi logic |
| `refactor` | Đổi code nhưng không sửa bug, không thêm feature |
| `test` | Thêm hoặc sửa test |
| `chore` | Tooling, config, dependency, EAS/`app.json`, cấu hình Claude (`.claude/`) |
| `ci` | GitHub Actions và config CI khác |

Các prefix cũ không dùng nữa: `feature/` đổi thành `feat/`. `spike/` dùng `chore/` (code thử nghiệm) hoặc `feat/` nếu được giữ lại.

## Tên branch

```
<type>/<issue>-<short-description>
```

- Viết thường, kebab-case, ví dụ `feat/24-spaced-repetition` hoặc `fix/25-card-flicker`.
- Có issue thì ghi số issue. Không có issue thì dùng `<type>/<short-description>`, ví dụ `docs/contributing`.
- Luôn tạo branch từ `staging` mới nhất.

Branch do bot tạo (`claude/...`, `dependabot/...`) được miễn.

## Luồng branch

| Branch | Vai trò |
|--------|---------|
| `staging` | Branch làm việc chung. Mọi branch feature, fix, docs... tạo từ đây và mở PR vào đây. |
| `main` | Chỉ chứa code đã release. Mỗi lần có code mới vào `main`, Expo tự build APK. Chỉ nhận PR release (nhánh `chore/release-vX.Y.Z` tạo từ `staging`, xem mục Release). Không mở PR feature thẳng vào `main`. |

```
staging ──► feat/24-spaced-repetition ──PR (squash)──► staging ──► chore/release-vX.Y.Z ──PR release (merge commit)──► main + tag vX.Y.Z
```

**Branch mặc định của repo là `staging`**: PR mới tự chọn base `staging`, và `Closes #N` tự đóng issue khi PR merge vào `staging`. Chỉ PR release mới phải chọn base `main` (`gh pr create --base main`).

Repo bật **Automatically delete head branches**: sau khi PR merge, GitHub tự xóa branch nguồn (head) của PR, không bao giờ xóa branch đích (base). Vì vậy **không bao giờ dùng `staging` làm head của PR**, nếu không `staging` sẽ bị xóa. Lỡ bị xóa thì bấm **Restore branch** trong trang PR đã merge.

Branch đã merge thì không commit tiếp lên nó. Việc mới luôn là branch mới từ `staging`.

## Tài liệu

Tài liệu dự án (spec, thiết kế, kế hoạch, checklist QA, ghi chú quyết định) **không lưu trong repo**, không dùng thư mục `docs/`. Mỗi tài liệu là một GitHub issue:

- Title bắt đầu bằng `[Docs]`, ví dụ `[Docs] Spec: Lockscreen English – thiết kế`. Gắn label `documentation`, thêm label phase hoặc vùng liên quan nếu có.
- Nội dung issue là bản chính. Sửa tài liệu thì sửa trực tiếp nội dung issue, không tạo bản mới. Thay đổi lớn thì thêm comment ghi ngắn gọn đã đổi gì.
- Tài liệu còn dùng (spec, kiến trúc) thì để **mở**. Tài liệu chỉ còn giá trị lưu trữ (QA của phase đã xong) thì **đóng** với lý do *completed*.
- Issue công việc và PR liên kết tới issue tài liệu bằng `#<number>`.
- Trong repo chỉ giữ tài liệu cần đi cùng code: `README.md` (cách chạy, build, cài đặt, cấu trúc thư mục), `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`.

Tài liệu hiện có:

| Issue | Nội dung |
|-------|----------|
| #25 | Spec thiết kế: kiến trúc, data model, native module, quyền Xiaomi |
| #26 | QA Phase 1 (đã đóng) |

## Commit message

Theo [Conventional Commits](https://www.conventionalcommits.org), viết bằng tiếng Anh:

```
<type>(<optional-scope>): <subject>

<optional body: what changed and why>
```

- Subject viết ở thể mệnh lệnh (`add`, không phải `added`), bắt đầu bằng chữ thường, không có dấu chấm cuối, cả dòng đầu tối đa 72 ký tự.
- Scope là vùng code đã sửa, viết thường kebab-case. Scope thường dùng trong repo này:

  | Scope | Vùng code |
  |-------|-----------|
  | `card` | Thẻ học: `src/app/lockscreen.tsx`, `PhraseCard`, `AutoShowLockscreen`, `LockedRouteGuard` |
  | `native` | Native module Kotlin `modules/lockscreen`, `src/lib/lockscreenBridge.ts` |
  | `home` | Trang chủ, tìm kiếm, lọc (`src/app/index.tsx`, `src/logic/search.ts`) |
  | `editor` | Thêm/sửa/xóa câu (`src/app/edit/`) |
  | `settings` | Màn cài đặt, `LockscreenSettings` |
  | `store` | `src/store/`, `src/types.ts`, AsyncStorage, migrate |
  | `picker` | Thuật toán chọn câu (`src/logic/picker.ts`) |
  | `import` | Xuất/nhập JSON (`src/store/validate.ts`, `src/lib/transfer.ts`) |
  | `speech` | Đọc phát âm (`src/lib/useSpeech.ts`) |
  | `data` | Bộ câu mẫu `src/data/seed.json`, file nhập `data/*.json` |
  | `build` | `app.json`, `eas.json`, config plugin |
  | `claude` | `.claude/`, `CLAUDE.md`, `AGENTS.md` |

- Thêm `!` sau type hoặc scope nếu là breaking change, ví dụ `feat(store)!: rename phrase.meaning to phrase.translation`. Đổi cấu trúc dữ liệu lưu trong AsyncStorage hoặc format file JSON nhập/xuất luôn là breaking change và phải có migrate.

Ví dụ:

```
feat(card): show the next phrase as soon as the screen turns on
fix(native): revoke show-when-locked after the card is dismissed
refactor(store): extract AsyncStorage keys into constants
docs: add CONTRIBUTING with branch, commit and PR conventions
chore(build): add preview profile to eas.json
```

## Pull request

- **Base branch:** `staging`. Chỉ PR release mới có base là `main`.
- **Title:** theo format commit message ở trên. PR được squash-merge, nên title sẽ thành commit trên `staging`.
- **Description:** theo [PR template](.github/pull_request_template.md): `Why`, `Summary`, `Scope impacted`, `Evidence`, `How to test` và `Refer`. Không xóa các heading. Không thêm chữ ký hay footer tự sinh (ví dụ "🤖 Generated with Claude Code" hoặc link session Claude) vào description.
- **Scope impacted:** liệt kê ngắn gọn để QA biết cần test gì, gồm 3 dòng `Page`, `Behavior`, `Feature`. Ghi page (màn hình trong app: Thẻ học, Màn hình khóa, Trang chủ, Thêm/sửa câu, Cài đặt), behavior (hành vi thay đổi) và feature liên quan. Không ảnh hưởng gì khác thì ghi "Không có". Ví dụ:
  ```
  - Page: Thẻ học (trên màn hình khóa)
  - Behavior: thẻ hiện ngay khi bật màn hình, không còn nhá nền tối
  - Feature: Hiện trên màn hình khóa, Tự hiện thẻ khi mở app
  ```
- **Summary:** chỉ tóm tắt PR thay đổi những gì, mỗi ý một dòng ngắn, thường 2 đến 4 gạch đầu dòng. Mỗi dòng ghi tên file chính bị thay đổi và nói ngắn gọn nó thay đổi gì. Không liệt kê chi tiết nội dung bên trong file, vì reviewer cần chi tiết thì sẽ đọc file đó. Nếu có phần cố ý không làm, ghi kèm lý do. Ví dụ:

  ```
  - `CONTRIBUTING.md`: thêm convention đặt tên cho branch, commit và PR.
  - `.github/pull_request_template.md`: thêm PR template để dev và Claude tham khảo.
  - `AGENTS.md`: trỏ tới `CONTRIBUTING.md`.
  - Không bật branch protection vì chưa cần.
  ```

- **Evidence:** chứng minh thay đổi chạy đúng. Tối thiểu dán kết quả `npm test`, `npm run typecheck` và `npm run lint`. Thay đổi UI thì kèm screenshot hoặc video. Sửa native code (`modules/`), `app.json` hoặc thêm thư viện native thì phải build bằng EAS và test trên điện thoại thật (Xiaomi 15T), ghi rõ profile đã build. Bước nào không kiểm tra thì ghi rõ và nói lý do.
- **Refer:** ghi `Closes #<number>` nếu PR hoàn thành issue, `Refs #<number>` nếu chỉ liên quan. Không có issue thì xóa dòng đó. Xem mục Đóng issue.
- **Tài liệu:** đổi kiến trúc, data model, luồng dữ liệu hoặc native module thì cập nhật issue spec (#25). Checklist test trên máy thì tạo issue `[Docs] QA ...`. Đổi cách chạy, build, cài đặt hoặc cấu trúc thư mục thì cập nhật `README.md`. Xem mục Tài liệu.
- **Kích thước:** mỗi PR chỉ một feature hoặc một fix. Thay đổi không liên quan thì tách PR riêng.

## Đóng issue

- **Issue công việc** (feature, bug, chore…) đóng khi PR làm xong việc của nó **merge vào `staging`**. PR ghi `Closes #<number>` thì GitHub tự đóng, không cần đóng tay. Mỗi issue một dòng `Closes` riêng, ví dụ `Closes #3, Closes #4`.
- Nếu issue còn bước chưa làm được trong PR (ví dụ test trên Xiaomi 15T sau khi có APK), PR ghi `Refs #<number>` và để issue mở. Khi bước còn lại xong thì comment kết quả rồi đóng tay với lý do *completed*.
- Issue không làm nữa thì đóng với lý do *not planned* và comment ngắn lý do.
- **Issue tài liệu `[Docs]`** đóng theo mục Tài liệu: còn dùng thì để mở, chỉ còn giá trị lưu trữ thì đóng.

## Versioning

Dùng [Semantic Versioning](https://semver.org/lang/vi/): `MAJOR.MINOR.PATCH`.

- Version nằm ở 2 chỗ và phải luôn giống nhau: field `version` trong `package.json` và `expo.version` trong `app.json` (version người dùng thấy trên điện thoại). Git tag là `v` + version, ví dụ `v1.1.0`. Mã build Android (`versionCode`) do EAS tự quản lý (`appVersionSource: remote`), không sửa tay.
- Repo đã ở `1.x.y`, nên:
  - Breaking change (`!`) → tăng `MAJOR`.
  - `feat` → tăng `MINOR`, reset `PATCH` về 0.
  - `fix` và các type còn lại → tăng `PATCH`.
- Mức tăng được quyết định theo commit có mức cao nhất kể từ tag trước.

## Release

Chỉ release khi chủ repo quyết định. Trước đó mọi thay đổi chỉ nằm trên `staging`.

1. **Tính version mới** theo mục Versioning, dựa trên các commit trên `staging` kể từ tag trước.
2. **Mở PR bump version vào `staging`** với title `chore: bump version to X.Y.Z`. PR chỉ đổi version trong `package.json`, `package-lock.json` (chạy `npm version X.Y.Z --no-git-tag-version`) và `expo.version` trong `app.json`. Theo đúng Pull request ở trên.
3. **Mở PR release vào `main`** với title `chore: release vX.Y.Z`. Head của PR là nhánh `chore/release-vX.Y.Z` trỏ đúng commit mới nhất của `staging`, **không dùng `staging` làm head** (xem mục Luồng branch):
   ```
   git fetch origin
   git push origin origin/staging:refs/heads/chore/release-vX.Y.Z
   gh pr create --base main --head chore/release-vX.Y.Z --title "chore: release vX.Y.Z"
   ```
   Merge bằng **Create a merge commit**, không squash, để `main` giữ đủ từng commit của `staging`. GitHub tự xóa `chore/release-vX.Y.Z` sau khi merge.
4. **Sau khi PR release được merge**, tạo annotated tag `vX.Y.Z` trên merge commit ở `main` và tạo GitHub Release cùng tên tag.
5. **Lấy link APK:** Expo đã cấu hình build trigger trên `main`, nên khi PR release merge vào `main` thì EAS **tự build**, không chạy build tay. Vào expo.dev → project `language-flashcard` → Builds, chờ build của merge commit đó xong rồi dán link vào GitHub Release. Build lỗi thì sửa bằng PR `fix` vào `staging` rồi release bản PATCH, không push thẳng lên `main`.
6. **Release notes** ngắn, mỗi mục một dòng, gom theo nhóm:
   - `Tính năng mới`: các commit `feat`.
   - `Sửa lỗi`: các commit `fix`.
   - `Thay đổi phá vỡ`: các commit có `!`. Nêu rõ người dùng hoặc dữ liệu bị ảnh hưởng và cách xử lý (ví dụ: xuất JSON sao lưu trước khi cập nhật).
   - `Đang làm / dự kiến`: lấy từ các issue đang mở nếu cần.

## Làm việc với Claude

Claude đọc file này qua `AGENTS.md`. Khi nhờ Claude tạo branch, commit hay mở PR (ví dụ "commit giúp tôi", "mở PR cho thay đổi này"), Claude phải theo đúng các quy tắc trên.

Skill nào mặc định ghi spec hoặc plan ra file (ví dụ `superpowers:brainstorming` ghi vào `docs/superpowers/specs/`, `superpowers:writing-plans` ghi vào `docs/superpowers/plans/`) thì Claude tạo hoặc cập nhật issue `[Docs]` thay vì ghi file vào repo.
