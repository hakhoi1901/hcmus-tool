import { setupBookmarklet, openPortal } from './PortalHandler.js';
import { renderDashboardUI, renderCourseList, toggleCourse, removeCourse, filterCourses } from './render/Dashboard.js';
import { onNutBamXepLich } from './Logic.js';
import { CourseRecommender } from './tkb/Recommender.js';

// Setup
setupBookmarklet();

// Export hàm ra window
window.openPortal = openPortal;
window.toggleCourse = toggleCourse;
window.removeCourse = removeCourse;
window.filterCourses = filterCourses;
window.onNutBamXepLich = onNutBamXepLich;

// --- 1. XỬ LÝ SỰ KIỆN TỪ BOOKMARKLET GỬI VỀ ---
window.addEventListener("message", (event) => {
    if (!event.data) return;

    // A. Dữ liệu Sinh Viên
    if (event.data.type === 'PORTAL_DATA') {
        const payload = event.data.payload;
        localStorage.setItem('student_db_full', JSON.stringify(payload));
        renderDashboardUI(payload);
        
        const statusEl = document.getElementById('status-area');
        if (statusEl) {
            statusEl.innerText = "Đã cập nhật dữ liệu Sinh viên!";
            statusEl.className = 'status-msg success';
            statusEl.style.display = 'block';
        }
    }

    // B. Dữ liệu Lớp Mở -> RENDER NGAY LẬP TỨC
    if (event.data.type === 'OPEN_CLASS_DATA') {
        const courses = event.data.payload;
        localStorage.setItem('courses_db_offline', JSON.stringify(courses));
        
        // Gọi hàm Render
        renderCourseList(courses);

        const statusEl = document.getElementById('status-area');
        if (statusEl) {
            statusEl.innerText = `Đã cập nhật ${courses.length} môn học từ Portal!`;
            statusEl.className = 'status-msg success';
            statusEl.style.display = 'block';
        }
        
        // Cập nhật chỉ báo nguồn
        const ind = document.getElementById('data-source-indicator');
        if(ind) ind.innerText = "Nguồn: Dữ liệu vừa lấy từ Portal";

        alert(`Đã nhận ${courses.length} môn lớp mở. Giao diện đã được cập nhật!`);
    }
}, false);

// Hàm fetch json helper
async function fetchJson(path) {
    try {
        const res = await fetch(path);
        return res.ok ? await res.json() : [];
    } catch (e) {
        console.error(`Lỗi tải ${path}:`, e);
        return [];
    }
}

// --- KHỞI TẠO KHI LOAD TRANG ---
window.onload = async () => {
    // 1. Load thông tin SV
    let studentData = {};
    const oldStudentData = localStorage.getItem('student_db_full');
    if (oldStudentData) {
        try { 
            studentData = JSON.parse(oldStudentData);
            renderDashboardUI(studentData); 
        } catch (e) {}
    }

    // 2. Load dữ liệu Lớp Mở (Offline)
    let openCourses = [];
    const localCourses = localStorage.getItem('courses_db_offline');
    if (localCourses) {
        try { openCourses = JSON.parse(localCourses); } catch(e){}
    }
    
    // Fallback: Load file mẫu nếu không có data offline
    if (!openCourses || openCourses.length === 0) {
        openCourses = await fetchJson('./js/tkb/Course_db.json');
        const ind = document.getElementById('data-source-indicator');
        if(ind) ind.innerText = "Nguồn: File tĩnh (Mẫu)";
    } else {
        const ind = document.getElementById('data-source-indicator');
        if(ind) ind.innerText = "Nguồn: Portal (Offline)";
    }

    // 3. CHẠY LOGIC GỢI Ý
    let coursesToRender = openCourses; // Mặc định hiển thị tất cả lớp mở

    // Chỉ chạy nếu có dữ liệu SV
    if (studentData && studentData.grades && studentData.grades.length > 0) {
        try {
            // Tải dữ liệu JSON từ assets
            const [prereqs, allCoursesMeta] = await Promise.all([
                fetch('./assets/data/prerequisites.json').then(r => r.json()),
                fetch('./assets/data/courses.json').then(r => r.json())
            ]);

            const recommender = new CourseRecommender(studentData, openCourses, prereqs, allCoursesMeta);
            const recommendedList = recommender.recommend();

            if (recommendedList.length > 0) {
                // Nếu có gợi ý, hiển thị danh sách gợi ý
                coursesToRender = recommendedList;
                
                const ind = document.getElementById('data-source-indicator');
                if(ind) ind.innerHTML += " <br>✨ <b>Đang hiển thị danh sách môn GỢI Ý</b>";
            }
        } catch (e) {
            console.error("Lỗi khi chạy Recommender:", e);
        }
    }

    // Render ra màn hình
    renderCourseList(coursesToRender);
};