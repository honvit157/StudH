# SPEC: Web Ôn Thi Kiểu Duolingo (Spring Boot + React)

> **Mục đích tài liệu:** Đặc tả đầy đủ yêu cầu nghiệp vụ và kỹ thuật để phát triển hệ thống web app ôn thi phong cách Duolingo cá nhân (hỗ trợ AI, thuật toán lặp lại ngắt quãng SRS, đa nền tảng PC & Mobile PWA).

---

## 1. Vai trò và Mục tiêu

- **Mô tả hệ thống:** Web app ôn thi cá nhân (một người dùng duy nhất), truy cập đồng bộ mượt mà trên cả máy tính và điện thoại thông minh (ưu tiên thiết kế **Mobile-first**).
- **Quy trình học cốt lõi:**
  1. Người dùng tải tài liệu ôn thi lên (PDF, Word `.docx`, `.txt`, `.md` hoặc dán văn bản trực tiếp).
  2. Hệ thống tích hợp AI tự động phân tích và tạo lộ trình học phân cấp: **Unit (Chương) → Section (Nhóm chủ đề) → Lesson (Bài học nhỏ ~3 phút, 5–8 Item)**.
  3. Mỗi ngày hệ thống tự động dựng phiên học thông minh gồm **bài mới** kết hợp **ôn tập lại kiến thức đến hạn** theo thuật toán nhớ ngắt quãng (Spaced Repetition System - SRS), căn cứ vào ngày thi mục tiêu và số phút dành để học mỗi ngày.
  4. Giao diện người dùng hoàn toàn bằng **tiếng Việt**, tương tác sinh động, thân thiện.
- **Quy tắc phát triển (Nguyên tắc vàng):**
  - Thực hiện tuần tự theo từng bước tại **Mục 14 (Thứ tự thực hiện)**.
  - Mỗi bước sau khi hoàn thành phải chạy được ngay, viết Unit Test cho toàn bộ logic quan trọng (SRS, xếp lịch, streak).
  - Tuyệt đối không viết code giả (mock dở dang) hoặc để lại comment `TODO` bỏ ngỏ.
  - Khi gặp điểm chưa rõ, chọn phương án hợp lý nhất, ghi rõ giả định vào phần tóm tắt và tiếp tục triển khai.

---

## 2. Kiến trúc Công nghệ

- **Backend:** 
  - Ngôn ngữ & Framework: Java 21, Spring Boot 3 (Maven).
  - Thành phần: Spring Web, Spring Data JPA, Spring Security, Bean Validation, Flyway Migration.
- **Cơ sở dữ liệu:** 
  - PostgreSQL (môi trường dev chạy bằng Docker Compose).
- **Trích xuất nội dung tài liệu:** 
  - Apache PDFBox (đối với PDF), Apache POI (đối với `.docx`), đọc stream trực tiếp đối với `.txt` và `.md`.
- **Tích hợp Trí tuệ Nhân tạo (AI Engine):** 
  - Anthropic Messages API (`claude-sonnet-4-6` / `claude-3-5-sonnet`), gọi bằng `RestClient` của Spring 3.
  - Đọc API key từ biến môi trường `ANTHROPIC_API_KEY`.
  - Ép AI trả dữ liệu JSON theo schema nghiêm ngặt, parse và validate bằng Jackson + Bean Validation. Tự động retry tối đa 2 lần nếu có lỗi cú pháp/dữ liệu.
  - Giới hạn tối đa **2 tác vụ AI** chạy song song để tránh nghẽn và quá tải rate limit.
- **Frontend:** 
  - React + TypeScript + Vite + Tailwind CSS, react-router, TanStack Query.
  - Hỗ trợ Progressive Web App (**PWA** với manifest và service worker) để cho phép cài đặt (Add to Home Screen) trên điện thoại.
- **Cấu trúc Monorepo:** 
  - `/backend` và `/frontend`.
  - Khi build production, các static asset của frontend được copy tự động vào thư mục static của Spring Boot để đóng gói và deploy thành **MỘT container duy nhất**.
  - Cung cấp `docker-compose.yml` cho dev (Postgres) và README hướng dẫn cài đặt, cấu hình, chạy.
- **Lưu trữ dữ liệu:** 
  - Dữ liệu nằm hoàn toàn trên server. Không lưu dữ liệu học cục bộ ở trình duyệt (chỉ cache tạm bằng TanStack Query) để đảm bảo đồng bộ 100% giữa máy tính và điện thoại.

---

## 3. Bảo mật (Chế độ Một Người Dùng)

- **Cơ chế xác thực:**
  - Không có đăng ký tài khoản công khai.
  - Một mật khẩu duy nhất được định nghĩa qua biến môi trường `APP_PASSWORD`.
  - `POST /api/login`: kiểm tra mật khẩu, nếu đúng sẽ thiết lập phiên làm việc qua Cookie: `HttpOnly + Secure + SameSite=Lax`.
  - Tất cả các endpoint `/api/**` khác bắt buộc phải có phiên hợp lệ mới được truy cập.
- **Chống Brute Force:** Giới hạn thử sai mật khẩu tối đa **5 lần / phút**.
- **CORS:** Chỉ cho phép truy cập từ đúng domain của Frontend.
- **Bảo mật biến môi trường:** Tuyệt đối không để lộ API key hay mật khẩu trong mã nguồn, log hệ thống hoặc frontend bundle.
- **Kiểm soát Upload:** Giới hạn file tải lên tối đa **20MB**, chỉ chấp nhận định dạng `pdf`, `docx`, `txt`, `md`.

---

## 4. Mô hình Dữ liệu (JPA Entities & Flyway)

> Toàn bộ bảng sử dụng khóa chính dạng **UUID**. Thời gian lưu trữ chuẩn **UTC**; việc xác định ngày (phục vụ streak, lịch học) được tính theo múi giờ cấu hình (mặc định: `Asia/Ho_Chi_Minh`).

- **Course:** `id`, `title`, `examDate`, `dailyMinutes`, `createdAt`, `rawText`, `status`.
- **Unit:** `id`, `courseId`, `order`, `title`.
- **Section:** `id`, `unitId`, `order`, `title`.
- **Lesson:** `id`, `sectionId`, `order`, `title`, `sourceText`, `status` (`locked` | `ready` | `generating` | `done`), `scheduledDate`, `bestScore`, `completedAt`.
- **Item (Đơn vị kiến thức nguyên tử nhỏ nhất):** `id`, `lessonId`, `prompt`, `intro`, `answer`, `distractors` (mảng 3 đáp án nhiễu), `explanation`, `sourceQuote`.
- **ItemState (Trạng thái học SRS theo Item):** `itemId`, `ease` (mặc định `2.5`), `intervalDays`, `repetitions`, `lapses`, `dueAt`, `lastResult`, `introduced` (boolean).
- **ReviewLog:** `id`, `itemId`, `correct`, `responseMs`, `at`.
- **Profile:** `xp`, `streak`, `bestStreak`, `lastActiveDate`, `dailyGoalXp` (mặc định `20`), `xpToday`, `timezone`.

*Lưu ý quan trọng:* Thuật toán SRS được theo dõi độc lập theo từng **Item**, không theo dõi theo bài học hay nhóm câu hỏi.

---

## 5. Luồng Nghiệp Vụ 1: Tạo Khóa Học Từ Tài Liệu

1. **Màn hình "Khóa học mới":** Người dùng tải file hoặc dán text, nhập tên khóa học, chọn ngày thi (Date Picker) và chọn số phút cam kết học mỗi ngày (chọn từ các mốc: 10, 15, 20, 30, 45, 60 phút).
2. **Trích xuất văn bản:** Server trích text và phản hồi số ký tự đọc được. Nếu file PDF dạng ảnh quét không chứa văn bản, báo lỗi cụ thể để người dùng biết.
3. **AI Dựng mục lục:**
   - Nếu tài liệu dài, chia thành các đoạn theo heading hoặc độ dài (~6000 ký tự, có độ chồng lấn nhỏ), gửi từng đoạn tới AI rồi gộp và loại bỏ trùng lặp.
   - Kết quả trả về cấu trúc JSON: `units[] → sections[] → lessons[]`.
   - Mỗi `Lesson` gồm `title` và `sourceText` (trích đoạn tài liệu tương ứng), chứa dung lượng kiến thức vừa đủ cho 5–8 Item.
4. **Màn hình "Đường học":** Người dùng xem trước và có thể tùy chỉnh: đổi tên, xóa, gộp hoặc tách bài học. Nhấn nút "Bắt đầu" để chốt lộ trình.
5. **Cơ chế Lazy Generation:** Item của từng Lesson không sinh ra hàng loạt ngay lúc tạo khóa, mà sinh theo cơ chế lười (lazy load - trước 1 ngày hoặc ngay khi người dùng nhấn vào bài).
6. **Xử lý bất đồng bộ:** Tác vụ phân tích và sinh bài chạy ngầm bằng `@Async`, trả về `taskId` để Frontend poll tiến độ. Nếu tài liệu quá dài, hiển thị ước tính thời gian/chi phí và cho phép người dùng hủy tác vụ.

---

## 6. Luồng Nghiệp Vụ 2: Xếp Lịch Học

- **Công thức tính số ngày học:**
  $$\text{Số ngày học} = (\text{Ngày thi} - \text{Hôm nay}) - N$$
  - $N = 3$ ngày (dành riêng ôn tập tổng hợp cuối khóa) nếu còn từ 14 ngày trở lên.
  - $N = 2$ ngày nếu còn ít hơn 14 ngày.
  - $N = 0$ nếu thời gian còn dưới 5 ngày.
- **Phân bổ bài mới mỗi ngày:**
  $$\text{Số Lesson mới mỗi ngày} = \lceil \text{Tổng Lesson chưa học} / \text{Số ngày học} \rceil$$
  Gán `scheduledDate` lần lượt theo thứ tự bài học.
- **Cơ chế dồn lịch thông minh:** Nếu người dùng bỏ lỡ một hoặc nhiều ngày, hệ thống tự động dồn bài vào các ngày còn lại một cách hợp lý, không để nợ bài bị dồn ứ cục bộ.
- **Ước lượng tải học tập (Workload Estimation):**
  - Ước tính: **~3 phút** cho mỗi Lesson mới và **~0.3 phút** cho mỗi Item ôn tập.
  - Nếu tổng thời gian vượt quá `dailyMinutes`, hệ thống sẽ cảnh báo quá tải và đề xuất người dùng tăng thời gian học hàng ngày hoặc dời ngày thi.
- **Màn hình Lịch:** Trực quan hóa từng ngày: hiển thị rõ số bài mới và số Item dự kiến cần ôn tập.

---

## 7. Luồng Nghiệp Vụ 3: Sinh Item Cho Một Lesson

Khi kích hoạt sinh bài, gửi `sourceText` của Lesson tới Claude API với JSON Schema nghiêm ngặt, trả về 5–8 Item:
- `prompt`: Câu hỏi rõ ràng, độc lập, không dựa dẫm vào câu hỏi khác.
- `intro`: 1–3 câu tóm tắt/giải thích khái niệm cho lần đầu tiếp cận.
- `answer`: Đáp án chính xác.
- `distractors`: Đúng 3 đáp án gây nhiễu hợp lý, cùng ngữ cảnh/loại với đáp án đúng, không lộ liễu.
- `explanation`: Lời giải thích ngắn gọn, súc tích vì sao đáp án đó đúng.
- `sourceQuote`: Trích dẫn nguyên văn tối đa 25 từ từ tài liệu gốc làm căn cứ kiểm chứng.

**Ràng buộc Prompt khắt khe:**
- Chỉ sử dụng thông tin có trong tài liệu, không tự suy diễn/bịa đặt.
- Mỗi Item chỉ kiểm tra duy nhất một ý kiến thức.
- Đáp án đúng không được luôn là đáp án dài nhất.
- Viết bằng tiếng Việt tự nhiên, giữ nguyên thuật ngữ chuyên ngành gốc.
- **Kiểm tra tự động:** Nếu `sourceQuote` không xuất hiện thực tế trong `sourceText`, Item đó sẽ bị backend loại bỏ ngay lập tức.

---

## 8. Dạng Bài Học (Quy định nghiêm ngặt: Chỉ có 2 dạng)

1. **Thẻ giới thiệu (Concept Intro Card):**
   - Chỉ xuất hiện đối với Item chưa từng học lần nào (`introduced = false`).
   - Hiển thị: `prompt` + `intro` + `sourceQuote`, đi kèm nút "Đã hiểu, kiểm tra thử".
2. **Trắc nghiệm 4 đáp án (Multiple Choice):**
   - Xáo trộn ngẫu nhiên vị trí đáp án đúng và 3 đáp án nhiễu.
   - Áp dụng cho **TẤT CẢ** các Item, bao gồm cả khi học bài mới và khi ôn tập lại.
   - *Tuyệt đối không có*: điền chỗ trống, gõ văn bản hay ghép nối. Độ khó của bài học được điều tiết hoàn toàn thông qua thuật toán tần suất lặp lại SRS.

---

## 9. Luồng Nghiệp Vụ 4: Phiên Học Hằng Ngày

- Nút chính nổi bật: **"Học hôm nay"** tại trang chủ.
- **Thứ tự ưu tiên hàng đợi câu hỏi trong ngày (cắt theo `dailyMinutes`):**
  1. Item đến hạn ôn tập (`dueAt <= now`), ưu tiên Item bị quá hạn lâu nhất.
  2. Lesson mới có `scheduledDate <= hôm nay` (bao gồm các bài trước đó bị bỏ lỡ).
  3. Nếu vẫn còn thời lượng: đưa thêm các Item yếu nhất (chỉ số `lapses` cao, `ease` thấp).
  - *Lưu ý:* Nếu hôm nay lượng bài ôn quá lớn, hệ thống chủ động hoãn bớt Lesson mới thay vì nhồi nhét.
- **Vòng lặp trong phiên:**
  1. Hiển thị Thẻ giới thiệu (nếu Item mới) → Câu hỏi trắc nghiệm.
  2. Người dùng chọn đáp án → Lập tức phản hồi Đúng/Sai kèm `explanation` và `sourceQuote`.
  3. Gửi kết quả về server để cập nhật SRS theo thời gian thực.
  4. Nếu trả lời sai: Đẩy Item xuống cuối hàng đợi để người dùng gặp lại ngay trong phiên (tối đa 2 lần / Item / phiên) trước khi hoàn thành.
  5. Bấm nút "Tiếp" để sang câu tiếp theo.
- **Giao diện phiên học:** Thanh tiến độ học tập (Progress Bar) và nút "Thoát" (có hộp thoại xác nhận và tự động lưu tiến độ đã làm).
- **Màn hình Kết quả (Session Summary):** Thống kê số câu đúng/sai, số XP đạt được, trạng thái streak, và danh sách các Item đã trả lời sai kèm giải thích chi tiết.
- **Chế độ "Ôn tập tự do":** Cho phép chọn một Unit/Section cụ thể để luyện thêm ngoài phiên chính, có công tắc bật/tắt việc tính kết quả vào thuật toán SRS.

---

## 10. Thuật Toán SRS (SM-2 Rút Gọn - Có Unit Test JUnit 5)

### Quy đổi thang điểm chất lượng (`quality` / $q$):
- Trả lời **Sai**: $q = 0$
- Trả lời **Đúng nhưng quá 15 giây**: $q = 3$
- Trả lời **Đúng thông thường**: $q = 4$
- Trả lời **Đúng thần tốc (dưới 5 giây)**: $q = 5$
*(Đặc biệt: Item mới gặp lần đầu tiên trong phiên nếu trả lời sai thì chưa tính là một lapse)*

### Công thức cập nhật trạng thái ItemState:
1. **Nếu $q < 3$ (Học chưa đạt):**
   - $\text{repetitions} = 0$
   - $\text{intervalDays} = 1$
   - $\text{lapses} = \text{lapses} + 1$
2. **Nếu $q \ge 3$ (Học đạt):**
   - $\text{repetitions} = \text{repetitions} + 1$
   - $\text{intervalDays}$:
     - Lần 1: $1$ ngày
     - Lần 2: $3$ ngày
     - Các lần tiếp theo: $\text{round}(\text{intervalDays} \times \text{ease})$
3. **Cập nhật hệ số dễ (`ease`):**
   $$\text{ease} = \max(1.3, \; \text{ease} + 0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$$
4. **Tính ngày ôn tập tiếp theo (`dueAt`):**
   - $\text{dueAt} = \text{now} + \text{intervalDays}$
   - Nếu $\text{dueAt} > \text{ngày thi}$, hệ thống tự động kéo ngày ôn tập về trước ngày thi.
5. **Ghi log:** Mọi lượt tương tác trả lời câu hỏi đều được ghi lại vào bảng `ReviewLog`.

---

## 11. Bài Kiểm Tra Đầu Vào (Placement Test - Tùy Chọn)

- Sau khi hoàn thành tạo khóa học, hệ thống cho phép làm bài kiểm tra nhanh gồm 5 câu hỏi đại diện cho mỗi Unit (do AI sinh nhanh).
- Nếu người dùng đạt từ **80% trở lên** ở Unit nào:
  - Đánh dấu Unit đó là "Đã quen".
  - Giảm số lượng Lesson mới cần học của Unit đó.
  - Chuyển thẳng các Item của Unit này vào hàng đợi SRS với $\text{intervalDays} = 3$ thay vì bắt học lại từ đầu.

---

## 12. Cơ Chế Gamification

- **Điểm kinh nghiệm (XP):**
  - $+10$ XP cho mỗi câu trả lời đúng ngay lần đầu tiên.
  - $+5$ XP nếu trả lời đúng sau khi gặp lại trong phiên.
  - $+20$ XP phần thưởng hoàn thành phiên học hoàn hảo (không sai câu nào).
- **Chuỗi ngày học liên tục (Streak):**
  - Tăng thêm 1 ngày streak khi hoàn thành ít nhất một phiên học trong ngày (căn cứ theo múi giờ địa phương `Asia/Ho_Chi_Minh`).
  - Đứt chuỗi streak nếu bỏ qua một ngày không học. Biểu tượng ngọn lửa và số ngày streak hiển thị trang trọng tại Header.
- **Mục tiêu học tập hàng ngày:** Mặc định $20$ XP/ngày; hiển thị dưới dạng vòng tròn tiến độ trực quan tại trang chủ.
- **Triết lý thiết kế:** **Không có cơ chế "Tim/Mạng" (No Hearts)** để không bao giờ chặn hay gây ức chế cho người dùng muốn học.
- **Âm thanh & Rung:** Hiệu ứng đổi màu nhẹ nhàng, rung xúc giác haptic feedback trên điện thoại khi đúng/sai; âm thanh có nút bật/tắt trong Cài đặt.

---

## 13. Hệ Thống API & Danh Sách Màn Hình

### Danh mục RESTful API:
- **Xác thực:**
  - `POST /api/login`
- **Quản lý Khóa học:**
  - `POST /api/courses` (Multipart: file/text, thông tin cấu hình)
  - `GET /api/courses`
  - `GET /api/courses/{id}/path` (Lộ trình chi tiết)
  - `PATCH /api/units/{id}`, `PATCH /api/sections/{id}`, `PATCH /api/lessons/{id}`
  - `POST /api/courses/{id}/start` (Chốt lộ trình và kích hoạt)
  - `GET /api/tasks/{id}` (Kiểm tra tiến độ tác vụ ngầm)
- **Lịch trình:**
  - `GET /api/schedule`
- **Phiên học (Study Session):**
  - `GET /api/session/today` (Lấy hàng đợi học hôm nay)
  - `POST /api/session/answer` (Gửi câu trả lời, tính điểm SRS, XP)
  - `POST /api/session/finish` (Kết thúc phiên, tổng kết)
- **Thống kê & Cài đặt:**
  - `GET /api/stats`
  - `GET /api/settings`, `PUT /api/settings`
  - `GET /api/export` (Xuất toàn bộ dữ liệu ra JSON)
  - `POST /api/import` (Khôi phục dữ liệu từ file JSON)

### Danh sách Màn hình Chính:
1. **Trang chủ:** Tên khóa học đang học, đếm ngược ngày thi, nút lớn "Học hôm nay" (kèm số Item cần ôn và số bài mới), số ngày streak, vòng tròn tiến độ XP ngày.
2. **Đường học (Learning Path):** Cây kỹ năng dọc kết nối các Lesson dạng node tròn kiểu Duolingo; hiển thị trạng thái (Khóa / Sẵn sàng / Đã xong kèm đánh giá sao). Cho phép nhấn vào bài sẵn sàng để học riêng.
3. **Màn hình Phiên học & Màn hình Kết quả.**
4. **Màn hình Lịch:** Kế hoạch học tập chi tiết từng ngày cho tới ngày thi.
5. **Màn hình Thống kê:** Số lượng Item đã nhớ vững ($\text{intervalDays} \ge 21$), biểu đồ Item ôn theo ngày, độ chính xác theo từng Unit, top 10 Item hay trả lời sai nhất.
6. **Màn hình Quản lý Khóa học:** Tạo mới, chuyển đổi qua lại giữa các khóa, xóa khóa học.
7. **Màn hình Cài đặt:** Điều chỉnh số phút học/ngày, ngày thi, mục tiêu XP, âm thanh, theme (Sáng/Tối/Hệ thống), múi giờ, xuất/nhập JSON sao lưu, xóa toàn bộ dữ liệu.

### Quy chuẩn Giao diện (UI/UX Design Tokens):
- Thiết kế thân thiện, nhiều khoảng trắng, nút bấm bo góc lớn (pill-shaped/rounded) thuận tiện thao tác một tay trên điện thoại.
- Bottom Navigation Bar cố định ở cạnh dưới trên mobile: *Trang chủ*, *Đường học*, *Ôn tập*, *Thống kê*.
- Phối màu CSS Variables: Xanh lá cây cho đúng, Đỏ nhạt cho sai, một màu chủ đạo (Accent Color). Hỗ trợ Dark Mode mượt mà.
- Font chữ hệ thống hiển thị tiếng Việt hoàn hảo, không lỗi dấu.
- Có Skeleton loading rõ ràng khi chờ gọi AI và nút "Thử lại" khi gặp sự cố mạng.
- Xử lý ngoại lệ kiên cường: Rớt mạng hay AI lỗi tạm thời không làm mất tiến độ học; bài học đã sinh Item vẫn học bình thường; validate dữ liệu chặt chẽ từ backend.

---

## 14. Thứ Tự Triển Khai Chi Tiết (8 Bước Thực Hiện)

> **Quy định:** Hoàn thành và kiểm thử chạy thông từng bước trước khi chuyển sang bước tiếp theo. Cuối mỗi bước cần có phần tóm tắt ngắn: *Đã làm gì*, *Giả định gì*, *Chưa làm gì*.

- **Bước 1: Khởi tạo nền tảng Monorepo**
  - Cấu hình Spring Boot 3 + PostgreSQL (chạy bằng `docker-compose.yml`) + Flyway migration ban đầu.
  - Cấu hình React + Vite + TypeScript + Tailwind CSS.
  - Cài đặt cơ chế bảo mật đăng nhập một người dùng bằng mật khẩu (`APP_PASSWORD`, cookie HttpOnly).
- **Bước 2: Entity, Thuật toán SRS & JUnit Test**
  - Xây dựng đầy đủ các JPA Entity theo sơ đồ dữ liệu.
  - Cài đặt `SrsService` chứa trọn vẹn thuật toán SM-2 rút gọn.
  - Viết bộ JUnit 5 test bao quát toàn bộ các ca kiểm thử của thuật toán SRS.
  - Seed sẵn 20 Item mẫu để phục vụ kiểm thử.
- **Bước 3: Hoàn thiện API Phiên học & Giao diện Học**
  - Viết các API phiên học: `/today`, `/answer`, `/finish`.
  - Dựng màn hình phiên học: Thẻ giới thiệu khái niệm, câu hỏi trắc nghiệm, cơ chế lặp lại câu sai trong phiên, màn hình tổng kết kết quả.
- **Bước 4: Gamification, Trang Chủ & Thống Kê Cơ Bản**
  - Tính toán XP, chuỗi Streak theo ngày và múi giờ.
  - Dựng giao diện Trang chủ: Nút "Học hôm nay", vòng tiến độ XP, đếm ngược ngày thi.
  - Dựng màn hình Thống kê cơ bản.
- **Bước 5: Đường Học (Learning Path), Lịch Học & Thuật Toán Xếp Lịch**
  - Triển khai phân cấp Unit → Section → Lesson.
  - Dựng giao diện Đường học dạng node nối dọc kiểu Duolingo.
  - Cài đặt thuật toán xếp lịch và cơ chế tự động dồn lịch khi nghỉ học; hiển thị màn hình Lịch.
- **Bước 6: Trích Xuất Tài Liệu & Claude AI Client**
  - Tích hợp trích xuất văn bản từ PDF (PDFBox), Word (POI), Text/MD.
  - Xây dựng Client gọi Anthropic Claude Messages API qua `RestClient`.
  - Cài đặt cơ chế ép chuẩn JSON Schema, parse bằng Jackson, Bean Validation, tự động retry tối đa 2 lần và giới hạn 2 request AI đồng thời.
- **Bước 7: Pipeline Tạo Khóa Học Tự Động & Bài Kiểm Tra Đầu Vào**
  - Xây dựng quy trình AI tạo mục lục tự động, cho phép người dùng chỉnh sửa cấu trúc lộ trình.
  - Cài đặt cơ chế sinh Item kiểu Lazy (@Async task có taskId để poll tiến độ).
  - Triển khai tính năng Bài kiểm tra đầu vào (Placement Test) để rút ngắn lộ trình cho Unit đã nắm vững.
- **Bước 8: Cài Đặt, Sao Lưu JSON, PWA & Tinh Chỉnh Mobile**
  - Màn hình Cài đặt, chức năng Xuất/Nhập dữ liệu dự phòng qua JSON.
  - Cấu hình PWA (Service Worker + Manifest), kiểm thử mượt mà trên màn hình nhỏ 375px.
  - Xử lý triệt để các trường hợp ngoại lệ, hoàn thiện tài liệu hướng dẫn vận hành `README.md`.
- **Bước 9: (Để sau)**
  - Viết Dockerfile production multi-stage đóng gói cả frontend và backend vào một container duy nhất.
  - Hướng dẫn triển khai lên nền tảng đám mây (Render, Railway, Fly.io + Managed Postgres).

---

## 15. Tiêu Chí Nghiệm Thu Hệ Thống (Acceptance Criteria)

1. **Hiệu năng xử lý:** Tải một tài liệu thực tế dài vài chục trang, sinh ra lộ trình học hợp lý trong thời gian dưới **2 phút**.
2. **Tính chuẩn xác của SRS:**
   - Hoàn thành một bài học mới: Item phải xuất hiện lại chính xác vào ngày đến hạn (sau 1 ngày, rồi 3 ngày...; có thể kiểm chứng bằng cách tua ngày hệ thống).
   - Nếu trả lời sai một Item, Item đó phải xuất hiện lại ngay trong phiên học và chu kỳ ôn tập tiếp theo sẽ bị rút ngắn lại.
3. **Độ tin cậy của Gamification:** Streak, XP, vòng tròn mục tiêu ngày cập nhật chính xác theo múi giờ địa phương (`Asia/Ho_Chi_Minh`), tự động chuyển ngày sau nửa đêm.
4. **Tính đồng bộ & Toàn vẹn:** Đăng nhập từ điện thoại hay máy tính đều thấy chung một tiến độ học tập tức thì. Xuất và nhập file JSON khôi phục trọn vẹn 100% dữ liệu.
5. **Trải nghiệm di động (PWA):** Thao tác mượt mà trên màn hình chiều rộng $375\text{px}$, có thể cài đặt trực tiếp lên màn hình chính điện thoại như một Native App.
6. **Chất lượng mã nguồn:** Toàn bộ logic cốt lõi (SRS, thuật toán xếp lịch và dồn lịch, XP/Streak) đều có Unit Test đầy đủ và tỷ lệ pass đạt $100\%$.
