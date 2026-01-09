export const CONFIG = {
    POPULATION_SIZE: 1000,
    GENERATIONS: 500,
    MUTATION_RATE: 0.1,
    TOURNAMENT_SIZE: 5,
};

export const WEIGHTS = {
    BASE: 1000.0,
    PENALTY_HARD: 10000.0,      // Trùng lịch
    PENALTY_GAP: 15.0,          // Trống tiết
    PENALTY_WRONG_SESSION: 10.0,// Trái buổi
    BONUS_STREAK_2: 60.0,       // Học 2 ngày liền
    PENALTY_BURNOUT: 50.0,      // Học >3 ngày liền
    BONUS_DAY_OFF: 80.0,        // Ngày nghỉ
};