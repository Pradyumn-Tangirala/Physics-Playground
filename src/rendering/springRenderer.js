import { BLOCK_SIZE, blockTop } from './oscillatorLayout.js';

const COILS = 20;

export function drawSpring(ctx, layout, state, isDragging) {
    const { centerX, centerY, pivotY: mountY } = layout;
    const top = blockTop(layout, state.y[0]);

    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(centerX - 50, mountY - 5, 100, 5);

    ctx.beginPath();
    ctx.moveTo(centerX, mountY);
    const springLen = top - mountY;
    for (let i = 1; i <= COILS; i++) {
        ctx.lineTo(centerX + (i % 2 === 0 ? 10 : -10), mountY + (springLen * i) / COILS);
    }
    ctx.lineTo(centerX, top);
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = isDragging ? '#ff6b5b' : '#e74c3c';
    ctx.shadowBlur = isDragging ? 25 : 15;
    ctx.shadowColor = '#e74c3c';
    ctx.fillRect(centerX - BLOCK_SIZE / 2, top, BLOCK_SIZE, BLOCK_SIZE);
    ctx.shadowBlur = 0;

    if (!isDragging) {
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - BLOCK_SIZE / 2 - 4, top - 4, BLOCK_SIZE + 8, BLOCK_SIZE + 8);
    }

    // Equilibrium marker
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY);
    ctx.lineTo(centerX + 60, centerY);
    ctx.stroke();
    ctx.setLineDash([]);
}
