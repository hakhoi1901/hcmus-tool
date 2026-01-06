
// 1. IMPORT ENGINE XẾP LỊCH
// Lưu ý: Đường dẫn phải đúng so với vị trí file html
import { runScheduleSolver } from './tkb/Scheduler.js';

// Biến toàn cục lưu dữ liệu gốc
let GLOBAL_COURSE_DB = [];

// --- HÀM KHỞI TẠO ---
export function initApp() {
    window.addEventListener('load', async () => {
        // Tải dữ liệu cũ
        const oldData = localStorage.getItem('student_db_full');
        if(oldData && window.renderUI) {
            try { window.renderUI(JSON.parse(oldData)); } catch(e){}
        }

        // Tải danh sách môn học
        console.log("Đang tải course_db.json...");
        const data = await loadCourseData();
        if (data) {
            GLOBAL_COURSE_DB = data;
            renderCourseList(GLOBAL_COURSE_DB);
        }
    });
    
    // Gán các hàm cần thiết vào window để HTML gọi được (onclick)
    window.toggleRow = toggleRow;
    window.filterCourses = filterCourses;
    window.onNutBamXepLich = onNutBamXepLich;
    window.runScheduleSolver = runScheduleSolver; // Để debug
}

// --- CÁC HÀM UTILS & RENDER ---

async function loadCourseData() {
    try {
        const response = await fetch('./js/Tkb/Course_db.json'); 
        if (!response.ok) throw new Error("Không tải được file dữ liệu môn học!");
        return await response.json();
    } catch (error) {
        alert("Lỗi: " + error.message);
        return null;
    }
}

function renderCourseList(courses) {
    const container = document.getElementById('course-list-area');
    container.innerHTML = '';

    if (!courses || courses.length === 0) {
        container.innerHTML = '<div style="padding:10px; text-align:center">Không có dữ liệu môn học.</div>';
        return;
    }

    let html = '';
    courses.forEach(subj => {
        let classOptions = `<option value="">-- AI Tự Xếp --</option>`;
        subj.classes.forEach(c => {
            classOptions += `<option value="${c.id}">${c.id}</option>`;
        });

        html += `
            <div class="course-row" id="row-${subj.id}">
                <input type="checkbox" class="chk-course" value="${subj.id}" onchange="toggleRow('${subj.id}')">
                <div class="course-info">
                    <span class="course-code">${subj.id}</span>
                    <span class="course-name">${subj.name}</span>
                </div>
                <select id="sel-${subj.id}" class="fixed-class-select" disabled>
                    ${classOptions}
                </select>
            </div>
        `;
    });
    container.innerHTML = html;
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

function renderScheduleResults(results) {
    const container = document.getElementById('schedule-results-area');
    container.innerHTML = ''; 
    container.style.display = 'block';

    if (!results || results.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:red">Không tìm thấy lịch học phù hợp!</div>';
        return;
    }

    const days = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

    results.forEach((opt, index) => {
        let grid = Array(10).fill(null).map(() => Array(7).fill(null));

        opt.schedule.forEach(subject => {
            const timeSlots = decodeScheduleMask(subject.mask);
            timeSlots.forEach(slot => {
                if (slot.period < 10) {
                    const cellContent = `
                        <div style="font-size:11px; font-weight:bold; color:#005a8d">${subject.subjectID}</div>
                        <div style="font-size:10px; opacity:0.8">${subject.classID}</div>
                    `;
                    // Nối nội dung nếu trùng lịch
                    if(grid[slot.period][slot.day]) grid[slot.period][slot.day] += "<hr style='margin:2px 0'>" + cellContent;
                    else grid[slot.period][slot.day] = cellContent;
                }
            });
        });

        let tableHTML = `
            <div class="schedule-option">
                <div class="schedule-header">
                    <span>OPTION ${opt.option}</span>
                    <span>Điểm: ${opt.fitness.toFixed(0)}</span>
                </div>
                <table class="tkb-grid">
                    <thead>
                        <tr>
                            <th class="period-col">Tiết</th>
                            ${days.map(d => `<th>${d}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (let p = 0; p < 10; p++) {
            tableHTML += `<tr>`;
            tableHTML += `<td class="period-col">${p + 1}</td>`;
            for (let d = 0; d < 7; d++) {
                const content = grid[p][d];
                if (content) {
                    tableHTML += `<td class="tkb-cell-active" title="Môn học">${content}</td>`;
                } else {
                    tableHTML += `<td></td>`;
                }
            }
            tableHTML += `</tr>`;
        }

        tableHTML += `</tbody></table></div>`;
        container.insertAdjacentHTML('beforeend', tableHTML);
    });
    
    container.scrollIntoView({ behavior: 'smooth' });
}
