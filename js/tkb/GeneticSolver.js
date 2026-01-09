import { CONFIG } from './Constants.js';
import { Chromosome } from './Chromosome.js';
import { FitnessEvaluator } from './FitnesseValuator.js';

export default class GeneticSolver {
    constructor(subjects, fixedConstraints, sessionPref) {
        this.targetSubjects = subjects;
        this.sessionPref = sessionPref;
        
        // Map Constraints
        this.fixedConstraints = new Array(subjects.length).fill(-1);
        Object.keys(fixedConstraints).forEach(subjID => {
            const wantedClassID = fixedConstraints[subjID];
            const subjIndex = subjects.findIndex(s => s.id === subjID);
            
            if (subjIndex !== -1) {
                const classIndex = subjects[subjIndex].classes.findIndex(c => c.id === wantedClassID);
                if (classIndex !== -1) {
                    this.fixedConstraints[subjIndex] = classIndex;
                }
            }
        });
    }

    // --- GENETIC CORE ---
    
    solve(topK) {
        let population = [];

        // 1. Khởi tạo quần thể
        for (let i = 0; i < CONFIG.POPULATION_SIZE; i++) {
            const ind = this.createIndividual();
            FitnessEvaluator.evaluate(ind, this.targetSubjects, this.sessionPref);
            population.push(ind);
        }

        // 2. Vòng lặp tiến hóa
        for (let gen = 0; gen < CONFIG.GENERATIONS; gen++) {
            // Sort giảm dần theo fitness
            population.sort((a, b) => b.fitness - a.fitness);

            const newPop = [];
            
            // Elitism: Giữ lại top 10% ưu tú nhất không qua lai ghép
            const eliteCount = Math.floor(CONFIG.POPULATION_SIZE * 0.1) || 1;
            for(let i=0; i<eliteCount; i++) newPop.push(population[i]);

            // Lai ghép & Đột biến để tạo thế hệ mới
            while(newPop.length < CONFIG.POPULATION_SIZE) {
                const p1 = this.tournamentSelect(population);
                const p2 = this.tournamentSelect(population);
                
                let child = this.crossover(p1, p2);
                this.mutate(child);
                
                FitnessEvaluator.evaluate(child, this.targetSubjects, this.sessionPref);
                newPop.push(child);
            }
            population = newPop;
        }

        // 3. Lọc kết quả tốt nhất
        population.sort((a, b) => b.fitness - a.fitness);
        return this.filterUniqueResults(population, topK);
    }

    // --- HELPER FUNCTIONS ---

    createIndividual() {
        const ind = new Chromosome(this.targetSubjects.length);
        for (let i = 0; i < this.targetSubjects.length; i++) {
            ind.genes[i] = this.randomizeGene(i);
        }
        return ind;
    }

    randomizeGene(subjectIdx) {
        // Nếu bị khóa -> Buộc phải chọn lớp cố định
        if (this.fixedConstraints[subjectIdx] !== -1) {
            return this.fixedConstraints[subjectIdx];
        }
        const classes = this.targetSubjects[subjectIdx].classes;
        if (classes.length === 0) return -1;
        return Math.floor(Math.random() * classes.length);
    }

    crossover(p1, p2) {
        const child = new Chromosome(p1.genes.length);
        
        // Lai ghép 1 điểm cắt
        if (p1.genes.length > 1) {
            const split = Math.floor(Math.random() * (p1.genes.length - 1)) + 1;
            for(let i=0; i < p1.genes.length; i++) {
                child.genes[i] = (i < split) ? p1.genes[i] : p2.genes[i];
            }
        } else {
            child.genes = [...p1.genes];
        }

        // Đảm bảo ràng buộc cố định vẫn đúng sau khi lai ghép
        for(let i=0; i<this.fixedConstraints.length; i++) {
            if(this.fixedConstraints[i] !== -1) child.genes[i] = this.fixedConstraints[i];
        }
        return child;
    }

    mutate(chromo) {
        if (Math.random() < CONFIG.MUTATION_RATE) {
            const idx = Math.floor(Math.random() * chromo.genes.length);
            // Chỉ đột biến những gen không bị user khóa
            if (this.fixedConstraints[idx] === -1) {
                chromo.genes[idx] = this.randomizeGene(idx);
            }
        }
    }

    tournamentSelect(pop) {
        let best = pop[Math.floor(Math.random() * pop.length)];
        for(let i=0; i < CONFIG.TOURNAMENT_SIZE; i++) {
            const other = pop[Math.floor(Math.random() * pop.length)];
            if (other.fitness > best.fitness) best = other;
        }
        return best;
    }

    filterUniqueResults(population, topK) {
        const results = [];
        const seen = new Set();
        
        for(const ind of population) {
            if (results.length >= topK) break;
            const key = ind.genes.join(','); // Tạo Key duy nhất cho bộ gen
            if (!seen.has(key)) {
                seen.add(key);
                results.push(ind);
            }
        }
        return results;
    }
}