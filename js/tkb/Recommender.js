class PrerequisiteGraph {
    constructor(prereqData) {
        this.hardConstraints = {}; 
        this.buildGraph(prereqData);
    }

    buildGraph(data) {
        if (!data || !Array.isArray(data)) return;
        
        data.forEach(item => {
            // Mapping đúng tên trường trong file prerequisites.json
            const cId = String(item.course_id).trim();
            const pIdRaw = String(item.prereq_id).trim();
            const type = item.type || 'PREREQUISITE';

            if (type === 'PREREQUISITE') {
                // Xử lý trường hợp nhiều môn tiên quyết ngăn cách bằng dấu phẩy
                const pIds = pIdRaw.replace(/,/g, ' ').split(/\s+/).filter(x => x.length > 0);
                
                if (!this.hardConstraints[cId]) this.hardConstraints[cId] = [];
                pIds.forEach(pid => this.hardConstraints[cId].push(pid));
            }
        });
    }

    findBlockingPrereq(courseId, passedCourses) {
        if (passedCourses.has(courseId)) return null; // Đã học rồi

        const reqs = this.hardConstraints[courseId] || [];
        for (const req of reqs) {
            if (!passedCourses.has(req)) {
                // Đệ quy tìm ông tổ chưa học
                const deeperBlocker = this.findBlockingPrereq(req, passedCourses);
                return deeperBlocker ? deeperBlocker : req;
            }
        }
        return courseId; // Không bị chặn -> Học môn này
    }
}

// --- CORE RECOMMENDER ---
export class CourseRecommender {
    constructor(studentData, openCourses, prereqs, allCoursesMeta) {
        this.studentData = studentData;
        this.openCourses = openCourses; // Dữ liệu lớp mở (có trường 'id')
        this.prereqs = prereqs;         // Dữ liệu tiên quyết (có trường 'course_id')
        this.allCoursesMeta = allCoursesMeta; // Dữ liệu danh sách môn (có trường 'course_id')
    }

    getStudentStatus() {
        const passed = new Set();
        const failed = new Set();
        const studying = new Set();

        const grades = this.studentData?.grades || [];

        grades.forEach(g => {
            const cid = String(g.id).trim();
            let scoreRaw = g.score;

            if (scoreRaw === "" || scoreRaw === "(*)" || scoreRaw === null || scoreRaw === undefined) {
                studying.add(cid);
                return;
            }

            const score = parseFloat(scoreRaw);
            if (!isNaN(score)) {
                if (score >= 5.0) passed.add(cid);
                else failed.add(cid);
            } else {
                studying.add(cid); // Điểm chữ hoặc chưa có điểm
            }
        });

        return { passed, failed, studying };
    }

    recommend() {
        console.log("🔍 Đang chạy gợi ý môn học...");

        // 1. Tạo Map cho danh sách lớp mở để tra cứu nhanh
        const openClassesMap = new Map();
        if (this.openCourses) {
            this.openCourses.forEach(c => {
                if(c.id) openClassesMap.set(String(c.id).trim(), c);
            });
        }

        const { passed, failed, studying } = this.getStudentStatus();
        const graph = new PrerequisiteGraph(this.prereqs);
        const rawRecommendations = new Set();

        // --- ƯU TIÊN 1: TRẢ NỢ MÔN RỚT ---
        failed.forEach(cid => {
            const target = graph.findBlockingPrereq(cid, passed);
            // Chỉ gợi ý nếu chưa học và không đang học
            if (target && !passed.has(target) && !studying.has(target)) {
                rawRecommendations.add(target);
            }
        });

        // --- ƯU TIÊN 2: MÔN BẮT BUỘC TRONG CTĐT ---
        if (this.allCoursesMeta && Array.isArray(this.allCoursesMeta)) {
            this.allCoursesMeta.forEach(c => {
                const cid = String(c.course_id).trim();
                // Chỉ xét môn Bắt buộc (BB)
                if (c.course_type === 'BB' && !passed.has(cid) && !studying.has(cid)) {
                    const target = graph.findBlockingPrereq(cid, passed);
                    if (target && !passed.has(target) && !studying.has(target)) {
                        rawRecommendations.add(target);
                    }
                }
            });
        }

        // --- BƯỚC CUỐI: LỌC QUA DANH SÁCH LỚP MỞ ---
        const finalOutput = [];
        rawRecommendations.forEach(cid => {
            // Kiểm tra xem môn gợi ý có mở lớp kỳ này không
            if (openClassesMap.has(cid)) {
                const courseData = openClassesMap.get(cid);
                // Gắn cờ để UI biết (nếu cần tô màu)
                courseData.isRecommended = true; 
                finalOutput.push(courseData);
            }
        });

        console.log(`✅ Kết quả gợi ý: ${finalOutput.length} môn.`);
        return finalOutput;
    }
}