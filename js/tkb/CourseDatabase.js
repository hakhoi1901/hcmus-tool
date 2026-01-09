
import { encodeScheduleToMask } from '../Utils.js';
import { Bitset } from './Bitset.js'; // 1. Import class Bitset

export default class CourseDatabase {
    constructor() {
        this.courses = []; 
        this.mapIdToIndex = {};
    }

    loadData(rawData) {
        this.courses = [];
        this.mapIdToIndex = {};

        if (!Array.isArray(rawData)) {
            console.error("Dữ liệu nạp vào CourseDatabase không phải là mảng:", rawData);
            return;
        }

        rawData.forEach((subj, index) => {
            // Chuẩn hóa danh sách lớp
            const processedClasses = subj.classes.map(cls => {
                // Nếu chưa có mask (data từ Portal), tính toán từ schedule string
                let maskData = cls.mask;
                if (!maskData && cls.schedule) {
                    maskData = encodeScheduleToMask(cls.schedule);
                }
                
                // Fallback nếu không có gì cả
                if (!maskData) maskData = [0, 0, 0, 0];

                // 2. Chuyển đổi Array [int] -> Đối tượng Bitset
                const bitsetMask = new Bitset();
                bitsetMask.loadFromData(maskData);

                return {
                    id: cls.id,
                    schedule: cls.schedule, // Giữ lại để hiển thị
                    scheduleMask: bitsetMask // 3. Đổi tên thành scheduleMask và lưu Object Bitset
                };
            });

            this.courses.push({
                id: subj.id,
                name: subj.name,
                credits: subj.credits,
                classes: processedClasses
            });

            // Tạo map để tra cứu nhanh theo ID môn học
            this.mapIdToIndex[subj.id] = index;
        });
    }

    getCourse(id) {
        const idx = this.mapIdToIndex[id];
        return (idx !== undefined) ? this.courses[idx] : null;
    }
}
