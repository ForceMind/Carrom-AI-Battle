import { CONFIG } from '../core/Constants.js';

export class Renderer {
    constructor(physics, game) {
        this.physics = physics;
        this.game = game;
        this.ctx = physics.render.context;
    }

    draw(gameState, mouse) {
        this.drawBoardDecorations();
        this.drawUIOverlay(gameState, mouse);
    }

    drawBoardDecorations() {
        const ctx = this.ctx;
        const sz = CONFIG.BOARD_SIZE;
        const cp = sz / 2;

        // 背景
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = CONFIG.COLORS.BOARD;
        ctx.fillRect(0, 0, sz, sz);
        ctx.restore();

        // 装饰线
        ctx.strokeStyle = 'rgba(61, 31, 5, 0.3)';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(cp, cp, CONFIG.COIN_RADIUS * 4.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(cp, cp, CONFIG.COIN_RADIUS * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        ctx.fill();
        ctx.stroke();

        // 底线
        ctx.strokeStyle = '#3d1f05';
        ctx.lineWidth = 3;
        const blWidth = sz - 240;
        const blX = 120;

        this.drawBaseline(ctx, blX, CONFIG.BASELINE_Y, blWidth);
        this.drawBaseline(ctx, blX, CONFIG.AI_BASELINE_Y, blWidth);
    }

    drawBaseline(ctx, x, y, w) {
        const h = 40;
        ctx.strokeRect(x, y - h/2, w, h);
        ctx.beginPath();
        ctx.arc(x, y, h/2, 0, Math.PI * 2);
        ctx.arc(x + w, y, h/2, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.stroke();
    }

    drawUIOverlay(state, mouse) {
        // AI 思考过程展示
        if (state.phase === 'AI_THINKING' && state.aiThinking && state.aiThinking.isThinking) {
            this.drawAIThinking(state.aiThinking);
        }

        if (state.phase === 'AIMING' && state.turn === 'PLAYER') {
            const start = state.strikerPos;
            const diff = { x: state.aimStart.x - mouse.x, y: state.aimStart.y - mouse.y };
            const dist = Math.sqrt(diff.x*diff.x + diff.y*diff.y);
            const maxPull = 200; // 最大拉伸距离
            const strength = Math.min(dist / maxPull * 0.15, 0.15);
            
            // 1. 绘制拉伸范围圆圈
            this.ctx.beginPath();
            this.ctx.arc(state.aimStart.x, state.aimStart.y, maxPull, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.setLineDash([10, 10]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            if (dist < 5) return;

            const dir = { x: diff.x / dist, y: diff.y / dist };

            // 2. 绘制力度条 (弧形或渐变条)
            const barWidth = 120;
            const barHeight = 15;
            const barX = start.x - barWidth / 2;
            const barY = start.y + 50;

            // 背景
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // 填充 (根据力度变色)
            const fillWidth = (strength / 0.15) * barWidth;
            const hue = 120 - (strength / 0.15) * 120; // 从绿到红
            this.ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
            this.ctx.fillRect(barX, barY, fillWidth, barHeight);
            
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);

            // 3. 绘制预测线
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(start.x + dir.x * 600, start.y + dir.y * 600);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 4. 绘制击打方向箭头
            this.drawArrow(start, { x: start.x + dir.x * 40, y: start.y + dir.y * 40 });
        }
    }

    drawAIThinking(ai) {
        const striker = this.game.striker;
        
        // 1. 绘制目标锁定线
        if (ai.targetPos) {
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(striker.position.x, striker.position.y);
            this.ctx.lineTo(ai.targetPos.x, ai.targetPos.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // 目标点光圈
            this.ctx.beginPath();
            this.ctx.arc(ai.targetPos.x, ai.targetPos.y, 25, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
            this.ctx.stroke();
        }

        // 2. 绘制 AI 力度条
        if (ai.power > 0) {
            const barWidth = 100;
            const barHeight = 10;
            const barX = striker.position.x - barWidth / 2;
            const barY = striker.position.y - 50;

            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            const fillWidth = Math.min(ai.power, 100);
            this.ctx.fillStyle = '#ff3232';
            this.ctx.fillRect(barX, barY, fillWidth, barHeight);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.fillText("AI 蓄力中...", barX, barY - 5);
        }
    }

    drawArrow(from, to) {
        const headlen = 10;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.lineTo(to.x - headlen * Math.cos(angle - Math.PI / 6), to.y - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(to.x, to.y);
        this.ctx.lineTo(to.x - headlen * Math.cos(angle + Math.PI / 6), to.y - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.strokeStyle = CONFIG.COLORS.STRIKER;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }
}
