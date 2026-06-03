import type { FlaskSpillParticle } from '../runtime/game-main-effect-types.js';

type FlaskSpillParticlesOptions = {
    particles: FlaskSpillParticle[];
    getRandom: () => number;
};

export function createFlaskSpillParticlesRuntime(options: FlaskSpillParticlesOptions) {
    function emitFlaskSpillParticles(x: number, y: number, count: number = 12) {
        const particleCount = Math.max(12, Math.min(72, Math.floor(count * 2.5)));
        for (let i = 0; i < particleCount; i++) {
            const angle = (-Math.PI / 2) + (options.getRandom() - 0.5) * 2.2;
            const speed = 2.2 + options.getRandom() * 3.6;
            options.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 18 + Math.floor(options.getRandom() * 16),
                maxLife: 34,
                size: 3.2 + options.getRandom() * 3.1
            });
        }
    }

    function updateAndDrawFlaskSpillParticles(ctx: CanvasRenderingContext2D | null, camera: { x: number; y: number }) {
        for (let i = options.particles.length - 1; i >= 0; i--) {
            const particle = options.particles[i];
            particle.life -= 1;
            if (particle.life <= 0) {
                options.particles.splice(i, 1);
                continue;
            }
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.14;
            particle.vx *= 0.95;
            if (!ctx) {
                continue;
            }
            const alpha = Math.max(0, particle.life / particle.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.life % 2 === 0 ? '#67e8f9' : '#ffffff';
            ctx.fillRect(
                Math.round(particle.x - camera.x),
                Math.round(particle.y - camera.y),
                particle.size,
                particle.size
            );
            ctx.globalAlpha = alpha * 0.65;
            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(
                Math.round(particle.x - camera.x - particle.vx * 0.8),
                Math.round(particle.y - camera.y - particle.vy * 0.8),
                Math.max(1, particle.size * 0.7),
                Math.max(1, particle.size * 0.7)
            );
            ctx.restore();
        }
    }

    return {
        emitFlaskSpillParticles,
        updateAndDrawFlaskSpillParticles
    };
}
