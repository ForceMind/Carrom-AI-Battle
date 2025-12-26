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
            targetPos: null,
            strikerTargetX: null,
            power: 0,
            isThinking: true
        };
        
        // 动态难度调整 (DDA)
        const winRate = this.calculatePlayerWinRate();
        const difficultyAdjustment = this.getDifficultyAdjustment(winRate);
        
        Logger.log(`当前玩家胜率: ${(winRate * 100).toFixed(1)}% | 难度调整: ${difficultyAdjustment.label}`, "info");

        await new Promise(r => setTimeout(r, 800));

        const targets = Composite.allBodies(this.game.physics.engine.world).filter(b => b.label.startsWith('coin'));
        if (targets.length === 0) return;

        const bestShot = this.findBestShot(targets, difficultyAdjustment);
        
        if (!bestShot) {
            Logger.log("AI 未能找到理想路径，尝试随机击打", "warning");
            this.randomShot(targets);
            return;
        }

        // 展示思考过程：锁定目标
        this.game.state.aiThinking.targetPos = bestShot.targetPos;
        this.game.state.aiThinking.strikerTargetX = bestShot.strikerX;
        Logger.log(`AI 锁定目标: ${bestShot.targetLabel} | 预计成功率: ${(bestShot.confidence * 100).toFixed(1)}%`, "ai");

        // 1. 移动 Striker
        await this.smoothMove(bestShot.strikerX);

        // 2. 瞄准停顿并展示力度
        this.game.state.aiThinking.power = bestShot.strength * 20; // 缩放用于显示
        await new Promise(r => setTimeout(r, 1000));

        // 3. 击球
        const force = Vector.mult(bestShot.direction, bestShot.strength);
        Body.applyForce(this.game.striker, this.game.striker.position, force);
        
        this.game.state.phase = 'MOVING';
        this.game.state.aiThinking.isThinking = false;
        Logger.log("AI 击球！", "success");
    }

    calculatePlayerWinRate() {
        if (this.stats.totalGames === 0) return 0.5;
        return this.stats.playerWins / this.stats.totalGames;
    }

    getDifficultyAdjustment(winRate) {
        // 目标胜率 50%
        if (winRate > 0.55) {
            return { label: "增强 (大师模式)", deviation: 0.01, strengthVar: 0.05, confidence: 0.9 };
        } else if (winRate < 0.45) {
            return { label: "削弱 (新手模式)", deviation: 0.15, strengthVar: 0.2, confidence: 0.4 };
        } else {
            return { label: "标准 (中等模式)", deviation: 0.05, strengthVar: 0.1, confidence: 0.7 };
        }
    }

    findBestShot(targets, adj) {
        let bestShot = null;
        let maxScore = -Infinity;

        for (const target of targets) {
            for (const pocket of this.game.physics.pockets) {
                const coinToPocket = Vector.sub(pocket.position, target.position);
                const distCoinPocket = Vector.magnitude(coinToPocket);
                const dir = Vector.normalise(coinToPocket);
                
                // 击打点
                const hitPoint = Vector.sub(target.position, Vector.mult(dir, CONFIG.COIN_RADIUS + CONFIG.STRIKER_RADIUS - 2));

                if (hitPoint.y > target.position.y) continue; 

                const strikerX = hitPoint.x;
                const limit = 120;
                const clampedX = Math.max(limit, Math.min(CONFIG.BOARD_SIZE - limit, strikerX));
                
                const strikerPos = { x: clampedX, y: CONFIG.AI_BASELINE_Y };
                const strikerToHitPoint = Vector.sub(hitPoint, strikerPos);
                const distStrikerHit = Vector.magnitude(strikerToHitPoint);

                let score = 1000 - distCoinPocket - distStrikerHit;
                if (target.label.includes('queen')) score += 200;
                if (target.label.includes('white')) score += 50;

                if (score > maxScore) {
                    maxScore = score;
                    const angle = Math.atan2(strikerToHitPoint.y, strikerToHitPoint.x);
                    // 加入难度偏差
                    const finalAngle = angle + (Math.random() - 0.5) * adj.deviation;
                    
                    bestShot = {
                        strikerX: clampedX,
                        direction: { x: Math.cos(finalAngle), y: Math.sin(finalAngle) },
                        strength: (0.08 + (distStrikerHit * 0.0001)) * (1 + (Math.random() - 0.5) * adj.strengthVar),
                        targetLabel: target.label,
                        targetPos: { ...target.position },
                        confidence: adj.confidence
                    };
                }
            }
        }
        return bestShot;
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
