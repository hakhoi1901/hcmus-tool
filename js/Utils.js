import { runScheduleSolver } from './tkb/Scheduler.js';
import { renderCourseList } from './render/Dashboard.js';

// Biến toàn cục lưu dữ liệu gốc
let GLOBAL_COURSE_DB = [];

// --- HÀM KHỞI TẠO ---
export async function initApp() {
    // 1. Load dữ liệu có sẵn (Offline hoặc JSON) vào biến toàn cục ngay lập tức
    const data = await loadCourseData();
    GLOBAL_COURSE_DB = data;
    console.log(`✅ Đã nạp ${GLOBAL_COURSE_DB.length} môn vào bộ nhớ ứng dụng.`);
    
    // Nếu có hàm render danh sách môn bên Main.js hoặc UI thì gọi cập nhật (nếu cần)
    if(window.renderCourseList) window.renderCourseList(GLOBAL_COURSE_DB);

    window.addEventListener("message", (event) => {
        // Kiểm tra nguồn gốc dữ liệu cho an toàn
        if (payload.rawOpenCourses && payload.rawOpenCourses.length > 0) {
            const payload = event.data.payload;
            
            console.log("📥 Đã nhận dữ liệu từ Portal:", payload);
            
            // GLOBAL_COURSE_DB = processedDB;
            
            // 1. LƯU DASHBOARD (Điểm, Lịch thi...)
            localStorage.setItem('student_db_full', JSON.stringify(payload));
            if(window.renderDashboardUI) window.renderDashboardUI(payload);

            // 2. XỬ LÝ & LƯU DANH SÁCH LỚP (QUAN TRỌNG)
            // Kiểm tra xem payload có rawOpenCourses không (do Bookmarklet gửi về)
            if (payload.rawOpenCourses && payload.rawOpenCourses.length > 0) {
                console.log(`⚙️ Đang xử lý ${payload.rawOpenCourses.length} lớp học thô...`);
                
                // Gọi Utils để chuyển đổi Text -> Bitmask
                const processedDB = processRawCourseData(payload.rawOpenCourses);
                
                console.log("✅ Kết quả xử lý:", processedDB);

                if (processedDB.length > 0) {
                    // LƯU VÀO LOCAL STORAGE NGAY LẬP TỨC
                    localStorage.setItem('course_db_offline', JSON.stringify(processedDB));
                    console.log("💾 Đã lưu course_db_offline vào LocalStorage thành công!");
                    
                    // Cập nhật lên màn hình ngay mà không cần F5
                    GLOBAL_COURSE_DB = processedDB;
                    if(window.renderCourseList) window.renderCourseList(GLOBAL_COURSE_DB);
                    
                    alert(`Đã cập nhật ${processedDB.length} môn học vào bộ nhớ đệm!`);
                }
            } else {
                console.warn("⚠️ Payload không có danh sách lớp mở (rawOpenCourses). Kiểm tra lại Bookmarklet!");
            }

            // Báo thành công UI
            const statusEl = document.getElementById('status-area');
            if (statusEl) {
                statusEl.innerText = "✅ Đồng bộ thành công!";
                statusEl.classList.add('success');
            }
        }
    }, false);
    
    // Gán các hàm cần thiết vào window
    window.toggleRow = toggleRow;
    window.filterCourses = filterCourses;
    window.onNutBamXepLich = onNutBamXepLich;
    window.runScheduleSolver = runScheduleSolver; 
}

// --- CÁC HÀM UTILS & RENDER ---

// [QUAN TRỌNG] Hàm này đã được sửa để ưu tiên LocalStorage
async function loadCourseData() {
    // 1. ƯU TIÊN KIỂM TRA LOCAL STORAGE TRƯỚC
    const offlineData = localStorage.getItem('course_db_offline');
    
    if (offlineData) {
        try {
            const parsed = JSON.parse(offlineData);
            // Kiểm tra sơ bộ xem dữ liệu có hợp lệ không
            if (Array.isArray(parsed) && parsed.length > 0) {
                console.log("✅ Đã tải dữ liệu lớp từ LocalStorage (Offline).");
                return parsed; // <--- Trả về luôn, không fetch nữa
            }
        } catch (e) {
            console.warn("⚠️ Dữ liệu LocalStorage lỗi, sẽ tải file mẫu.");
            localStorage.removeItem('course_db_offline'); // Xóa đi cho sạch
        }
    }

    // 2. NẾU KHÔNG CÓ (HOẶC LỖI) MỚI ĐI TẢI FILE
    console.log("ℹ️ Không có dữ liệu Offline, đang tải file Course_db.json...");
    try {
        const response = await fetch('./js/tkb/Course_db.json'); 
        if (!response.ok) throw new Error("Không tải được file dữ liệu môn học!");
        return await response.json();
    } catch (error) {
        console.error("❌ Lỗi tải data:", error);
        return []; // Trả về mảng rỗng để không crash app
    }
}

function toggleRow(subjID) {
    const row = document.getElementById(`row-${subjID}`);
    const chk = row.querySelector('.chk-course');
    const sel = document.getElementById(`sel-${subjID}`);

    if (chk.checked) {
        row.classList.add('selected');
        sel.disabled = false;
    } else {
        row.classList.remove('selected');
        sel.disabled = true;
        sel.value = "";
    }
}

function filterCourses() {
    const keyword = document.getElementById('inp-search').value.toLowerCase();
    const rows = document.querySelectorAll('.course-row');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(keyword)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

// --- LOGIC XẾP LỊCH ---

async function onNutBamXepLich() {
    const btn = document.querySelector('button[onclick="onNutBamXepLich()"]');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Đang tính toán...";
    btn.disabled = true;

    try {
        const userWants = [];
        const fixed = {};
        
        const checkboxes = document.querySelectorAll('.chk-course:checked');
        
        if (checkboxes.length === 0) {
            alert("Bạn chưa chọn môn học nào!");
            return;
        }

        checkboxes.forEach(chk => {
            const subjID = chk.value;
            userWants.push(subjID);
            const dropdown = document.getElementById(`sel-${subjID}`);
            if (dropdown && dropdown.value !== "") {
                fixed[subjID] = dropdown.value;
            }
        });

        const pref = parseInt(document.getElementById('sel-session-pref').value);

        // Gọi Engine
        if (runScheduleSolver) {
            // setTimeout để UI kịp update
            setTimeout(() => {
                const ketQua = runScheduleSolver(GLOBAL_COURSE_DB, userWants, fixed, pref);
                console.log("Kết quả:", ketQua);
                renderScheduleResults(ketQua);
                btn.innerText = originalText;
                btn.disabled = false;
            }, 50);
        } else {
            alert("Engine chưa tải xong!");
            btn.innerText = originalText;
            btn.disabled = false;
        }

    } catch (e) {
        console.error(e);
        alert("Lỗi: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function decodeScheduleMask(parts) {
    let slots = [];
    for (let i = 0; i < 4 && i < parts.length; i++) {
        let part = parts[i];
        for (let bit = 0; bit < 32; bit++) {
            if ((part & (1 << bit)) !== 0) {
                let totalBit = i * 32 + bit;
                let day = Math.floor(totalBit / 10);
                let period = totalBit % 10;
                if (day < 7) slots.push({ day: day, period: period });
            }
        }
    }
    return slots;
}

// Chuyển mảng string ["T2(1-3)"] -> Bitmask [int, int, int, int]
export function encodeScheduleToMask(scheduleStrArray) {
    let mask = [0, 0, 0, 0]; 
    if (!Array.isArray(scheduleStrArray)) return mask;

    scheduleStrArray.forEach(str => {
        const parsed = parseScheduleString(str);
        if (parsed) {
            for (let i = parsed.start; i <= parsed.end; i++) {
                const bitIndex = (parsed.day * 10) + (i - 1); 
                const arrayIndex = Math.floor(bitIndex / 32);
                const bitPos = bitIndex % 32;
                if (arrayIndex < 4) mask[arrayIndex] |= (1 << bitPos);
            }
        }
    });
    return mask;
}


// File: js/Utils.js

export function clearCacheAndReload() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu đã lưu và tải lại trang?")) {
        // Xóa các key quan trọng nhất
        localStorage.removeItem('course_db_offline');
        localStorage.removeItem('student_db_full');
        
        // Reload để áp dụng thay đổi
        window.location.reload();
    }
}

// Gán vào window để gọi được từ button onclick trong HTML
window.clearAppCache = clearCacheAndReload;