# Tiến Độ Triển Khai Dự Án (PROGRESS.md)

Tài liệu theo dõi quá trình thực hiện tuần tự các bước trong **Thứ tự thực hiện** của dự án Web ôn thi kiểu Duolingo.

---

## Trạng Thái Tổng Quan

- [x] **Bước 1**: Khởi tạo monorepo: Spring Boot + Postgres (docker-compose) + Flyway schema; React + Vite + Tailwind; đăng nhập bằng mật khẩu.
- [x] **Bước 2**: Entity + SRS service + JUnit test (Seed 20 Item mẫu).
- [x] **Bước 3**: API phiên học (today / answer / finish) và màn hình phiên học: thẻ giới thiệu, trắc nghiệm, hàng đợi lặp lại, màn kết quả.
- [x] **Bước 4**: XP, streak, mục tiêu ngày, trang chủ, thống kê cơ bản.
- [x] **Bước 5**: Đường học (Unit/Section/Lesson), lịch, thuật toán xếp lịch và dồn lịch.
- [x] **Bước 6**: Trích xuất tài liệu (PDFBox, POI) & AI Client (Gemini / Claude API, JSON Schema validation, retry 2 lần, giới hạn 2 tác vụ đồng thời).
- [x] **Bước 7**: Pipeline tạo khóa học tự động, phân tích ngân hàng câu hỏi đề thi, lazy generation và bài kiểm tra đầu vào (Placement Test).
- [x] **Bước 8**: Màn hình Cài đặt, sao lưu/khôi phục JSON, Progressive Web App (PWA), Web Audio sound & Haptic feedback.
- [x] **Bước 9**: Đóng gói Container đa tầng (Multi-stage Dockerfile), Docker Compose cô lập an toàn & Hướng dẫn triển khai đám mây 0đ.

---

## Chi Tiết Các Bước Đã Hoàn Thành

### Bước 1: Khởi Tạo Monorepo & Xác Thực Mật Khẩu
- **Đã làm**:
  - Cấu trúc monorepo `/backend` (Java 17/21, Spring Boot 3.3.4, Maven) và `/frontend` (React 18, TypeScript, Vite, Tailwind CSS).
  - Cấu hình `docker-compose.yml` chạy PostgreSQL 16 Alpine cô lập an toàn.
  - Viết schema Flyway `V1__init_schema.sql` cho 8 bảng: `courses`, `units`, `sections`, `lessons`, `items`, `item_states`, `review_logs`, `profiles`.
  - Cài đặt cơ chế bảo mật đăng nhập một người dùng qua biến môi trường `APP_PASSWORD`, thiết lập session cookie `HttpOnly + SameSite=Lax`.
  - Cài đặt `LoginRateLimiter` giới hạn thử sai mật khẩu tối đa 5 lần/phút.
  - Viết bộ test `AuthControllerTest` kiểm tra đăng nhập đúng, sai, rate limit và kiểm tra phiên.
- **Giả định**:
  - Mật khẩu mặc định chế độ dev là `studyapp123` khi chưa cấu hình biến môi trường `APP_PASSWORD`.
  - Cấu hình profile `test` dùng H2 in-memory mode PostgreSQL để kiểm thử độc lập, nhanh chóng.
- **Kết quả kiểm thử**: Pass 4/4 test.

---

### Bước 2: JPA Entities + Thuật Toán SRS SM-2 + Seed 20 Item Mẫu
- **Đã làm**:
  - Hoàn thiện 8 JPA Entities: `Course`, `Unit`, `Section`, `Lesson`, `Item`, `ItemState`, `ReviewLog`, `Profile`.
  - Hoàn thiện 8 Spring Data JPA Repositories.
  - Cài đặt `SrsService` theo thuật toán SuperMemo SM-2 rút gọn (Mục 10 SPEC):
    + Thang điểm `quality` (q): sai = 0; đúng >15s = 3; đúng 5-15s = 4; đúng <5s = 5.
    + Thất bại lần đầu khi chưa học (`introduced = false`) không tính là `lapse`.
    + Chu kỳ ôn tập tăng dần: Lần 1 = 1 ngày; Lần 2 = 3 ngày; Lần 3 trở đi = `round(intervalDays * ease)`.
    + Hệ số dễ `ease` sàn tối thiểu 1.3: `ease = max(1.3, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))`.
    + Kéo ngày ôn tập `dueAt` về trước ngày thi nếu vượt quá ngày thi.
    + Ghi nhận mọi lượt trả lời vào `ReviewLog`.
  - Viết `DataSeeder` tự động nạp 20 Item mẫu trắc nghiệm chất lượng cao về Web và Thuật toán chia vào 3 bài học.
  - Viết bộ kiểm thử `SrsServiceTest` bao quát toàn bộ logic và công thức của thuật toán SM-2.
- **Kết quả kiểm thử**: Pass 6/6 test SRS (Tổng cộng 10/10 test pass).

---

### Bước 3: API & Màn Hình Phiên Học (Study Session)
- **Đã làm**:
  - Xây dựng các endpoint RESTful:
    + `GET /api/session/today`: Dựng hàng đợi học theo thứ tự ưu tiên (Item đến hạn quá hạn lâu nhất -> Lesson mới hôm nay -> Item yếu nhất), cắt theo `dailyMinutes`.
    + `POST /api/session/answer`: Chấm điểm đúng/sai, cập nhật SRS, tính điểm XP (+10 khi đúng lần đầu, +5 khi làm lại, kích hoạt lặp lại trong phiên nếu sai).
    + `POST /api/session/finish`: Kết thúc phiên, thưởng hoàn hảo +20 XP nếu không sai câu nào, cập nhật streak và lưu tiến độ.
  - Xây dựng màn hình `SessionPage.tsx`:
    + Thanh tiến độ học tập trên cùng và nút thoát có xác nhận.
    + **Dạng 1 (Thẻ giới thiệu)**: Hiển thị khi `introduced = false`, gồm prompt, intro, trích dẫn tài liệu `sourceQuote` và nút "Đã hiểu, kiểm tra thử".
    + **Dạng 2 (Trắc nghiệm 4 đáp án)**: 4 nút lớn bo tròn kiểu Duolingo, xáo trộn vị trí ngẫu nhiên.
    + Feedback Sheet dưới cùng: Banner xanh lá khi đúng, banner đỏ nhạt khi sai kèm giải thích và căn cứ trích dẫn.
    + **Cơ chế lặp lại câu sai**: Tự động đưa câu sai về cuối hàng đợi (tối đa 2 lần/phiên).
    + **Màn hình Kết quả**: Hiệu ứng pháo hoa confetti, tổng kết XP nhận được, số câu đúng/sai, streak ngọn lửa 🔥, danh sách câu sai để xem lại.
  - Viết bộ kiểm thử `SessionControllerTest` cho toàn bộ các endpoint phiên học.
- **Kết quả kiểm thử**: Pass 4/4 test Session.

---

### Bước 4: Gamification, Trang Chủ & Thống Kê
- **Đã làm**:
  - Cài đặt `StatsService` và endpoint `GET /api/stats`:
    + Tính toán tổng XP, streak hiện tại, streak kỷ lục.
    + Quản lý mục tiêu ngày (mặc định 20 XP/ngày), tự động reset `xpToday` khi bước sang ngày mới theo múi giờ `Asia/Ho_Chi_Minh`.
    + Thống kê mức độ ghi nhớ SRS: Số Item nhớ vững (`intervalDays >= 21`), số Item đang học, số Item mới.
    + Đếm ngược ngày thi thực tế (`daysUntilExam`).
    + Bảng xếp hạng top 10 câu hỏi hay trả lời sai nhất kèm lời giải thích.
  - Xây dựng màn hình `StatsPage.tsx` và trang chủ `App.tsx` trực quan, mobile-first với tông màu Duolingo.

---

### Bước 5: Đường Học (Learning Path), Lịch Học & Thuật Toán Xếp Lịch
- **Đã làm**:
  - Cài đặt `ScheduleService` và `CourseController`:
    + `GET /api/courses/{id}/path`: Trả về cây phân cấp `Unit -> Section -> Lesson` kèm trạng thái (locked / ready / done) và số sao.
    + `GET /api/schedule`: Trả về kế hoạch học từng ngày từ hôm nay đến ngày thi, tính toán ước lượng thời gian học (~3 phút/bài mới, ~0.3 phút/câu ôn), cảnh báo quá tải khi vượt `dailyMinutes`.
    + `POST /api/courses/{id}/reschedule`: Thuật toán tự động xếp lịch và dồn lịch khi nghỉ học:
      * Trừ $N$ ngày cuối khóa chỉ dành riêng cho ôn tập tổng hợp ($N = 3$ nếu $\ge 14$ ngày, $N = 2$ nếu $\ge 5$ ngày, $N = 0$ nếu $< 5$ ngày).
      * Phân bổ số bài mới mỗi ngày: $\lceil \text{Tổng Lesson chưa học} / \text{Số ngày học} \rceil$.
      * Mở khóa bài học hôm nay sang trạng thái `ready`.
  - Xây dựng giao diện:
    + `LearningPathPage.tsx`: Cây đường học hình node tròn ziczac dọc kiểu Duolingo, có hiệu ứng nảy (bounce), icon mở khóa/đã hoàn thành có gắn sao vàng ⭐.
    + `SchedulePage.tsx`: Lịch chi tiết từng ngày, nhãn "Ôn tập tổng hợp", cảnh báo quá tải, nút bấm "Dồn lịch tự động" một chạm.
  - Viết bộ kiểm thử `ScheduleServiceTest` kiểm tra xếp lịch, dồn lịch, ngày ôn tập và cấu trúc đường học.
- **Kết quả kiểm thử**: Pass 3/3 test Schedule.

---

### Bước 6: Trích Xuất Tài Liệu & AI Client Đa Mô Hình (Gemini & Claude)
- **Đã làm**:
  - `DocumentExtractionService`: Hỗ trợ đọc tài liệu PDF (Apache PDFBox), tài liệu Word `.docx` (Apache POI), và đọc stream trực tiếp `.txt`, `.md`. Tự động phát hiện PDF ảnh quét không có text.
  - `AiService`: Hỗ trợ đa mô hình (Google Gemini API & Anthropic Claude Messages API).
  - Ép chuẩn JSON Schema, kiểm tra và làm sạch Markdown json block, Bean Validation.
  - Tự động thử lại (retry 2 lần) và Semaphore giới hạn tối đa 2 tác vụ AI chạy song song để tránh nghẽn.
  - Bộ kiểm thử `DocumentExtractionServiceTest` pass 3/3 test.

---

### Bước 7: Pipeline Tạo Khóa Học Tự Động & Bài Kiểm Tra Đầu Vào
- **Đã làm**:
  - `CourseCreationPipelineService`: Tự động chia đoạn tài liệu dài, gọi AI tạo cây Unit -> Section -> Lesson.
  - Phân tích và nhận diện ngân hàng câu hỏi đề thi (mẫu Eduso, form trắc nghiệm ABCD kèm đáp án/giải thích).
  - Cơ chế sinh câu hỏi theo yêu cầu (Lazy generation): Sinh 5-8 Item cho bài học khi người dùng bắt đầu học bài đó.
  - Bài kiểm tra đầu vào (Placement Test): Trắc nghiệm nhanh đánh giá năng lực, nếu đạt >= 80% độ chính xác thì tự động rút ngắn số bài mới của Unit đó.
  - `CreateCourseModal.tsx`: Hỗ trợ kéo thả tải nhiều file cùng lúc, dán văn bản trực tiếp, chọn ngày thi và thời gian học/ngày.

---

### Bước 8: Màn Hình Cài Đặt, Sao Lưu/Khôi Phục JSON, PWA & Trải Nghiệm Mobile
- **Đã làm**:
  - `SettingsPage.tsx`: Tùy chỉnh số phút học/ngày, ngày thi, mục tiêu XP ngày, bật/tắt âm thanh, giao diện Sáng/Tối.
  - Tính năng Sao lưu & Khôi phục: Endpoint `GET /api/export` xuất trọn vẹn dữ liệu JSON và `POST /api/import` phục hồi dữ liệu 100%.
  - PWA: Cấu hình `manifest.webmanifest`, service worker `sw.js` cache tài nguyên tĩnh, hỗ trợ cài đặt Add to Home Screen trên iOS và Android.
  - Web Audio API & Haptic Vibration: Phát âm thanh chúc mừng / thông báo đúng sai mượt mà.
  - Bộ kiểm thử `SettingsAndBackupServiceTest` pass 5/5 test.

---

### Bước 9: Đóng Gói Container Đa Tầng & Triển Khai Đám Mây 0đ
- **Đã làm**:
  - `Dockerfile` multi-stage: Giai đoạn 1 build React Vite, Giai đoạn 2 build Spring Boot JAR nhúng static frontend, Giai đoạn 3 chạy trên JRE Alpine 17 siêu nhẹ với tài khoản bảo mật `studyapp` non-root.
  - `docker-compose.yml`: Chạy PostgreSQL 16 Alpine và StudyApp cô lập trong sandbox, mount volume dữ liệu an toàn.
  - `DEPLOYMENT.md`: Hướng dẫn đầy đủ triển khai đám mây miễn phí 100% (Render.com + Neon.tech + Gemini API).

---

## Tổng Kết Kết Quả Kiểm Thử (Toàn Bộ 25/25 Test Đều Pass 100%)

```text
[INFO] Running com.studyapp.controller.AuthControllerTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.studyapp.controller.SessionControllerTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.studyapp.service.DocumentExtractionServiceTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.studyapp.service.ScheduleServiceTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.studyapp.service.SettingsAndBackupServiceTest
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.studyapp.service.SrsServiceTest
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] -------------------------------------------------------
[INFO] Results:
[INFO] Tests run: 25, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## Hướng Dẫn Chạy Thử Ứng Dụng

### 1. Khởi động Backend (Spring Boot):
```bash
cd backend
# Chạy với Maven Wrapper có sẵn (tự động kết nối DB hoặc H2)
.\mvnw.cmd spring-boot:run
```
*Backend lắng nghe tại: `http://localhost:8080`*

### 2. Khởi động Frontend (React Vite):
```bash
cd frontend
npm run dev
```
*Frontend chạy tại: `http://localhost:5173`*

### 3. Trải nghiệm người dùng:
1. Mở trình duyệt vào `http://localhost:5173`.
2. Màn hình đăng nhập xuất hiện: Nhập mật khẩu mặc định: **`studyapp123`** để vào hệ thống.
3. Tại **Trang chủ**: Bấm nút lớn **"Học hôm nay (Phiên học mới)"** để bắt đầu học.
4. Trải nghiệm thẻ giới thiệu khái niệm mới, làm bài trắc nghiệm 4 đáp án kiểu Duolingo, xem hiệu ứng đúng/sai, làm lại câu sai trong phiên và nhận thưởng XP + Streak ngọn lửa 🔥 khi hoàn thành.
5. Chuyển qua tab **"Đường học"** để xem cây bài học ziczac Duolingo.
6. Chuyển qua tab **"Lịch học"** để xem kế hoạch từng ngày và thử tính năng dồn lịch tự động.
7. Chuyển qua tab **"Thống kê"** để xem cấp độ ghi nhớ ngắt quãng SRS (nhớ vững $\ge 21$ ngày) và top các câu hay làm sai.

---

### Cải Tiến Trải Nghiệm Học Tập (Cập Nhật Ngày 18/10/2026)
- **Vấn đề đã khắc phục**:
  1. **Câu hỏi bị cắt cụt (Prompt truncation)**: Thuật toán quét ngược (`parseExamQuestions`) trước đó bị ngắt sớm khi gặp ký tự cuối câu hỏi (`?`, `:`, `nào`, `là`), dẫn đến các câu nhiều dòng chỉ còn lại đuôi câu (như `"cụm từ nào?"`, `"được gọi là"`). Đã sửa thành bộ quét ngược thu thập toàn bộ các dòng của câu hỏi cho đến khi chạm điểm bắt đầu câu hỏi (`Câu \d+:`, `Question \d+:`) hoặc lựa chọn của câu trước.
  2. **Đáp án bị lộ chữ `(đúng)`**: Hàm `buildOutlineFromExamQuestions` và phương thức lưu đáp án trước đó vô tình gắn nhãn `(đúng)` vào nội dung chuỗi đáp án hiển thị. Đã bổ sung bộ lọc `cleanChoiceText` triệt để loại bỏ `(đúng)`, `(dung)`, `(sai)`, `*`, `✓`, `[x]` ở cả Backend (`AiService`, `SessionService`, `CourseCreationPipelineService`) và Frontend (`SessionPage.tsx`).
  3. **Khái quát kiến thức bài học trước khi làm trắc nghiệm**:
     - Thêm `LessonOverviewDto` ở Backend và cập nhật `TodaySessionResponse` trả về dữ liệu tổng quan bài học.
     - Hàm `AiService.generateLessonOverview`: Tự động phân tích, chắt lọc nội dung câu hỏi/đáp án của bài học để sinh ra:
       * Tiêu đề & tóm tắt ngắn của bài.
       * 3–6 điểm cốt lõi cần nhớ (`keyPoints`).
       * Thẻ thuật ngữ & định nghĩa trọng tâm (`concepts`) phân loại theo tag (`Định nghĩa`, `Thuật ngữ`, `Trọng tâm`).
     - Giao diện `SessionPage.tsx`:
       * Hiển thị **Màn hình Khái quát kiến thức bài học** đầu phiên học trước khi vào các câu hỏi trắc nghiệm, chuẩn phong cách Duolingo sắc nét.
       * Nút bấm lớn cố định dưới màn hình: **"Bắt đầu luyện tập trắc nghiệm →"** để chuyển thẳng vào làm trắc nghiệm.
       * Nút **"Lý thuyết"** gắn trên thanh điều hướng đầu trang cho phép mở lại modal tóm tắt kiến thức bất cứ lúc nào trong khi làm bài trắc nghiệm mà không mất tiến độ.
  4. **Tự động vá dữ liệu cũ (Auto-repair)**: Cơ chế `@EventListener(ApplicationReadyEvent.class)` tự động phát hiện và vá lại các khóa học cũ bị lỗi trong cơ sở dữ liệu ngay khi khởi động.

