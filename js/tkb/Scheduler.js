import CourseDatabase from './CourseDatabase.js';
import GeneticSolver from './GeneticSolver.js';

export function runScheduleSolver(rawData, userWants, fixedClasses, sessionPref) {
    const db = new CourseDatabase();
    
    // 1. Nạp dữ liệu
    const data = (typeof rawData === 'string') ? JSON.parse(rawData) : rawData;
    db.loadData(data); 

    // 2. Lọc môn học theo yêu cầu
    const selectedCourses = [];
    userWants.forEach(subjID => {
        const cleanID = String(subjID).trim(); 
        const course = db.getCourse(cleanID);
        
        if (course) {
            // Xử lý môn học bị người dùng "Ghim" (Fixed)
            if (fixedClasses[cleanID]) {
                const fixedClass = course.classes.find(c => c.id === fixedClasses[cleanID]);
                if (fixedClass) {
                    // Tạo bản sao môn học chỉ chứa đúng 1 lớp đã chọn -> Solver buộc phải lấy lớp này
                    selectedCourses.push({ ...course, classes: [fixedClass] });
                } else {
                    selectedCourses.push(course);
                }
            } else {
                selectedCourses.push(course);
            }
        } else {
            console.warn(`⚠️ Scheduler: Không tìm thấy môn [${cleanID}] trong DB.`);
        }
    });

    if (selectedCourses.length === 0) {
        return { error: 'Không tìm thấy môn nào hợp lệ. Hãy thử tải lại dữ liệu (Mở Portal).' };
    }

    // 3. Khởi tạo Engine (SỬA LỖI: Truyền đủ 3 tham số)
    // GeneticSolver(subjects, fixedConstraints, sessionPref)
    const solver = new GeneticSolver(selectedCourses, fixedClasses, sessionPref);
    
    // 4. Chạy thuật toán (SỬA LỖI: Truyền số lượng kết quả muốn lấy)
    const rawResults = solver.solve(5); // Lấy top 5 kết quả tốt nhất

    // 5. [QUAN TRỌNG] CHUYỂN ĐỔI DỮ LIỆU (Mapping)
    // Chuyển từ Chromosome (Gen) -> UI Model (để Utils.js hiển thị được)
    
    const mappedResults = rawResults.map((ind, index) => {
        const scheduleList = [];
        
        // Duyệt qua từng gen để lấy thông tin lớp học cụ thể
        ind.genes.forEach((classIdx, courseIdx) => {
            if (classIdx !== -1) {
                const course = selectedCourses[courseIdx];
                const classObj = course.classes[classIdx];
                
                // Lấy mask để vẽ màu: 
                // Do CourseDatabase đã chuyển mask thành Bitset, ta cần lấy mảng 'parts' ra
                let visualMask = classObj.mask;
                if (!visualMask && classObj.scheduleMask) {
                    visualMask = classObj.scheduleMask.parts;
                }

                scheduleList.push({
                    subjectID: course.id,
                    classID: classObj.id,
                    mask: visualMask || [0,0,0,0], // Mảng số nguyên dùng để render màu
                    schedule: classObj.schedule
                });
            }
        });

        return {
            option: index + 1,
            fitness: ind.fitness,
            schedule: scheduleList // <-- Đây là cái Utils.js đang tìm (.forEach)
        };
    });

    return mappedResults;
}