import { BOB_RADIUS, bobPosition } from './oscillatorLayout.js';

export function drawPendulum(ctx, layout, state, params, isDragging) {
    const bob = bobPosition(layout, state.y[0], params.lengthM);

    ctx.beginPath();
    ctx.moveTo(layout.centerX, layout.pivotY);
    ctx.lineTo(bob.x, bob.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(bob.x, bob.y, BOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isDragging ? '#ffed4e' : '#f1c40f';
    ctx.shadowBlur = isDragging ? 25 : 15;
    ctx.shadowColor = '#f1c40f';
    ctx.fill();
    ctx.shadowBlur = 0;

    if (!isDragging) {
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bob.x, bob.y, BOB_RADIUS + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(layout.centerX, layout.pivotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#aaa';
    ctx.fill();
}
