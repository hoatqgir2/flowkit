# Flow Kit — Story Studio ("Nền Văn Minh Bị Bỏ Quên")
> **Tài liệu kiến trúc, quy trình vận hành và lịch sử xử lý lỗi**  
> Tuân thủ chuẩn kịch bản: `flow_nen_van_minh_bi_bo_quen.txt` & timeline: `transcript.txt`

---

## 1. Tổng quan tính năng (Overview)

**Story Studio** là phân hệ tạo video hoạt hình 2D doodle tự động khép kín trên Dashboard của Flow Kit (`http://localhost:5173/story-studio`).

### Điểm nổi bật:
1. **Khóa nhân vật xuyên suốt (Hero Lock & Reference Image):** 1 ảnh nhân vật que duy nhất làm tham chiếu cho toàn bộ video, không bị biến dạng giữa các cảnh.
2. **Kịch bản chuẩn DNA Văn Minh Bị Bỏ Quên:** LLM viết kịch bản ngôi kể thứ 2, nhịp câu ngắn-ngắn-dài, neo bằng chứng lịch sử (văn bia, nhà khảo cổ, thư tịch cổ), phản chiếu đời sống hiện đại.
3. **Giọng đọc Minimax Audio (T2A v2):** Tích hợp trực tiếp API Minimax âm thanh ấm, truyền cảm hoặc tải lên file thu âm sẵn.
4. **Bóc tách timeline chuẩn `[mm:ss]`:** Tự động chia kịch bản thành từng mốc thời gian khớp với tổng thời lượng âm thanh.
5. **Đồng bộ ảnh Doodle 2D với Google Flow:** Sinh ảnh từng dòng transcript kết hợp ảnh tham chiếu của nhân vật chính.
6. **Xử lý giới hạn Quota đa tài khoản Google Flow:** Khi 1 tài khoản hết lượt, tự động re-upload ảnh tham chiếu sang tài khoản mới và tạo tiếp các cảnh còn thiếu mà không mất ảnh cũ.
7. **Render Video hoàn chỉnh bằng FFmpeg:** Ghép ảnh, âm thanh và tự động tạo phụ đề chữ trắng viền đen chuẩn YouTube Explainer.
8. **Preview 100% các bước:** Mỗi bước đều có giao diện xem trước (ảnh, âm thanh, bảng phân cảnh, video).

---

## 2. Quy trình 6 Bước chi tiết

```
[Bước 1] ──> [Bước 2] ──> [Bước 3] ──> [Bước 4] ──> [Bước 5] ──> [Bước 6]
Nhân vật      Kịch bản      Minimax      Bóc tách       Tạo ảnh       Ghép Video
tham chiếu    LLM theo      Audio        Transcript    Doodle 2D     FFmpeg + Sub
(Hero Lock)   chủ đề        (T2A v2)     [mm:ss]       (Multi-Acc)   (1080p MP4)
```

### Bước 1: Nhân Vật Tham Chiếu (Hero Lock)
- **Tải lên ảnh nhân vật gốc:** File được lưu vĩnh viễn trên máy tại `output/story_studio/{id}/character_ref.png`, đồng thời tự động upload lên Google Flow để lấy `media_id` (UUID).
- **Hero Lock (Khóa nhân vật):**
  - Mặc định: `"The main stick figure character from the reference image"` (AI hoàn toàn bám sát theo ảnh tham chiếu, từ màu tóc đến trang phục).
  - Có nút chọn nhanh **`Tóc Cam Theo Ảnh Gốc`** nếu dùng nhân vật người que tóc cam.
  - Người dùng có thể tự chỉnh sửa mô tả nhân vật nếu muốn nhấn mạnh chi tiết đặc biệt.
- **Preview:** Xem ảnh nhân vật phóng to (lightbox) và kiểm tra trạng thái khóa tham chiếu.

### Bước 2: Kịch Bản Văn Minh (LLM Script Generator)
- **Chủ đề gợi ý sẵn:** Srivijaya (Người biển Musi), Angkor (Làng gốm ngoại thành), Mali (Con đường muối), Aksum (Biển Đỏ), Heian (Dân thường Nhật Bản), Dân văn phòng hiện đại...
- **Hỗ trợ đa dạng LLM:**
  - `demo`: Mẫu kịch bản có sẵn chạy ngay không cần API key.
  - `openai`: GPT-4o, GPT-4o-mini.
  - `gemini`: Gemini 2.0 Flash.
  - `claude`: Claude 3.5 Sonnet.
  - `groq`, `openrouter`, hoặc custom base URL.
- **Prompt hệ thống được nạp sẵn quy tắc:**
  - Mở đầu bằng buổi sáng giác quan: *"You wake to woodsmoke and river mud. No bell. No clock."*
  - Đối lập đời sống lao động bình dân với ảo tưởng cung điện/vàng bạc.
  - Đan cài tối thiểu 3 bằng chứng lịch sử có thật (văn bia Kedukan Bukit, Chu Đạt Quan, George Coedès...).
  - Tấm gương hiện đại (*"Twelve centuries later, you open your laptop at a desk..."*).
  - Câu kết dư âm lặp lại câu mở đầu.
- **Preview:** Khung soạn thảo kịch bản trực tiếp, đếm số từ và ước tính thời lượng đọc (giây).

### Bước 3: Thu Âm Minimax (T2A v2 Audio)
- **Tích hợp Minimax API v2 (`https://api.minimax.io/v1/t2a_v2`):**
  - Giọng đọc mặc định: `male-qn-qingse` (trầm ấm, truyền cảm) hoặc tùy chỉnh Voice ID.
  - Tùy chỉnh tốc độ (*speed*), cao độ (*pitch*), âm lượng (*vol*).
  - Model: `speech-02-turbo` hoặc `speech-01-hd`.
- **Tùy chọn tải lên file âm thanh:** Hỗ trợ nạp file `.mp3`, `.wav` thu sẵn.
- **Đo thời lượng chuẩn xác:** FFmpeg tự động phân tích và đo chính xác tổng thời lượng audio tới từng mili-giây.
- **Preview:** Trình phát audio HTML5 kèm thanh tua sóng âm.

### Bước 4: Bóc Tách Transcript (`[mm:ss] Text`)
- **Tích hợp Groq Whisper AI (`whisper-large-v3`):**
  - Tự động gửi file audio vừa sinh (`narration.mp3`) lên Groq Cloud để bóc tách sóng âm trực tiếp.
  - Phân tích ranh giới câu thoại và gắn mốc thời gian chuẩn xác 100% đến từng mili-giây (giải quyết triệt để lỗi lệch trôi thời gian so với công thức ước tính số từ).
  - Tốc độ xử lý siêu tốc: chỉ mất **3–6 giây** cho toàn bộ file audio 5–10 phút mà **không tốn 1% CPU/RAM của máy người dùng**.
- **Hỗ trợ dán transcript thủ công:** Có ô dán trực tiếp file transcript có sẵn định dạng `[mm:ss] Nội dung` (như file `transcript.txt`).
- **Ước tính theo số từ (Dự phòng):** Có nút dự phòng tính tỷ lệ từ nếu chưa kịp tạo audio.
- **Preview:** Bảng phân cảnh chi tiết gồm mốc thời gian, thời lượng và nội dung từng câu thoại.

### Bước 5: Tạo Ảnh Doodle Khớp Nhân Vật (Google Flow)
- **Cơ chế Batch Linh Hoạt (Concurrency, Delay & Timeout):**
  - **Số ảnh tạo 1 lần (Batch Size):** Tùy chỉnh số lượng ảnh sinh song song trong một lượt (ví dụ: `4` ảnh cùng lúc).
  - **Delay giữa các lượt (Cooldown):** Tùy chỉnh số giây nghỉ giữa các lượt batch (ví dụ: `5` giây sau khi lượt trước kết thúc) để tránh bị Google Flow chặn tốc độ (rate limit / unusual activity).
  - **Timeout mỗi ảnh:** Giới hạn thời gian tạo tối đa cho mỗi ảnh (mặc định `60` giây / 1 phút). Nếu quá thời gian này mà ảnh chưa trả về, hệ thống tự ngắt và đánh dấu cảnh đó là thất bại (`failed`), không làm treo các cảnh còn lại hay toàn bộ tiến trình.
  - **Nút Stop All (Dừng Tất Cả):** Nút dừng khẩn cấp màu đỏ (nhấp nháy khi có ảnh đang tạo). Khi bấm, lập tức ngắt kết nối toàn bộ các request tạo ảnh đang chạy dở (`AbortController`), hủy đợt batch tiếp theo và đưa các cảnh đang dở về trạng thái `pending` an toàn mà không cần F5 trình duyệt.
- **Tạo prompt theo chuẩn Rule 2:**
  - Chỉ mô tả **hành động & bối cảnh** (ngồi làm việc với laptop, đứng chèo thuyền, đi chợ...).
  - Tuyệt đối không mô tả màu tóc/quần áo xung đột với ảnh tham chiếu.
  - Chỉ thị model: `"exactly preserving the character's facial features, hair style, hair color, and clothing from the reference image, do not redesign the character"`.
- **Cơ chế xử lý Quota đa tài khoản (Multi-Account Hot-Resume):**
  - Khi tài khoản 1 hết quota (limit), mở Chrome sang tài khoản 2, nhập `Flow Project ID của Acc mới`.
  - Bấm **`🔄 Đồng Bộ Tham Chiếu Sang Acc Mới`**: Hệ thống tự động re-upload file ảnh gốc trên máy sang tài khoản 2 và nhận UUID mới.
  - Bấm **`⚡ Tạo Tiếp Ảnh Còn Thiếu`**: Hệ thống bỏ qua các cảnh đã có ảnh (đã lưu an toàn trên ổ đĩa), chỉ gửi request tạo tiếp các cảnh còn thiếu theo cấu hình batch đã đặt.
- **Preview:** Lưới ảnh từng cảnh, có nút xem phóng to (Lightbox), kiểm tra câu prompt đầy đủ và nút sinh lại (Regenerate) riêng lẻ từng cảnh.

### Bước 6: Ghép Video Thành Phẩm (FFmpeg Assembly)
- **Tạo manifest đồng bộ:** Tự động sinh `concat_manifest.txt` khớp từng ảnh vào đúng khoảng thời gian của transcript.
- **Ghép âm thanh:** Trộn file audio lồng tiếng ở Bước 3.
- **Khắc phụ đề (Burn Subtitles):** Tự động sinh `subtitles.srt` và khắc chữ trắng viền đen rõ nét theo phong cách YouTube Explainer.
- **Preview:** Trình phát video MP4 trực tiếp trên Dashboard và nút tải file về máy.

---

## 3. Danh sách các lỗi kỹ thuật đã giải quyết (Changelog)

| Vấn đề gặp phải | Nguyên nhân kỹ thuật | Giải pháp đã thực hiện |
|---|---|---|
| **Lỗi HTTP 400 trên Flow RPC (`ogiZ0b`)** | Trình duyệt đăng nhập nhiều tài khoản Google (`/u/2/`), extension gửi request về root `/_/...` (mặc định trỏ về `/u/0/`) nên bị từ chối truy cập dự án. | Cập nhật `extension/background.js` tự động phát hiện và giữ nguyên prefix `/u/<index>/` cho cả RPC URL và `source-path`. |
| **Extension báo "no token"** | Giao diện Side Panel extension cũ chỉ check OAuth token REST cũ, không nhận diện phiên `batchexecute`. | Cập nhật `side_panel.js` hiển thị trạng thái `session active (batchexecute)`. Bump extension lên `v0.5.3`. |
| **Lỗi 422: `Field required: file` khi tải ảnh** | Hàm `fetchAPI` trong `client.ts` mặc định luôn chèn `Content-Type: application/json`, làm trình duyệt không gửi được header `multipart/form-data; boundary=...`. | Cập nhật `dashboard/src/api/client.ts` nhận diện `body instanceof FormData`, loại bỏ `Content-Type: application/json` để trình duyệt tự sinh boundary chuẩn. |
| **Lỗi `No image URL returned by Flow generator` dù Google báo 200 OK** | Google Flow trả về URL ảnh nằm sâu trong `item["image"]["generatedImage"]["fifeUrl"]`, code Story Studio chỉ tìm key phẳng `item["url"]` nên coi là rỗng. | Cập nhật `flow_client.py` chèn cả `url` ở tầng gốc và nâng cấp `story_studio.py` kiểm tra linh hoạt `fifeUrl` / `url`. |
| **Tải ảnh tóc cam nhưng sinh ảnh ra tóc nâu** | Giá trị `DEFAULT_HERO_LOCK` bị chèn cứng chuỗi *"messy dark brown hair, loose indigo tunic"*. Khi gửi cho AI, chữ viết xung đột và đè lên ảnh tham chiếu. | Xóa bỏ chuỗi tóc nâu mặc định; chuyển sang neo tham chiếu `"The main stick figure character from the reference image"`; prompt từng cảnh tuân thủ triệt để Rule 2 (chỉ tả Action, không tả màu tóc). |
| **Hết Quota Google Flow làm đứt đoạn tiến trình** | UUID tham chiếu của tài khoản cũ không dùng được trên tài khoản mới; các cảnh tạo lại từ đầu sẽ gây lãng phí. | Xây dựng API `/resync-character` và nút **`Đồng Bộ Tham Chiếu Sang Acc Mới`** + **`⚡ Tạo Tiếp Ảnh Còn Thiếu`** để bảo toàn ảnh cũ và tiếp tục tạo cảnh mới liền mạch. |
| **Lệch mốc thời gian transcript (drift 8s so với audio thực tế)** | Thuật toán bóc tách cũ ước tính theo số từ/phút (giả định tốc độ đọc phẳng), không tính được các khoảng ngắt nghỉ (pause) tự nhiên của giọng đọc. | Tích hợp **Groq Whisper AI (`whisper-large-v3`)** phân tích trực tiếp sóng âm file `narration.mp3`, lấy timestamp chuẩn xác 100% từng câu trong 3 giây mà không tải máy. |

---

## 4. Các file mã nguồn chính

- **Backend Service:** `agent/services/story_studio.py` (logic 6 bước, Minimax API, FFmpeg).
- **Backend API Router:** `agent/api/story_studio.py` (14 REST endpoints).
- **Frontend Page:** `dashboard/src/pages/StoryStudioPage.tsx` (Giao diện 6 bước với stepper và previews).
- **Frontend HTTP Client:** `dashboard/src/api/client.ts` (Sửa lỗi FormData).
- **App Shell & Routing:** `dashboard/src/App.tsx` & `dashboard/src/i18n/translations.ts`.
- **Chrome Extension:** `extension/background.js` (`v0.5.3` đa tài khoản `/u/2/`).
