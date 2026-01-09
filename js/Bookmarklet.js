(async function() {
    // === 1. CẤU HÌNH ===
    const CONFIG = {
        URL_DIEM: "/SinhVien.aspx?pid=211",
        URL_LICHTHI: "/SinhVien.aspx?pid=212",
        URL_HOCPHI: "/SinhVien.aspx?pid=331",
        URL_LOPMO: "/SinhVien.aspx?pid=327",
        TARGET_YEAR: "25-26",
        TARGET_SEM: "1"
    };

    const STORAGE_KEY = "HCMUS_TOOL_DATA";

    // === 2. CÁC HÀM CÀO DỮ LIỆU ===

    // Cào Bảng Điểm (Giữ nguyên)
    function scrapeGrades() {
        try {
            let mssv = "Unknown";
            const userEl = document.getElementById('user_tools');
            if (userEl) {
                const match = userEl.innerText.match(/Xin chào\s+([^|]+)/i);
                if (match) mssv = match[1].trim();
            }

            const grades = [];
            document.querySelectorAll('#tbDiemThiGK tbody tr').forEach(row => {
                if (row.cells.length < 6) return;
                const semester = row.cells[0]?.innerText.trim();
                const rawSubj = row.cells[1]?.innerText.trim();
                let id = "", name = rawSubj;
                if (rawSubj.includes(" - ")) {
                    const parts = rawSubj.split(" - ");
                    id = parts[0].trim();
                    name = parts.slice(1).join(" - ").trim();
                }
                const credits = row.cells[2]?.innerText.trim();
                const classID = row.cells[3]?.innerText.trim();
                const rawScore = row.cells[5]?.innerText.trim();
                let score = !isNaN(parseFloat(rawScore)) ? parseFloat(rawScore) : rawScore;

                if (id) grades.push({ semester, id, name, credits, class: classID, score });
            });
            return { mssv, grades };
        } catch (e) { return null; }
    }

    // Fetch Ngầm (Giữ nguyên)
    async function fetchBackgroundData(url, type) {
        try {
            const res = await fetch(url);
            const text = await res.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');

            if (type === 'EXAM') {
                const ex = [];
                doc.querySelectorAll('#tbLichThi tbody tr').forEach(row => {
                    if (row.cells.length > 3) {
                        ex.push({
                            sub: row.cells[1]?.innerText.trim(),
                            date: row.cells[2]?.innerText.trim(),
                            time: row.cells[3]?.innerText.trim(),
                            room: row.cells[4]?.innerText.trim()
                        });
                    }
                });
                return ex;
            }
            if (type === 'TUITION') {
                const details = [];
                doc.querySelectorAll('.dkhp-table tbody tr').forEach(row => {
                    const c = row.querySelectorAll('td');
                    if (c.length > 9) {
                        let rawName = c[2].innerText.trim();
                        let codeMatch = rawName.match(/\[(.*?)\]/);
                        let code = codeMatch ? codeMatch[1] : "";
                        let name = rawName.replace(/\[.*?\]/g, '').trim();
                        if (rawName) details.push({ code, name, credits: c[3].innerText.trim(), fee: c[9].innerText.trim() });
                    }
                });
                const totalEl = doc.querySelector('th[title="Tổng số phải đóng"]');
                return { total: totalEl ? totalEl.innerText.trim() : "0", details };
            }
        } catch (e) { return type === 'TUITION' ? { total: "0", details: [] } : []; }
        return [];
    }

    // --- PHẦN QUAN TRỌNG: CÀO LỚP MỞ & THỰC HÀNH (ADVANCED) ---

    // Helper: Parse chuỗi lịch (Tách T2(1-3) thành chuỗi chuẩn)
    function parseScheduleString(str) {
        if (!str) return [];
        const regex = /T(\d|CN)\((\d+(\.\d+)?)-(\d+(\.\d+)?)\)/g; // Hỗ trợ số thực (3.5) nếu có
        const matches = str.match(regex);
        return matches ? matches : [];
    }

    // Helper: Gọi API lấy lớp thực hành
    async function fetchPracticalClasses(lmid) {
        try {
            const url = `Modules/SVDangKyHocPhan/HandlerSVDKHP.ashx?method=LopThucHanh&lmid=${lmid}&dot=1`;
            const res = await fetch(url);
            const json = await res.json();
            return json.LopMoTHs || [];
        } catch (e) {
            console.error("Lỗi fetch TH:", e);
            return [];
        }
    }

    // Hàm chính cào dữ liệu (Async để đợi fetch TH)
    async function scrapeOpenClassesAsync() {
        const table = document.getElementById('tbPDTKQ');
        if (!table) return null;
        
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const courseMap = {}; 

        // Hiển thị loading vì quá trình này sẽ mất vài giây
        const noti = document.createElement('div');
        noti.style.cssText = "position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#fff;padding:15px;z-index:99999;border-radius:5px;font-family:sans-serif";
        noti.innerHTML = `⏳ Đang quét lớp thực hành... <br><span id='scan-progress'>0/${rows.length}</span>`;
        document.body.appendChild(noti);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            document.getElementById('scan-progress').innerText = `${i + 1}/${rows.length}`;
            
            const cells = row.cells;
            if (cells.length < 9) continue;

            // INDEX CỘT (Điều chỉnh theo Portal thực tế - ĐÃ FIX CHỈ SỐ CỘT Ở ĐÂY)
            // 0: Mã MH
            // 1: Tên MH
            // 2: Tên Lớp (Lý thuyết)
            // 3: Số TC
            // 7: Lịch Học LT
            // 8: Nhóm TH (Chứa link onclick)
            
            const subjID = cells[0].innerText.trim();
            const subjName = cells[1].innerText.trim();
            const ltClassID = cells[2].innerText.trim();
            const credits = parseInt(cells[3].innerText.trim()) || 0;
            const ltScheduleStr = cells[7] ? cells[7].innerText.trim() : "";
            const ltSchedule = parseScheduleString(ltScheduleStr);

            if (!subjID) continue;

            // Init subject if not exist
            if (!courseMap[subjID]) {
                courseMap[subjID] = {
                    id: subjID,
                    name: subjName,
                    credits: credits,
                    classes: []
                };
            }

            // Kiểm tra cột Thực hành (Cột 8)
            const thCell = cells[8];
            const thLink = thCell.querySelector('a');
            
            if (thLink) {
                // TRƯỜNG HỢP CÓ THỰC HÀNH -> Fetch dữ liệu
                const onclickText = thLink.getAttribute('onclick'); 
                const match = onclickText.match(/showFormDKThucHanh\("(\d+)"/);
                
                if (match && match[1]) {
                    const lmid = match[1];
                    const thClasses = await fetchPracticalClasses(lmid);

                    if (thClasses && thClasses.length > 0) {
                        thClasses.forEach(th => {
                            const thClassID = th.Nhom; // VD: 24CTT1.1
                            const thScheduleStr = th.LichHoc; 
                            const thSchedule = parseScheduleString(thScheduleStr);

                            courseMap[subjID].classes.push({
                                id: thClassID, 
                                schedule: [...ltSchedule, ...thSchedule] // Gộp lịch
                            });
                        });
                    } else {
                        // Có link nhưng fetch rỗng -> Lấy lớp LT gốc
                        courseMap[subjID].classes.push({ id: ltClassID, schedule: ltSchedule });
                    }
                } else {
                    courseMap[subjID].classes.push({ id: ltClassID, schedule: ltSchedule });
                }
            } else {
                // TRƯỜNG HỢP KHÔNG CÓ THỰC HÀNH -> Lấy lớp LT bình thường
                // Kiểm tra trùng lặp (vì bảng có thể bị split dòng)
                const exists = courseMap[subjID].classes.find(c => c.id === ltClassID);
                if (!exists) {
                    courseMap[subjID].classes.push({
                        id: ltClassID,
                        schedule: ltSchedule
                    });
                } else {
                    // Gộp thêm lịch nếu có dòng trùng
                    if (ltSchedule.length > 0) {
                        exists.schedule = [...new Set([...exists.schedule, ...ltSchedule])];
                    }
                }
            }
        } // End loop rows

        document.body.removeChild(noti);
        return Object.values(courseMap);
    }

    // === 4. LOGIC ĐIỀU KHIỂN CHÍNH (CONTROLLER) ===
    let savedData = {};
    try { savedData = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch (e) {}
    const currentUrl = window.location.href;

    // --- BƯỚC 1: TRANG ĐIỂM ---
    if (!savedData.hasStudentInfo) {
        if (currentUrl.indexOf("pid=211") === -1) {
            if(confirm("Bước 1: Cần lấy dữ liệu Điểm/Lịch thi trước.\nChuyển đến trang Xem Điểm (pid=211)?")) {
                window.location.href = CONFIG.URL_DIEM;
            }
            return;
        }
        const cb = document.getElementById("ctl00_ContentPlaceHolder1_ctl00_cboNamHoc_gvDKHPLichThi_ob_CbocboNamHoc_gvDKHPLichThiTB");
        const btn = document.getElementById("ctl00_ContentPlaceHolder1_ctl00_btnXemDiemThi");
        if (cb && btn && (cb.value.indexOf("Tất cả") === -1 && cb.value.indexOf("All") === -1)) {
            try { if (typeof cboNamHoc_gvDKHPLichThi !== 'undefined') cboNamHoc_gvDKHPLichThi.value('0'); } catch(e){}
            btn.click();
            alert("⏳ Đang chọn 'Tất cả'... Đợi trang load xong bấm lại Bookmarklet!");
            return;
        }
        const gData = scrapeGrades();
        if (!gData || gData.grades.length === 0) {
            alert("⚠️ Bảng điểm trống. Đợi load xong hãy bấm lại.");
            return;
        }
        const noti = document.createElement('div');
        noti.style.cssText = "position:fixed;bottom:20px;right:20px;background:#005a8d;color:white;padding:15px;z-index:9999;border-radius:5px";
        noti.innerHTML = "⏳ Đang lấy Lịch thi & Học phí...";
        document.body.appendChild(noti);
        try {
            const [exams, tuition] = await Promise.all([
                fetchBackgroundData(CONFIG.URL_LICHTHI, 'EXAM'),
                fetchBackgroundData(CONFIG.URL_HOCPHI, 'TUITION')
            ]);
            document.body.removeChild(noti);
            savedData.mssv = gData.mssv;
            savedData.grades = gData.grades;
            savedData.exams = exams;
            savedData.tuition = tuition;
            savedData.hasStudentInfo = true;
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
            if(confirm(`✅ Xong bước 1.\nChuyển sang trang Lớp mở (pid=327)?`)) {
                window.location.href = CONFIG.URL_LOPMO;
            }
        } catch(e) { alert("Lỗi: " + e.message); }
        return;
    }

    // --- BƯỚC 2: TRANG LỚP MỞ (ĐÃ UPDATE ASYNC & FIX INDEX CỘT) ---
    if (!savedData.hasCourseInfo) {
        if (currentUrl.indexOf("pid=327") === -1) {
             window.location.href = CONFIG.URL_LOPMO;
             return;
        }
        try {
            const cboNam = window.cboNamHoc;
            const cboHK = window.cboHocKy;
            const btnXem = document.getElementById("ctl00_ContentPlaceHolder1_ctl00_btnXem");
            if (cboNam && cboHK && btnXem) {
                if (cboNam.value() !== CONFIG.TARGET_YEAR || cboHK.value() !== CONFIG.TARGET_SEM) {
                    cboNam.value(CONFIG.TARGET_YEAR);
                    cboHK.value(CONFIG.TARGET_SEM);
                    btnXem.click();
                    alert(`🔄 Đang chuyển sang năm ${CONFIG.TARGET_YEAR}... Đợi load xong bấm lại lần cuối!`);
                    return;
                }
            }
        } catch (e) {}

        // GỌI HÀM CÀO DỮ LIỆU ASYNC MỚI
        scrapeOpenClassesAsync().then(courses => {
            if (!courses || courses.length === 0) {
                alert("⚠️ Chưa có dữ liệu lớp mở. Hãy bấm nút 'Xem' trên web trước.");
                return;
            }

            const finalPayload = {
                mssv: savedData.mssv,
                grades: savedData.grades,
                exams: savedData.exams,
                tuition: savedData.tuition,
                program: []
            };

            if (window.opener) {
                window.opener.postMessage({ type: 'PORTAL_DATA', payload: finalPayload }, '*');
                setTimeout(() => {
                    window.opener.postMessage({ type: 'OPEN_CLASS_DATA', payload: courses }, '*');
                    alert(`✅ HOÀN TẤT!\nĐã lấy ${courses.length} môn học (bao gồm cả lớp TH).`);
                    sessionStorage.removeItem(STORAGE_KEY);
                }, 500);
            } else {
                console.log("Courses Data:", JSON.stringify(courses));
                alert(`Đã lấy ${courses.length} môn (Kiểm tra console).`);
                sessionStorage.removeItem(STORAGE_KEY);
            }
        });
        return;
    }
})();