const { Body, Vector, Composite } = Matter;
import { CONFIG } from '../core/Constants.js';
import { Logger } from '../utils/Logger.js';

export class CarromAI {
    constructor(game) {
        this.game = game;
        this.stats = {
            playerWins: 0,
            aiWins: 0,
            totalGames: 0
        };
    }

    async play() {
        Logger.log("AI 正在观察棋盘...", "ai");
        this.game.state.phase = 'AI_THINKING';
        this.game.state.aiThinking = {
            displayTargetPos: { x: CONFIG.BOARD_SIZE / 2, y: CONFIG.BOARD_SIZE / 2 },
            power: 0,
            isThinking: true
        };
        
        const winRate = this.calculatePlayerWinRate();
        const difficultyAdjustment = this.getDifficultyAdjustment(winRate);
        
        const targets = Composite.allBodies(this.game.physics.engine.world).filter(b => b.label.startsWith('coin'));
        if (targets.length === 0) return;

        // 1. 模拟“观察”过程：平滑地在几个目标之间扫视
        const scanCount = 2 + Math.floor(Math.random() * 2);
        let currentPos = { ...this.game.state.aiThinking.displayTargetPos };
        
        for (let i = 0; i < scanCount; i++) {
            const nextTarget = targets[Math.floor(Math.random() * targets.length)].position;
            await this.smoothAim(currentPos, nextTarget, 25);
            currentPos = { ...nextTarget };
            await new Promise(r => setTimeout(r, 400));
        }

        const bestShot = this.findBestShot(targets, difficultyAdjustment);
        if (!bestShot) {
            this.randomShot(targets);
            return;
        }

        // 2. 锁定最终目标并平滑移动 Striker
        await this.smoothAim(currentPos, bestShot.targetPos, 30);
        await this.smoothMove(bestShot.strikerX);

        // 3. 模拟“瞄准”微调 (线性对准)
        await new Promise(r => setTimeout(r, 300));

        // 4. 线性“蓄力”过程
        const targetPower = bestShot.strength * 666; 
        const powerSteps = 40;
        for (let i = 0; i <= powerSteps; i++) {
            this.game.state.aiThinking.power = (targetPower * i) / powerSteps;
            await new Promise(r => setTimeout(r, 25));
        }

        await new Promise(r => setTimeout(r, 200));

        // 5. 击球
        const force = Vector.mult(bestShot.direction, bestShot.strength);
        Body.applyForce(this.game.striker, this.game.striker.position, force);
        
        this.game.state.phase = 'MOVING';
        this.game.state.aiThinking.isThinking = false;
        Logger.log("AI 击球！", "success");
    }

    async smoothAim(from, to, steps) {
        for (let i = 0; i <= steps; i++) {
            this.game.state.aiThinking.displayTargetPos = {
                x: from.x + (to.x - from.x) * (i / steps),
                y: from.y + (to.y - from.y) * (i / steps)
            };
            await new Promise(r => setTimeout(r, 15));
        }
    }

    calculatePlayerWinRate() {
        if (this.stats.totalGames === 0) return 0.5;
        return this.stats.playerWins / this.stats.totalGames;
    }

    getDifficultyAdjustment(winRate) {
        if (winRate > 0.55) {
            return { label: "增强 (大师模式)", deviation: 0.01, strengthVar: 0.05, confidence: 0.9, queenWeight: 100 };
        } else if (winRate < 0.45) {
            return { label: "削弱 (新手模式)", deviation: 0.15, strengthVar: 0.2, confidence: 0.4, queenWeight: 20 };
        } else {
            return { label: "标准 (中等模式)", deviation: 0.05, strengthVar: 0.1, confidence: 0.7, queenWeight: 50 };
        }
    }

    findBestShot(targets, adj) {
        let shots = [];

        for (const target of targets) {
            for (const pocket of this.game.physics.pockets) {
                const coinToPocket = Vector.sub(pocket.position, target.position);
                const distCoinPocket = Vector.magnitude(coinToPocket);
                const dir = Vector.normalise(coinToPocket);
                
                const hitPoint = Vector.sub(target.position, Vector.mult(dir, CONFIG.COIN_RADIUS + CONFIG.STRIKER_RADIUS - 2));
                if (hitPoint.y > target.position.y) continue; 

                const strikerX = hitPoint.x;
                const limit = 120;
                const clampedX = Math.max(limit, Math.min(CONFIG.BOARD_SIZE - limit, strikerX));
                
                const strikerPos = { x: clampedX, y: CONFIG.AI_BASELINE_Y };
                const strikerToHitPoint = Vector.sub(hitPoint, strikerPos);
                const distStrikerHit = Vector.magnitude(strikerToHitPoint);

                let score = 1000 - distCoinPocket - distStrikerHit;
                if (target.label.includes('queen')) score += adj.queenWeight;
                if (target.label.includes('white')) score += 30;

                const angle = Math.atan2(strikerToHitPoint.y, strikerToHitPoint.x);
                const finalAngle = angle + (Math.random() - 0.5) * adj.deviation;
                
                shots.push({
                    score: score + (Math.random() * 50), // 加入随机扰动，避免总是选同一个
                    strikerX: clampedX,
                    direction: { x: Math.cos(finalAngle), y: Math.sin(finalAngle) },
                    strength: (0.08 + (distStrikerHit * 0.0001)) * (1 + (Math.random() - 0.5) * adj.strengthVar),
                    targetPos: { ...target.position }
                });
            }
        }

        if (shots.length === 0) return null;
        shots.sort((a, b) => b.score - a.score);
        
        // 根据难度决定从前几个候选方案中选一个
        const poolSize = adj.label.includes("大师") ? 1 : 3;
        return shots[Math.floor(Math.random() * Math.min(poolSize, shots.length))];
    }

    async smoothMove(targetX) {
        const startX = this.game.striker.position.x;
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const x = startX + (targetX - startX) * (i / steps);
            Body.setPosition(this.game.striker, { x, y: CONFIG.AI_BASELINE_Y });
            await new Promise(r => setTimeout(r, 15));
        }
    }

    randomShot(targets) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        const vec = Vector.sub(target.position, this.game.striker.position);
        const dir = Vector.normalise(vec);
        Body.applyForce(this.game.striker, this.game.striker.position, Vector.mult(dir, 0.1));
        this.game.state.phase = 'MOVING';
    }

    recordGameResult(playerWon) {
        this.stats.totalGames++;
        if (playerWon) this.stats.playerWins++;
        else this.stats.aiWins++;
        Logger.log(`游戏结束。记录胜率: ${(this.calculatePlayerWinRate() * 100).toFixed(1)}%`, "info");
    }
}
