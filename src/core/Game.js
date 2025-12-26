import { Bodies, Body, Events, Composite, Vector } from 'matter-js';
import { PhysicsEngine } from './PhysicsEngine';
import { CONFIG } from './Constants';
import { CarromAI } from '../ai/CarromAI';
import { Renderer } from '../ui/Renderer';
import { Logger } from '../utils/Logger';

export class Game {
    constructor() {
        this.physics = new PhysicsEngine('game-container');
        this.renderer = new Renderer(this.physics);
        this.ai = new CarromAI(this);
        
        this.state = {
            scorePlayer: 0,
            scoreAI: 0,
            turn: 'PLAYER',
            phase: 'IDLE',
            aimStart: { x: 0, y: 0 },
            strikerPos: { x: 0, y: 0 }
        };

        this.mouse = { x: 0, y: 0, isDown: false };
        
        this.initEvents();
        this.reset();
        this.physics.start();
    }

    reset() {
        this.physics.clearBodies(b => b.label.startsWith('coin') || b.label === 'striker');
        this.state.scorePlayer = 0;
        this.state.scoreAI = 0;
        this.state.turn = 'PLAYER';
        this.state.phase = 'IDLE';
        
        this.spawnCoins();
        this.spawnStriker();
        this.updateUI();
        Logger.clear();
        Logger.log("游戏重置。玩家回合。", "info");
    }

    spawnCoins() {
        const cx = CONFIG.BOARD_SIZE / 2;
        const cy = CONFIG.BOARD_SIZE / 2;
        const r = CONFIG.COIN_RADIUS;

        this.addCoin(cx, cy, 'queen');
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * (Math.PI / 180);
            this.addCoin(cx + Math.cos(angle) * (r * 2.1), cy + Math.sin(angle) * (r * 2.1), i % 2 === 0 ? 'white' : 'black');
        }
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) * (Math.PI / 180);
            this.addCoin(cx + Math.cos(angle) * (r * 4.2), cy + Math.sin(angle) * (r * 4.2), (i + 1) % 2 === 0 ? 'white' : 'black');
        }
    }

    addCoin(x, y, type) {
        const coin = Bodies.circle(x, y, CONFIG.COIN_RADIUS, {
            restitution: 0.6,
            friction: 0.02,
            frictionAir: 0.02,
            label: 'coin-' + type,
            render: { fillStyle: CONFIG.COLORS[type.toUpperCase()], strokeStyle: '#000', lineWidth: 1 }
        });
        this.physics.addBody(coin);
    }

    spawnStriker() {
        const y = this.state.turn === 'PLAYER' ? CONFIG.BASELINE_Y : CONFIG.AI_BASELINE_Y;
        this.striker = Bodies.circle(CONFIG.BOARD_SIZE / 2, y, CONFIG.STRIKER_RADIUS, {
            restitution: 0.6,
            friction: 0.02,
            frictionAir: 0.02,
            mass: 4,
            label: 'striker',
            render: { fillStyle: CONFIG.COLORS.STRIKER, strokeStyle: '#d35400', lineWidth: 3 }
        });
        this.physics.addBody(this.striker);
    }

    initEvents() {
        const canvas = this.physics.render.canvas;

        const handleStart = (x, y) => {
            if (this.state.turn !== 'PLAYER' || this.state.phase === 'MOVING') return;
            const dist = Vector.magnitude(Vector.sub({ x, y }, this.striker.position));
            if (dist < CONFIG.STRIKER_RADIUS * 2) {
                this.state.phase = 'AIMING';
                this.state.aimStart = { x, y };
                this.state.strikerPos = { ...this.striker.position };
            } else if (Math.abs(y - CONFIG.BASELINE_Y) < 50) {
                this.state.phase = 'PLACING';
                this.moveStriker(x);
            }
        };

        const handleMove = (x, y) => {
            this.mouse.x = x;
            this.mouse.y = y;
            if (this.state.phase === 'PLACING') this.moveStriker(x);
        };

        const handleEnd = () => {
            if (this.state.phase === 'AIMING') this.shoot();
            if (this.state.phase === 'PLACING') this.state.phase = 'IDLE';
        };

        // Mouse Events
        canvas.addEventListener('mousedown', e => {
            const rect = canvas.getBoundingClientRect();
            handleStart(e.clientX - rect.left, e.clientY - rect.top);
        });
        window.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            handleMove(e.clientX - rect.left, e.clientY - rect.top);
        });
        window.addEventListener('mouseup', handleEnd);

        // Touch Events (Mobile Support)
        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            handleStart(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });
        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];
            handleMove(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });
        canvas.addEventListener('touchend', handleEnd);

        Events.on(this.physics.engine, 'afterUpdate', () => {
            this.checkPockets();
            this.checkStopped();
        });

        Events.on(this.physics.render, 'afterRender', () => {
            this.renderer.draw(this.state, this.mouse);
        });
    }

    moveStriker(x) {
        const limit = 120;
        const clampedX = Math.max(limit, Math.min(CONFIG.BOARD_SIZE - limit, x));
        Body.setPosition(this.striker, { x: clampedX, y: CONFIG.BASELINE_Y });
        Body.setVelocity(this.striker, { x: 0, y: 0 });
    }

    shoot() {
        const diff = Vector.sub(this.state.aimStart, this.mouse);
        const strength = Math.min(Vector.magnitude(diff) * 0.005, 0.15);
        if (strength < 0.01) {
            this.state.phase = 'IDLE';
            return;
        }
        const dir = Vector.normalise(diff);
        Body.applyForce(this.striker, this.striker.position, Vector.mult(dir, strength));
        this.state.phase = 'MOVING';
    }

    checkPockets() {
        const bodies = Composite.allBodies(this.physics.engine.world);
        const coins = bodies.filter(b => b.label.startsWith('coin'));
        
        coins.forEach(coin => {
            this.physics.pockets.forEach(pocket => {
                if (Vector.magnitude(Vector.sub(coin.position, pocket.position)) < CONFIG.POCKET_RADIUS) {
                    this.handleScore(coin);
                    this.physics.removeBody(coin);
                }
            });
        });

        this.physics.pockets.forEach(pocket => {
            if (Vector.magnitude(Vector.sub(this.striker.position, pocket.position)) < CONFIG.POCKET_RADIUS) {
                this.handleFoul();
            }
        });
    }

    handleScore(coin) {
        const type = coin.label.split('-')[1].toUpperCase();
        const pts = CONFIG.POINTS[type];
        if (this.state.turn === 'PLAYER') this.state.scorePlayer += pts;
        else this.state.scoreAI += pts;
        Logger.log(`${this.state.turn} 进球: ${type} (+${pts})`, "success");
        this.updateUI();
    }

    handleFoul() {
        const pts = CONFIG.POINTS.FOUL;
        if (this.state.turn === 'PLAYER') this.state.scorePlayer = Math.max(0, this.state.scorePlayer + pts);
        else this.state.scoreAI = Math.max(0, this.state.scoreAI + pts);
        Logger.log(`${this.state.turn} 犯规: Striker 落袋 (${pts})`, "error");
        Body.setPosition(this.striker, { x: CONFIG.BOARD_SIZE/2, y: this.state.turn === 'PLAYER' ? CONFIG.BASELINE_Y : CONFIG.AI_BASELINE_Y });
        Body.setVelocity(this.striker, { x: 0, y: 0 });
        this.updateUI();
    }

    checkStopped() {
        if (this.state.phase !== 'MOVING') return;
        const bodies = Composite.allBodies(this.physics.engine.world);
        const moving = bodies.some(b => !b.isStatic && (Vector.magnitude(b.velocity) > 0.15));
        
        if (!moving) {
            this.state.phase = 'IDLE';
            const remaining = bodies.filter(b => b.label.startsWith('coin'));
            if (remaining.length === 0) {
                this.ai.recordGameResult(this.state.scorePlayer > this.state.scoreAI);
                alert("游戏结束！");
                this.reset();
            } else {
                this.switchTurn();
            }
        }
    }

    switchTurn() {
        this.state.turn = this.state.turn === 'PLAYER' ? 'AI' : 'PLAYER';
        this.physics.removeBody(this.striker);
        this.spawnStriker();
        this.updateUI();
        if (this.state.turn === 'AI') this.ai.play();
    }

    updateUI() {
        document.getElementById('player-score').innerText = this.state.scorePlayer;
        document.getElementById('ai-score').innerText = this.state.scoreAI;
        const turnDisp = document.getElementById('turn-display');
        turnDisp.innerText = this.state.turn === 'PLAYER' ? '玩家' : 'AI';
        turnDisp.className = this.state.turn === 'PLAYER' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold';
    }
}
