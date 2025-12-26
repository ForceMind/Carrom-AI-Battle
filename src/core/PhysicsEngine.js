import { Engine, Render, Runner, World, Bodies, Events, Composite, Vector } from 'matter-js';
import { CONFIG } from './Constants';

export class PhysicsEngine {
    constructor(containerId) {
        this.engine = Engine.create();
        this.engine.gravity.y = 0;

        const container = document.getElementById(containerId);
        this.render = Render.create({
            element: container,
            engine: this.engine,
            options: {
                width: CONFIG.BOARD_SIZE,
                height: CONFIG.BOARD_SIZE,
                wireframes: false,
                background: 'transparent'
            }
        });

        this.runner = Runner.create();
        this.initWalls();
        this.initPockets();
    }

    initWalls() {
        const t = 60;
        const sz = CONFIG.BOARD_SIZE;
        const wallOptions = { 
            isStatic: true, 
            render: { fillStyle: '#3d1f05' },
            restitution: 0.6,
            friction: 0.05
        };

        const walls = [
            Bodies.rectangle(sz/2, -t/2 + 10, sz + t*2, t, wallOptions),
            Bodies.rectangle(sz/2, sz + t/2 - 10, sz + t*2, t, wallOptions),
            Bodies.rectangle(-t/2 + 10, sz/2, t, sz + t*2, wallOptions),
            Bodies.rectangle(sz + t/2 - 10, sz/2, t, sz + t*2, wallOptions)
        ];
        World.add(this.engine.world, walls);
    }

    initPockets() {
        const sz = CONFIG.BOARD_SIZE;
        this.pockets = [
            { x: 40, y: 40 }, { x: sz - 40, y: 40 },
            { x: 40, y: sz - 40 }, { x: sz - 40, y: sz - 40 }
        ].map(pos => Bodies.circle(pos.x, pos.y, CONFIG.POCKET_RADIUS, {
            isStatic: true,
            isSensor: true,
            label: 'pocket',
            render: { fillStyle: CONFIG.COLORS.POCKET }
        }));
        World.add(this.engine.world, this.pockets);
    }

    start() {
        Render.run(this.render);
        Runner.run(this.runner, this.engine);
    }

    addBody(body) {
        World.add(this.engine.world, body);
    }

    removeBody(body) {
        World.remove(this.engine.world, body);
    }

    clearBodies(filter) {
        const allBodies = Composite.allBodies(this.engine.world);
        const toRemove = allBodies.filter(filter);
        World.remove(this.engine.world, toRemove);
    }
}
