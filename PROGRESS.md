# Tiến Độ Triển Khai Dự Án (PROGRESS.md)

Tài liệu theo dõi quá trình thực hiện tuần tự các bước trong **Thứ tự thực hiện** của dự án Web ôn thi kiểu Duolingo.

---

## Trạng thái tổng quan

- [x] **Bước 1**: Khởi tạo monorepo: Spring Boot + Postgres (docker-compose) + Flyway schema; React + Vite + Tailwind; đăng nhập bằng mật khẩu.
- [x] **Bước 2**: Entity + SRS service + JUnit test (Seed 20 Item mẫu).
- [ ] **Bước 3**: API phiên học (today / answer / finish) và màn hình phiên học: thẻ giới thiệu, trắc nghiệm, hàng đợi lặp lại, màn kết quả.
- [ ] **Bước 4**: XP, streak, mục tiêu ngày, trang chủ, thống kê cơ bản.
- [ ] **Bước 5**: Đường học (Unit/Section/Lesson), lịch, thuật toán xếp lịch và dồn lịch.

---

## Chi tiết các bước thực hiện

### Bước 1: Khởi tạo monorepo & Xác thực mật khẩu
- **Đã làm**:
  - Cấu hình monorepo `/backend` và `/frontend`.
  - Cấu hình `docker-compose.yml` chạy PostgreSQL 16 Alpine cô lập.
  - Viết schema Flyway `V1__init_schema.sql` cho 8 bảng: `courses`, `units`, `sections`, `lessons`, `items`, `item_states`, `review_logs`, `profiles`.
  - Cài đặt cơ chế đăng nhập một người dùng qua mật khẩu `APP_PASSWORD`, thiết lập session cookie `HttpOnly + SameSite=Lax`.
  - Giới hạn thử sai mật khẩu tối đa 5 lần/phút (`LoginRateLimiter`).
  - Viết bộ kiểm thử `AuthControllerTest` kiểm tra đăng nhập đúng, sai, rate limit và trạng thái xác thực.
- **Giả định**:
  - Dùng mật khẩu dev mặc định `studyapp123` khi chưa truyền `APP_PASSWORD`.
  - Chạy profile `test` dùng H2 in-memory để kiểm thử nhanh và độc lập mà không bắt buộc Docker phải bật sẵn.
- **Kết quả test**: Pass 4/4 test.

---

### Bước 2: JPA Entities + Thuật Toán SRS SM-2 + 20 Item Mẫu
- **Đã làm**:
  - Xây dựng 8 JPA Entity chuẩn xác theo SPEC mục 4: `Course`, `Unit`, `Section`, `Lesson`, `Item`, `ItemState`, `ReviewLog`, `Profile`.
  - Viết 8 Spring Data JPA Repository.
  - Cài đặt `SrsService` theo thuật toán SuperMemo SM-2 rút gọn:
    + Thang điểm `quality`: sai = 0; đúng >15s = 3; đúng = 4; đúng <5s = 5.
    + Thất bại lần đầu khi chưa học (`introduced = false`) không tính là `lapse`.
    + Chu kỳ tăng dần: 1 ngày -> 3 ngày -> `round(intervalDays * ease)`.
    + Hệ số dễ `ease` sàn tối thiểu 1.3.
    + Tự động kéo ngày ôn `dueAt` về trước ngày thi nếu vượt quá ngày thi.
    + Ghi log mọi lượt ôn tập vào `ReviewLog`.
  - Viết bộ kiểm thử `SrsServiceTest` bao quát toàn bộ các ca kiểm thử thuật toán SM-2.
  - Viết `DataSeeder` tự động nạp 20 Item mẫu chất lượng cao chia thành 3 bài học thuộc 2 chương.
- **Kết quả test**: Pass 6/6 test SRS (Tổng cộng 10/10 test pass).
