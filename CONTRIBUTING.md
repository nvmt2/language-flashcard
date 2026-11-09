# Contributing

Quy ước làm việc cho repo này. Áp dụng cho cả người lẫn AI agent (Claude Code, Codex…).

## 1. Tài liệu đặc tả nằm trên GitHub Issues, không nằm trong repo

**Mọi spec, thiết kế, kết quả brainstorming đều là một GitHub Issue.** Không tạo file spec trong `docs/` hay bất kỳ thư mục nào của repo.

Lý do: issue có lịch sử chỉnh sửa, bình luận, liên kết với PR và hiện trên board. File trong repo dễ bị bỏ quên và lệch với thực tế.

### Quy ước cho issue spec

| Mục | Quy ước |
|---|---|
| Tiêu đề | `[Docs] Spec: <Tên tính năng> – <mô tả ngắn>` |
| Label | `documentation` |
| Dòng đầu tiên | `> Issue này là **bản chính của spec**. Sửa thiết kế thì sửa trực tiếp nội dung issue (xem CONTRIBUTING.md).` |
| Trạng thái | Ghi trong phần đầu: `Nháp` → `Đã duyệt (brainstorming)` |
| Ngôn ngữ | Tiếng Việt (giữ nguyên tên code, field, lệnh) |

**Khung nội dung gợi ý** (bỏ mục không cần):

1. Mục tiêu: bối cảnh, nguyên tắc, tiêu chí thành công
2. Phạm vi: trong phạm vi / ngoài phạm vi
3. API hoặc mô hình dữ liệu
4. Luồng sử dụng / màn hình
5. Cấu hình
6. Cấu trúc code: file mới, file sửa
7. Xử lý lỗi
8. Kiểm thử: unit test và thử tay trên thiết bị
9. Rủi ro và điều chưa kiểm chứng
10. Quyết định đã chốt (bảng câu hỏi → quyết định)

Ví dụ: #25 (spec gốc của app), #29 (PC Inbox).

### Sửa spec

- Sửa **trực tiếp nội dung issue**. Không tạo issue mới cho mỗi lần đổi ý.
- Thay đổi lớn thì để lại một comment tóm tắt "đổi gì, vì sao" để giữ lịch sử quyết định.

### Các loại tài liệu khác

| Loại | Đặt ở đâu | Tiêu đề / label |
|---|---|---|
| Spec, thiết kế | Issue | `[Docs] Spec: …` · `documentation` |
| Báo cáo QA, checklist kiểm thử | Issue | `[Docs] QA …` · `documentation`, `test` |
| Việc cần làm (task) | Issue, liên kết tới issue spec | `[P<giai đoạn>] …` hoặc tên tính năng · label theo loại việc |
| Hướng dẫn chạy, build, cấu hình | `README.md` | — |
| Quy ước làm việc | `CONTRIBUTING.md`, `AGENTS.md` | — |

`README.md` chỉ **link** tới issue spec, không chép lại nội dung spec.

## 2. Từ spec tới code

1. Brainstorm → chốt thiết kế → tạo issue spec.
2. Chia việc thành các issue task (có thể là sub-issue của issue spec). Mỗi task ghi rõ: làm gì, file nào, tiêu chí xong.
3. Mỗi PR ghi `Closes #<task>` và nhắc tới issue spec liên quan.
4. Code làm thay đổi thiết kế thì cập nhật issue spec **trong cùng lúc** với PR.

## 3. Trước khi mở PR

```bash
npm test
npm run typecheck
npm run lint
```

Code đụng tới API của Expo / EAS / React Native thì đối chiếu docs đúng phiên bản SDK trước (xem `AGENTS.md`).
