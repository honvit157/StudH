# Hướng Dẫn Triển Khai StudyApp Lên Đám Mây (Chi Phí 0đ)

Tài liệu này hướng dẫn bạn cách đưa ứng dụng **StudyApp** lên môi trường Internet hoàn toàn **miễn phí 100% (0đ)**, không cần thẻ tín dụng quốc tế, truy cập mượt mà trên cả điện thoại (iOS / Android) và máy tính cá nhân 24/7.

---

## 1. Kiến Trúc Hạ Tầng 0đ (Zero-Cost Stack)

| Thành phần | Nền tảng khuyến nghị | Gói miễn phí | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Web Service (Fullstack)** | **Render.com** hoặc **Koyeb** | Miễn phí (750 giờ/tháng) | Chạy Dockerfile đã đóng gói cả Spring Boot + React Vite |
| **Cơ sở dữ liệu (Database)** | **Neon.tech** | Miễn phí 0.5 GB PostgreSQL | Serverless Postgres tốc độ cao, sao lưu tự động |
| **Trí tuệ nhân tạo (AI)** | **Google AI Studio (Gemini)** | Miễn phí (15 RPM, 1500 RPD) | Xử lý tài liệu và sinh câu hỏi cực nhanh |
| **Ứng dụng di động** | **PWA (Progressive Web App)** | Sẵn có trong ứng dụng | Cài đặt trực tiếp lên Home Screen như app gốc |

---

## 2. Chuẩn Bị Tài Nguyên Miễn Phí (Mất ~3 phút)

### Bước 2.1: Tạo PostgreSQL miễn phí trên Neon.tech
1. Truy cập [https://neon.tech](https://neon.tech) và đăng nhập bằng tài khoản GitHub hoặc Google.
2. Nhấn **"Create Project"**, đặt tên dự án là `studyapp-db`.
3. Trong bảng điều khiển, sao chép chuỗi kết nối **Connection Details**:
   - Host: `ep-xyz.ap-southeast-1.aws.neon.tech`
   - Database: `neondb`
   - Username: `neondb_owner`
   - Password: `...`
4. Chuyển đổi định dạng sang JDBC URL để cấu hình cho Spring Boot:
   `jdbc:postgresql://<host>/neondb?sslmode=require`

### Bước 2.2: Lấy Google Gemini API Key miễn phí
1. Truy cập [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Nhấn **"Create API Key"** và lưu lại chuỗi khóa bí mật.

---

## 3. Triển Khai Lên Render.com (Cách Khuyến Nghị)

1. Đẩy toàn bộ mã nguồn `StudyApp` lên kho chứa GitHub cá nhân của bạn.
2. Đăng nhập vào [https://render.com](https://render.com).
3. Nhấn nút **"New +"** ở góc trên và chọn **"Web Service"**.
4. Kết nối với Repository GitHub của bạn.
5. Cấu hình các thông số cơ bản:
   - **Name:** `studyapp` (hoặc tên bạn thích).
   - **Region:** `Singapore` (để có độ trễ mạng thấp nhất về Việt Nam).
   - **Branch:** `master` hoặc `main`.
   - **Runtime:** Chọn **Docker**.
   - **Instance Type:** Chọn **Free** ($0/month).
6. Cuộn xuống phần **Environment Variables** (Biến môi trường), thêm các cặp giá trị sau:

| Tên biến | Giá trị mẫu |
| :--- | :--- |
| `APP_PASSWORD` | Mật khẩu đăng nhập của bạn (ví dụ: `matkhaucuaban123`) |
| `GEMINI_API_KEY` | Khóa API lấy từ Google AI Studio |
| `APP_TIMEZONE` | `Asia/Ho_Chi_Minh` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<host>/neondb?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Tên user từ Neon.tech |
| `SPRING_DATASOURCE_PASSWORD` | Mật khẩu từ Neon.tech |
| `SPRING_DATASOURCE_DRIVER` | `org.postgresql.Driver` |
| `SPRING_FLYWAY_ENABLED` | `true` |

7. Nhấn **"Create Web Service"**.
   Render sẽ tự động kéo code, kích hoạt `Dockerfile` multi-stage: biên dịch frontend React bằng Vite, build Spring Boot fat JAR, và khởi chạy trong container Temurin JRE siêu nhẹ.
8. Sau khoảng 3–5 phút, bạn sẽ nhận được đường link công khai: `https://studyapp-xyz.onrender.com`.

---

## 4. Cài Đặt Lên Điện Thoại Thông Qua PWA (Progressive Web App)

StudyApp được tích hợp sẵn Service Worker và Web App Manifest chuẩn chỉnh:

### Trên iPhone / iPad (Trình duyệt Safari):
1. Mở Safari và truy cập đường link StudyApp của bạn.
2. Nhấn nút **Chia sẻ** (biểu tượng hình vuông có mũi tên hướng lên ở thanh công cụ dưới).
3. Cuộn xuống và chọn **"Thêm vào MH chính" (Add to Home Screen)**.
4. Đặt tên hiển thị (mặc định là *StudyApp*) rồi nhấn **Thêm**.
5. Biểu tượng StudyApp xuất hiện trên màn hình chính của iPhone với giao diện toàn màn hình không có thanh địa chỉ trình duyệt, phản hồi xúc giác rung và âm thanh như ứng dụng gốc!

### Trên Android (Trình duyệt Google Chrome):
1. Mở Chrome và truy cập đường link StudyApp.
2. Nhấn vào biểu tượng **3 chấm dọc** ở góc trên bên phải (hoặc banner thông báo xuất hiện ở đáy màn hình).
3. Chọn **"Cài đặt ứng dụng" (Install app)** hoặc **"Thêm vào màn hình chính"**.
4. Nhấn xác nhận để hoàn tất.

---

## 5. Hướng Dẫn Chạy Cục Bộ (Local Development & Self-Host)

### Cách 1: Chạy bằng Docker Compose (Khuyên dùng nếu có Docker)
```bash
# Tạo file cấu hình từ mẫu
cp .env.example .env

# Chạy toàn bộ hệ thống (PostgreSQL 16 + StudyApp)
docker compose up -d

# Truy cập ứng dụng tại
http://localhost:8080
```

### Cách 2: Chạy trực tiếp trên máy tính phát triển
```bash
# Terminal 1: Khởi động Backend Spring Boot
cd backend
.\mvnw.cmd spring-boot:run

# Terminal 2: Khởi động Frontend React Vite
cd frontend
npm run dev -- --host
```
Khi chạy `--host`, bạn có thể lấy địa chỉ IP máy tính (ví dụ: `http://192.168.1.15:5173`) để mở trực tiếp trên điện thoại cùng mạng Wi-Fi!

---

## 6. Chính Sách Sao Lưu & Bảo Vệ Dữ Liệu Học Tập

Để dữ liệu không bao giờ bị gián đoạn:
1. Vào tab **Cài đặt** trên thanh điều hướng StudyApp.
2. Nhấn **"Xuất sao lưu (JSON)"** định kỳ (ví dụ mỗi tuần một lần). Toàn bộ danh sách câu hỏi, lộ trình, chuỗi Streak và hệ số Spaced Repetition (SRS) sẽ được tải về máy bạn.
3. Khi cần đổi máy hoặc chuyển server, bạn chỉ cần nhấn **"Khôi phục từ JSON"** và tải file lên để phục hồi nguyên vẹn 100% tiến độ học tập!
