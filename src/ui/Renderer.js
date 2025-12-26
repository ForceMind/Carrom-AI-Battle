import { CONFIG } from '../core/Constants';

export class Renderer {
    constructor(physics) {
        this.physics = physics;
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
        if (state.phase === 'AIMING' && state.turn === 'PLAYER') {
            const start = state.strikerPos;
            const diff = { x: state.aimStart.x - mouse.x, y: state.aimStart.y - mouse.y };
            const strength = Math.min(Math.sqrt(diff.x*diff.x + diff.y*diff.y) * 0.005, 0.15);
            
            if (strength < 0.01) return;

            const mag = Math.sqrt(diff.x*diff.x + diff.y*diff.y);
            const dir = { x: diff.x / mag, y: diff.y / mag };

            // 力度条
            this.ctx.beginPath();
            this.ctx.strokeStyle = CONFIG.COLORS.STRIKER;
            this.ctx.lineWidth = 4;
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(start.x - dir.x * strength * 1000, start.y - dir.y * strength * 1000);
            this.ctx.stroke();

            // 预测线
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(start.x + dir.x * 800, start.y + dir.y * 800);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
}
