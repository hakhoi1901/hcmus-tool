// ================= DASHBOARD.JS =================
// Module chuyên trách việc vẽ giao diện (View)
// ================================================

// --- 1. PHẦN HIỂN THỊ THÔNG TIN SINH VIÊN ---

export function renderDashboardUI(data) {
    const resultWrapper = document.getElementById('result-wrapper'); 
    if (resultWrapper) resultWrapper.style.display = 'block';

    renderInfo(data);       // Thông tin chung
    renderTuition(data);    // Học phí
    renderExams(data);      // Lịch thi
    renderGrades(data);     // Điểm
    renderProgram(data);    // Chương trình đào tạo
}

function renderInfo(data) {
    const lblMssv = document.getElementById('lbl-studentname');
    const lblCount = document.getElementById('lbl-count');
    if(lblMssv) lblMssv.innerText = data.mssv || 'Unknown';
    if(lblCount) lblCount.innerText = (data.grades || []).length;
}

function renderProgram(data) {
    let section = document.getElementById('section-program');
    if (!section) {
        const wrapper = document.getElementById('result-wrapper');
        if (!wrapper) return;
        section = document.createElement('div');
        section.id = 'section-program';
        section.className = 'section-box';
        section.innerHTML = `<h4 class="section-title">🎓 Tiến độ học tập</h4>
            <div class="info-row"><span>Tổng môn CTĐT: <b id="lbl-prog-total">0</b></span><span>Đã qua: <b id="lbl-prog-done" style="color:green">0</b></span></div>
            <div class="table-scroll" style="max-height: 300px;"><table id="tbl-program"><thead><tr><th>Mã Môn</th><th>Tên Môn</th><th>TC</th><th>Trạng thái</th></tr></thead><tbody></tbody></table></div>`;
        wrapper.appendChild(section);
    }
    const tbody = section.querySelector('tbody');
    tbody.innerHTML = '';
    const program = data.program || [];
    const grades = data.grades || [];
    const passedSubjects = new Set();
    grades.forEach(g => { if (typeof g.score === 'number' && g.score >= 5.0) passedSubjects.add(g.id); });
    let doneCount = 0;
    program.forEach(p => {
        const isDone = passedSubjects.has(p.id);
        if (isDone) doneCount++;
        const tr = document.createElement('tr');
        tr.style.background = isDone ? '#f0fdf4' : 'white';
        tr.innerHTML = `<td style="font-weight:bold; color:${isDone ? '#15803d' : '#666'}">${p.id}</td><td>${p.name}</td><td style="text-align:center">${p.credits}</td><td style="text-align:center">${isDone ? '<span style="color:#15803d; font-weight:bold">✔ Đã xong</span>' : '<span style="color:#ca8a04; font-size:12px">Chưa học</span>'}</td>`;
        tbody.appendChild(tr);
    });
    const lblTotal = document.getElementById('lbl-prog-total');
    const lblDone = document.getElementById('lbl-prog-done');
    if(lblTotal) lblTotal.innerText = program.length;
    if(lblDone) lblDone.innerText = doneCount;
}

function renderTuition(data) {
    const tuitionData = data.tuition || { total: "0", details: [] };
    const totalMoney = (typeof tuitionData === 'object') ? tuitionData.total : tuitionData;
    const detailsMoney = (typeof tuitionData === 'object' && tuitionData.details) ? tuitionData.details : [];

    const lblTotal = document.getElementById('lbl-tuition-total');
    if (lblTotal) lblTotal.innerText = totalMoney;

    const tbody = document.querySelector('#tbl-tuition tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (detailsMoney.length > 0) {
            detailsMoney.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><div style="font-weight:bold; font-size:11px; color:#666">${t.code}</div>${t.name}</td>
                    <td style="text-align:center">${t.credits}</td>
                    <td style="text-align:right; font-weight:bold; color:#ef4444">${t.fee}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:grey">Không có dữ liệu</td></tr>';
        }
    }
}

function renderExams(data) {
    const tbody = document.querySelector('#tbl-exams tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (data.exams && data.exams.length > 0) {
        data.exams.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="white-space:nowrap">${e.sub}</td>
                <td>${e.date}</td>
                <td>${e.time}</td>
                <td style="color:#005a8d;font-weight:bold">${e.room}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:grey">Không có lịch thi sắp tới</td></tr>';
    }
}

function renderGrades(data) {
    const tbody = document.querySelector('#tbl-grades tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const gradeList = data.grades || [];
    if (gradeList.length > 0) {
        gradeList.forEach(g => {
            const tr = document.createElement('tr');
            let scoreColor = '#374151';
            let scoreText = g.score;

            if (g.score === '(*)' || g.score === null) {
                scoreText = '(*)';
                scoreColor = '#6b7280';
            } else if (typeof g.score === 'number') {
                if (g.score >= 8.0) scoreColor = '#059669';
                else if (g.score < 5.0) scoreColor = '#dc2626';
            }

            tr.innerHTML = `
                <td style="text-align:center; font-size:12px; color:#666;">${g.semester}</td>
                <td style="font-weight:bold; color:#005a8d;">${g.id}</td>
                <td>${g.name}</td>
                <td style="text-align:center;">${g.credits}</td>
                <td style="text-align:center; font-size:12px;">${g.class}</td>
                <td style="text-align:center; font-weight:bold; color:${scoreColor};">${scoreText}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:grey; padding: 20px;">Chưa có dữ liệu điểm</td></tr>';
    }
}

// --- 2. PHẦN CHỌN MÔN HỌC (CHO LOGIC XẾP LỊCH) ---

let _courseData = []; // Biến nội bộ lưu danh sách để tìm kiếm

// export function renderCourseList(courses) {
//     _courseData = courses; // Lưu lại để dùng cho hàm filter
//     const container = document.getElementById('course-list-area');
    
//     if(!container) {
//         console.error("Không tìm thấy div id='course-list-area' trong HTML");
//         return;
//     }
    
//     container.innerHTML = '';

//     if (!courses || courses.length === 0) {
//         container.innerHTML = '<div style="padding:10px; text-align:center">Chưa có dữ liệu lớp mở.</div>';
//         return;
//     }

//     let html = '';
//     courses.forEach(subj => {
//         // Render giao diện Checkbox
//         // Lưu ý: ID checkbox là 'chk-' + Mã môn
//         html += `
//             <div class="course-item" onclick="window.toggleCourse('${subj.id}')" style="cursor:pointer; display:flex; gap:10px; padding:8px; border-bottom:1px solid #eee;">
//                 <input type="checkbox" id="chk-${subj.id}" value="${subj.id}" style="pointer-events:none;"> 
//                 <div style="display:flex; flex-direction:column;">
//                     <span style="font-weight:bold; font-size:12px; color:#005a8d">${subj.id}</span>
//                     <span style="font-size:13px;">${subj.name}</span>
//                     <span style="font-size:11px; color:#666">Số lớp: ${subj.classes ? subj.classes.length : 0}</span>
//                 </div>
//             </div>
//         `;
//     });
//     container.innerHTML = html;
// }

export function renderCourseList(courses) {
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

// Hàm vẽ bảng thời khóa biểu kết quả
export function renderScheduleResults(results) {
    const container = document.getElementById('schedule-results-area');
    container.innerHTML = ''; 
    container.style.display = 'block';

    // KIỂM TRA LỖI TỪ SCHEDULER TRẢ VỀ
    if (results && results.error) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:red; font-weight:bold;">❌ ${results.error}</div>`;
        return;
    }

    // Kiểm tra nếu không phải mảng hoặc mảng rỗng
    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:red">Không tìm thấy lịch học phù hợp (hoặc xung đột giờ)!</div>';
        return;
    }
    // ---------------------------

    const days = ["Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "CN"];

    results.forEach((opt, index) => {
        // ... (Giữ nguyên logic vẽ bảng bên trong vòng lặp)
        // Copy lại phần code vẽ bảng cũ vào đây
        let grid = Array(10).fill(null).map(() => Array(7).fill(null));

        opt.schedule.forEach(subject => {
            if(subject.mask) {
                // Import hàm decodeScheduleMask hoặc định nghĩa nó ở trên
                const timeSlots = decodeScheduleMask(subject.mask); 
                timeSlots.forEach(slot => {
                    if (slot.period < 10) {
                        const cellContent = `
                            <div style="font-size:11px; font-weight:bold; color:#005a8d">${subject.subjectID}</div>
                            <div style="font-size:10px; opacity:0.8">${subject.classID}</div>
                        `;
                        if(grid[slot.period][slot.day]) grid[slot.period][slot.day] += "<hr style='margin:2px 0'>" + cellContent;
                        else grid[slot.period][slot.day] = cellContent;
                    }
                });
            }
        });

        let tableHTML = `
            <div class="schedule-option">
                <div class="schedule-header">
                    <span>PHƯƠNG ÁN ${opt.option}</span>
                    <span>Fitness: ${opt.fitness ? opt.fitness.toFixed(0) : 0}</span>
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
                    tableHTML += `<td class="tkb-cell-active">${content}</td>`;
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

export function toggleCourse(subjID) {
    const checkbox = document.getElementById(`chk-${subjID}`);
    if(checkbox) {
        checkbox.checked = !checkbox.checked; // Đảo trạng thái
        syncToSelectedList(subjID, checkbox.checked);
    }
}

export function removeCourse(subjID) {
    // Bỏ check bên trái
    const checkbox = document.getElementById(`chk-${subjID}`);
    if (checkbox) checkbox.checked = false;
    // Xóa bên phải
    syncToSelectedList(subjID, false);
}

function syncToSelectedList(subjID, isAdded) {
    const container = document.getElementById('selected-list-area');
    if(!container) return;

    const emptyState = container.querySelector('.empty-state');
    const subj = _courseData.find(s => s.id === subjID);
    if (!subj) return;

    if (isAdded) {
        if (emptyState) emptyState.remove();
        
        let options = `<option value="">-- AI Tự Xếp --</option>`;
        subj.classes.forEach(c => {
            options += `<option value="${c.id}">${c.id}</option>`;
        });

        // Kiểm tra xem đã có chưa để tránh trùng
        if(document.getElementById(`sel-item-${subjID}`)) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'selected-item';
        itemDiv.id = `sel-item-${subjID}`;
        itemDiv.innerHTML = `
            <div class="selected-header">
                <div>
                    <div style="font-weight:bold; font-size:12px; color:#005a8d">${subj.id}</div>
                    <div style="font-size:13px; font-weight:600">${subj.name}</div>
                </div>
                <button class="btn-remove" onclick="window.removeCourse('${subj.id}')" title="Bỏ chọn">✖</button>
            </div>
            <select class="class-dropdown">
                ${options}
            </select>
        `;
        container.appendChild(itemDiv);
    } else {
        const item = document.getElementById(`sel-item-${subjID}`);
        if (item) item.remove();
        if (container.children.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa chọn môn nào</div>';
        }
    }
    
    const countEl = document.getElementById('count-selected');
    if(countEl) countEl.innerText = document.querySelectorAll('.selected-item').length;
}

export function filterCourses() {
    const inp = document.getElementById('inp-search');
    if(!inp) return;
    const keyword = inp.value.toLowerCase();
    const rows = document.querySelectorAll('.course-item');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(keyword) ? 'flex' : 'none';
    });
}

// --- 3. PHẦN HIỂN THỊ KẾT QUẢ XẾP LỊCH ---

// Helper giải mã Bitmask
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