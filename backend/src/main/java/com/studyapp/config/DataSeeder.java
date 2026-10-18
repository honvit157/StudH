package com.studyapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyapp.model.*;
import com.studyapp.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private final CourseRepository courseRepository;
    private final UnitRepository unitRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final ItemRepository itemRepository;
    private final ItemStateRepository itemStateRepository;
    private final ProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    public DataSeeder(CourseRepository courseRepository,
                      UnitRepository unitRepository,
                      SectionRepository sectionRepository,
                      LessonRepository lessonRepository,
                      ItemRepository itemRepository,
                      ItemStateRepository itemStateRepository,
                      ProfileRepository profileRepository,
                      ObjectMapper objectMapper) {
        this.courseRepository = courseRepository;
        this.unitRepository = unitRepository;
        this.sectionRepository = sectionRepository;
        this.lessonRepository = lessonRepository;
        this.itemRepository = itemRepository;
        this.itemStateRepository = itemStateRepository;
        this.profileRepository = profileRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // Khởi tạo profile mặc định nếu chưa có
        if (profileRepository.findById("default").isEmpty()) {
            Profile profile = new Profile("default");
            profile.setDailyGoalXp(20);
            profile.setTimezone("Asia/Ho_Chi_Minh");
            profileRepository.save(profile);
        }

        // Nếu đã có course thì không seed lại
        if (courseRepository.count() > 0) {
            return;
        }

        // Tạo Course mẫu
        Course course = new Course("Kiến Thức Lập Trình Web & Thuật Toán", LocalDate.now().plusDays(30), 20);
        courseRepository.save(course);

        // Unit 1: Cơ Sở Kiến Trúc Web
        Unit unit1 = new Unit(course.getId(), 1, "Chương 1: Kiến Trúc Web Hiện Đại");
        unitRepository.save(unit1);

        Section sec1 = new Section(unit1.getId(), 1, "Chủ đề 1.1: Giao thức HTTP và REST API");
        sectionRepository.save(sec1);

        // Lesson 1: HTTP Methods & Status Codes
        Lesson lesson1 = new Lesson(sec1.getId(), 1, "Bài 1: Giao thức HTTP và Status Code", "HTTP là nền tảng truyền tải dữ liệu...");
        lesson1.setStatus("ready");
        lesson1.setScheduledDate(LocalDate.now());
        lessonRepository.save(lesson1);

        seedItemsForLesson1(lesson1);

        // Lesson 2: Bảo Mật Cookie & Authentication
        Lesson lesson2 = new Lesson(sec1.getId(), 2, "Bài 2: Cookie HttpOnly & Session", "Cookie HttpOnly ngăn chặn tấn công XSS...");
        lesson2.setStatus("locked");
        lesson2.setScheduledDate(LocalDate.now().plusDays(1));
        lessonRepository.save(lesson2);

        seedItemsForLesson2(lesson2);

        // Unit 2: Cơ Sở Dữ Liệu & Thuật Toán
        Unit unit2 = new Unit(course.getId(), 2, "Chương 2: Cơ Sở Dữ Liệu & Ghi Nhớ Ngắt Quãng");
        unitRepository.save(unit2);

        Section sec2 = new Section(unit2.getId(), 1, "Chủ đề 2.1: Thuật Toán Lặp Lại Ngắt Quãng SRS");
        sectionRepository.save(sec2);

        // Lesson 3: Nguyên Lý SM-2
        Lesson lesson3 = new Lesson(sec2.getId(), 1, "Bài 3: Thuật Toán SM-2 Rút Gọn", "SuperMemo SM-2 tính toán chu kỳ lặp...");
        lesson3.setStatus("locked");
        lesson3.setScheduledDate(LocalDate.now().plusDays(2));
        lessonRepository.save(lesson3);

        seedItemsForLesson3(lesson3);
    }

    private void seedItemsForLesson1(Lesson lesson) throws Exception {
        createItem(lesson,
                "Mã trạng thái HTTP nào biểu thị một tài nguyên được tạo thành công trên máy chủ?",
                "Trong thiết kế REST API, mỗi thao tác thành công sẽ trả về status code phù hợp để client biết kết quả.",
                "201 Created",
                List.of("200 OK", "204 No Content", "202 Accepted"),
                "Mã 201 Created được chuẩn hóa để thông báo rằng một tài nguyên mới vừa được tạo thành công.",
                "Mã 201 Created biểu thị tài nguyên mới được tạo thành công");

        createItem(lesson,
                "Phương thức HTTP nào có tính chất Idempotent (gọi nhiều lần kết quả vẫn như một)?",
                "Idempotence là tính chất quan trọng trong mạng phân tán để xử lý an toàn khi gửi lại request.",
                "PUT",
                List.of("POST", "PATCH (non-idempotent)", "CONNECT"),
                "PUT thay thế hoàn toàn tài nguyên ở URI chỉ định, do đó gọi 1 lần hay 10 lần thì trạng thái cuối vẫn như nhau.",
                "Phương thức PUT có tính chất idempotent");

        createItem(lesson,
                "Mã trạng thái HTTP 429 có ý nghĩa chuẩn là gì?",
                "Mã này thường xuất hiện khi hệ thống kích hoạt cơ chế giới hạn tần suất (Rate Limiter).",
                "Too Many Requests",
                List.of("Request Timeout", "Bad Request", "Service Unavailable"),
                "HTTP 429 Too Many Requests cho biết client đã gửi quá nhiều yêu cầu trong một khoảng thời gian quy định.",
                "HTTP 429 thông báo client đã gửi quá nhiều yêu cầu");

        createItem(lesson,
                "Header nào được dùng để client chỉ định định dạng dữ liệu mong muốn nhận về từ server?",
                "Content Negotiation giúp client và server thống nhất định dạng dữ liệu (JSON, XML,...).",
                "Accept",
                List.of("Content-Type", "Content-Encoding", "User-Agent"),
                "Accept thông báo cho server biết kiểu MIME mà client có thể hiểu và xử lý được.",
                "Header Accept thông báo kiểu MIME mong muốn");

        createItem(lesson,
                "Mã lỗi 403 Forbidden khác gì so với 401 Unauthorized?",
                "Cả hai đều là lỗi từ chối quyền truy cập nhưng ở hai mức độ bảo mật khác nhau.",
                "401 là chưa xác thực danh tính, còn 403 là đã biết danh tính nhưng không có quyền",
                List.of("401 là lỗi do server, 403 là do client", "401 áp dụng cho GET, 403 cho POST", "Không có sự khác nhau về ý nghĩa"),
                "401 Unauthorized yêu cầu đăng nhập trước; 403 Forbidden từ chối thẳng thừng dù đã đăng nhập.",
                "401 chưa xác thực, 403 không có quyền truy cập");

        createItem(lesson,
                "HTTP/2 cải tiến hiệu năng vượt trội so với HTTP/1.1 nhờ cơ chế cốt lõi nào?",
                "Phiên bản HTTP/2 giải quyết hiện tượng Head-of-Line blocking ở tầng ứng dụng.",
                "Multiplexing trên một kết nối TCP duy nhất",
                List.of("Bỏ hoàn toàn giao thức TCP", "Không cần gửi header nữa", "Chuyển hết sang định dạng XML"),
                "Multiplexing cho phép gửi nhiều request và response đồng thời trên cùng 1 kết nối TCP mà không bị nghẽn.",
                "Multiplexing cho phép gửi nhiều request đồng thời");

        createItem(lesson,
                "Phương thức HTTP OPTIONS thường được trình duyệt tự động gửi đi trong trường hợp nào?",
                "Đây là cơ chế tiền kiểm soát (preflight request) để đảm bảo an toàn bảo mật.",
                "Yêu cầu Preflight kiểm tra quyền CORS trước khi gửi request thực tế",
                List.of("Khi người dùng tải lại trang", "Khi người dùng ấn đăng xuất", "Khi kết nối mạng bị gián đoạn"),
                "Trình duyệt gửi OPTIONS preflight để hỏi server xem domain client có được phép gọi API với method và header đó không.",
                "OPTIONS preflight kiểm tra quyền CORS an toàn");
    }

    private void seedItemsForLesson2(Lesson lesson) throws Exception {
        createItem(lesson,
                "Cờ HttpOnly trong Cookie có tác dụng bảo mật cốt lõi nào?",
                "Đây là biện pháp bảo vệ quan trọng cho cookie lưu phiên đăng nhập (session).",
                "Ngăn chặn mã JavaScript ở trình duyệt truy cập vào Cookie (chống đánh cắp qua XSS)",
                List.of("Mã hóa toàn bộ nội dung của Cookie trên đường truyền", "Ngăn chặn người dùng đóng trình duyệt", "Tự động gia hạn thời gian sống của Cookie"),
                "Khi có cờ HttpOnly, document.cookie trong JavaScript không thể đọc được cookie này, bảo vệ token khỏi bị XSS đánh cắp.",
                "Cờ HttpOnly ngăn chặn JavaScript đọc cookie");

        createItem(lesson,
                "Giá trị SameSite=Lax cho Cookie bảo vệ trang web khỏi kiểu tấn công nào?",
                "SameSite quy định cách thức cookie được gửi kèm trong các request cross-site.",
                "CSRF (Cross-Site Request Forgery)",
                List.of("SQL Injection", "DDoS", "Man-in-the-Middle"),
                "SameSite=Lax không cho phép gửi cookie trong các request cross-site dạng POST hoặc iframe, ngăn chặn CSRF hiệu quả.",
                "SameSite=Lax bảo vệ website khỏi tấn công CSRF");

        createItem(lesson,
                "Cờ Secure trên Cookie bảo đảm điều kiện gì khi truyền tải dữ liệu?",
                "Cờ này đảm bảo dữ liệu cookie không bị nghe lén trên đường truyền mạng công cộng.",
                "Cookie chỉ được truyền qua kết nối mã hóa HTTPS",
                List.of("Cookie chỉ tồn tại trong 24 giờ", "Cookie được lưu trong thư mục an toàn của ổ cứng", "Cookie chỉ dùng cho phương thức POST"),
                "Cờ Secure đảm bảo cookie không bao giờ được gửi qua giao thức HTTP không mã hóa.",
                "Cờ Secure chỉ gửi cookie qua HTTPS");

        createItem(lesson,
                "Trong ứng dụng một người dùng, mật khẩu nên được cấu hình qua nguồn nào an toàn nhất?",
                "Nguyên tắc 12-Factor App quy định về việc quản lý cấu hình và bí mật.",
                "Biến môi trường (Environment Variable) trên hệ thống",
                List.of("Hardcode trực tiếp trong mã nguồn Java", "Lưu vào file text công khai trong repo git", "Lưu trong file frontend bundle .js"),
                "Biến môi trường giúp tách biệt hoàn toàn bí mật khỏi mã nguồn và lịch sử commit git.",
                "Lưu mật khẩu qua biến môi trường an toàn");

        createItem(lesson,
                "Để chống tấn công Brute-force mật khẩu đăng nhập, kỹ thuật nào bắt buộc phải áp dụng?",
                "Kẻ tấn công thường dùng từ điển mật khẩu gửi hàng nghìn request mỗi giây.",
                "Rate Limiting (giới hạn số lần thử trong 1 phút)",
                List.of("Tăng kích thước RAM của server", "Dùng font chữ khó đọc ở màn hình đăng nhập", "Cho phép nhập sai không giới hạn"),
                "Rate limiting khóa tạm thời client nếu nhập sai quá số lần cho phép (ví dụ 5 lần/phút) để ngăn chặn dò mật khẩu.",
                "Rate limiting giới hạn số lần thử mật khẩu");

        createItem(lesson,
                "Tại sao không nên lưu thông tin đăng nhập nhạy cảm vào LocalStorage của trình duyệt?",
                "Nhiều ứng dụng nhầm lẫn giữa tiện lợi và tính an toàn của storage trên client.",
                "LocalStorage có thể bị đọc dễ dàng bởi bất kỳ đoạn mã JavaScript độc hại nào bị tiêm vào (XSS)",
                List.of("LocalStorage chỉ lưu được 10 byte", "LocalStorage bị xóa ngay khi tắt tab", "LocalStorage không hỗ trợ tiếng Việt"),
                "LocalStorage không hỗ trợ cờ bảo vệ như HttpOnly, do đó nếu trang dính lỗi XSS thì kẻ tấn công sẽ lấy trọn vẹn dữ liệu.",
                "LocalStorage dễ bị đánh cắp bởi mã độc XSS");

        createItem(lesson,
                "Cơ chế session HttpOnly trên server đem lại lợi ích lớn nhất nào cho kiến trúc đồng bộ nhiều thiết bị?",
                "Khi bạn dùng cả điện thoại lẫn máy tính cá nhân để học tập.",
                "Dữ liệu trạng thái học tập nằm tập trung 100% trên server, client chỉ mang định danh phiên",
                List.of("Không cần kết nối mạng vẫn đăng nhập được", "Server tự động tắt khi không có người dùng", "Giảm kích thước file HTML xuống 0 byte"),
                "Toàn bộ tiến độ lưu trên server, máy tính hay điện thoại chỉ cần xác thực qua cookie là cùng xem chung 1 tiến độ tức thì.",
                "Dữ liệu lưu tập trung trên server đồng bộ");
    }

    private void seedItemsForLesson3(Lesson lesson) throws Exception {
        createItem(lesson,
                "Thuật toán SM-2 trong hệ thống Spaced Repetition dùng đại lượng nào để biểu thị độ dễ của kiến thức?",
                "Đại lượng này được điều chỉnh tăng hoặc giảm sau mỗi lần người dùng ôn tập.",
                "Hệ số Ease (mặc định ban đầu là 2.5)",
                List.of("Hệ số IQ", "Chỉ số Streak", "Điểm kinh nghiệm XP"),
                "Hệ số Ease là tỷ lệ nhân khoảng cách ngày ôn tập giữa các lần; mặc định 2.5 và có sàn tối thiểu là 1.3.",
                "Hệ số Ease biểu thị độ dễ của kiến thức");

        createItem(lesson,
                "Theo công thức SM-2 rút gọn trong dự án, khoảng cách ôn tập lần 1 và lần 2 khi trả lời đúng lần lượt là bao nhiêu ngày?",
                "Hai mốc đầu tiên này giúp củng cố kiến thức trước khi bắt đầu nhân với hệ số Ease.",
                "Lần 1 là 1 ngày, lần 2 là 3 ngày",
                List.of("Lần 1 là 5 ngày, lần 2 là 10 ngày", "Lần 1 là 2 ngày, lần 2 là 4 ngày", "Lần 1 là 7 ngày, lần 2 là 14 ngày"),
                "Chu kỳ chuẩn: Lần 1 đúng -> 1 ngày; Lần 2 đúng -> 3 ngày; Lần 3 trở đi -> round(intervalDays * ease).",
                "Lần 1 là 1 ngày, lần 2 là 3 ngày");

        createItem(lesson,
                "Mức sàn tối thiểu của hệ số Ease trong thuật toán SM-2 rút gọn là bao nhiêu?",
                "Mức sàn này ngăn ngừa tình trạng hệ số Ease giảm quá sâu khiến khoảng cách ngày ôn bị đóng băng.",
                "1.3",
                List.of("1.0", "0.5", "2.0"),
                "Công thức quy định ease = max(1.3, ease + ...) để đảm bảo khoảng cách ôn tập luôn có sự giãn cách nhất định.",
                "Mức sàn tối thiểu của Ease là 1.3");

        createItem(lesson,
                "Trong quy tắc SM-2 của dự án, khi trả lời đúng dưới 5 giây thì điểm chất lượng quality (q) được tính là mấy?",
                "Thời gian phản hồi nhanh chứng tỏ phản xạ ghi nhớ của người học rất vững chắc.",
                "5 điểm (mức tối đa)",
                List.of("3 điểm", "4 điểm", "10 điểm"),
                "Đúng dưới 5 giây đạt chất lượng tuyệt đối q = 5, giúp tăng hệ số Ease nhanh hơn.",
                "Đúng dưới 5 giây tính điểm q = 5");

        createItem(lesson,
                "Nếu một Item chưa từng học lần nào (introduced = false) mà trả lời sai ở lần đầu gặp, hệ thống xử lý chỉ số lapse thế nào?",
                "Quy tắc tâm lý học giúp người học không bị phạt khi tiếp xúc kiến thức hoàn toàn mới.",
                "Chưa tính là lapse (lapses giữ nguyên không tăng)",
                List.of("Tăng lapses lên 5 đơn vị", "Khóa tài khoản người dùng", "Xóa Item đó khỏi khóa học"),
                "Lần đầu tiên tiếp xúc kiến thức mà trả lời sai là điều bình thường, chỉ tính lapse từ lần ôn tập sau trở đi.",
                "Lần đầu gặp sai chưa tính là lapse");

        createItem(lesson,
                "Khi tính toán ngày đến hạn ôn tập (dueAt), nếu ngày này rơi vào sau ngày thi thì hệ thống xử lý ra sao?",
                "Mục đích tối thượng của ứng dụng là phục vụ kỳ thi sắp tới của người dùng.",
                "Tự động kéo ngày ôn tập về trước ngày thi",
                List.of("Hủy bỏ kỳ thi", "Xóa toàn bộ câu hỏi", "Cộng thêm 100 điểm XP"),
                "Ôn thi sau ngày thi là vô nghĩa, do đó thuật toán sẽ kéo dueAt về trước ngày thi để người học kịp ôn tập.",
                "Kéo ngày ôn tập về trước ngày thi");
    }

    private void createItem(Lesson lesson, String prompt, String intro, String answer, List<String> distractors, String explanation, String sourceQuote) throws Exception {
        Item item = new Item(lesson.getId(), prompt, intro, answer, objectMapper.writeValueAsString(distractors), explanation, sourceQuote);
        itemRepository.save(item);

        ItemState state = new ItemState(item.getId());
        state.setEase(2.5);
        state.setIntervalDays(0);
        state.setRepetitions(0);
        state.setLapses(0);
        state.setIntroduced(false);
        itemStateRepository.save(state);
    }
}
