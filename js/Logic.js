import { runScheduleSolver } from './tkb/Scheduler.js';
import { renderScheduleResults } from './render/Dashboard.js';
import { encodeScheduleToMask } from './Utils.js'; // Đảm bảo import hàm này

// Hàm này sẽ được Main.js gán vào window.onNutBamXepLich
export async function onNutBamXepLich() {
    const btn = document.querySelector('button[onclick="onNutBamXepLich()"]');
    const originalText = btn ? btn.innerText : "Xếp Lịch";
    if(btn) {
        btn.innerText = "⏳ Đang tính toán...";
        btn.disabled = true;
    }

    if (!GLOBAL_COURSE_DB || GLOBAL_COURSE_DB.length === 0) {
        // Cố gắng load lại lần nữa nếu rỗng
        GLOBAL_COURSE_DB = await loadCourseData();
        if (GLOBAL_COURSE_DB.length === 0) {
            alert("⚠️ Chưa có dữ liệu môn học! Vui lòng tải lại trang hoặc đồng bộ từ Portal.");
            return;
        }
    }

    try {
        // 1. Lấy dữ liệu user chọn từ UI
        const userWants = [];
        const fixed = {};
        const checkboxes = document.querySelectorAll('.selected-item');
        
        if (checkboxes.length === 0) {
            alert("Bạn chưa chọn môn học nào!");
            throw new Error("No subjects selected");
        }

        checkboxes.forEach(item => {
            // ID dạng "sel-item-CSC001" -> lấy CSC001
            const subjID = item.id.replace('sel-item-', '');
            userWants.push(subjID);
            
            const dropdown = item.querySelector('.class-dropdown');
            if (dropdown && dropdown.value !== "") {
                fixed[subjID] = dropdown.value;
            }
        });

        const prefElement = document.getElementById('sel-session-pref');
        const pref = prefElement ? parseInt(prefElement.value) : 0;

        // 2. Lấy dữ liệu nguồn (Ưu tiên LocalStorage)
        // Lưu ý: Main.js đã đảm bảo data được load vào UI, 
        // nhưng Engine cần đọc lại để lấy full thông tin các lớp.
        let rawData = [];
        const localData = localStorage.getItem('courses_db_offline');
        
        if (localData) {
            rawData = JSON.parse(localData);
        } else {
            // Fallback tải lại file json nếu lỡ tay xóa storage mà chưa reload trang
            const res = await fetch('./js/tkb/Course_db.json');
            rawData = await res.json();
        }

        if (!rawData || rawData.length === 0) {
            throw new Error("Không tìm thấy dữ liệu môn học!");
        }

        // 3. CHUẨN HÓA DỮ LIỆU (QUAN TRỌNG)
        // Dữ liệu từ Portal chỉ có schedule string ["T2(1-3)"], chưa có bitmask.
        // Engine cần bitmask. Hàm này sẽ tạo bitmask cho engine.
        const normalizedDB = normalizeDataForEngine(rawData);

        // 4. Chạy Engine
        if (runScheduleSolver) {
            setTimeout(() => {
                const ketQua = runScheduleSolver(normalizedDB, userWants, fixed, pref);
                renderScheduleResults(ketQua);
                
                if(btn) {
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            }, 50);
        } else {
            throw new Error("Engine chưa tải xong");
        }

    } catch (e) {
        console.error(e);
        if (e.message !== "No subjects selected") alert("Lỗi: " + e.message);
        if(btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// Hàm chuẩn hóa dữ liệu cho Engine
function normalizeDataForEngine(data) {
    if (!Array.isArray(data)) return [];
    
    return data.map(subj => {
        const processedClasses = subj.classes.map(cls => {
            // Nếu chưa có mask (data từ Portal), thì tính từ schedule string
            let mask = cls.mask;
            if (!mask && cls.schedule) {
                mask = encodeScheduleToMask(cls.schedule);
            }
            // Nếu data từ JSON file cũ đã có mask thì giữ nguyên
            return {
                id: cls.id,
                schedule: cls.schedule || [],
                mask: mask || [0, 0, 0, 0] 
            };
        });

        return {
            id: subj.id,
            name: subj.name,
            credits: subj.credits,
            classes: processedClasses
        };
    });
}