import { test, expect } from '@playwright/test';
import { expectAnimating, expectFrozen } from './helpers';

test.describe('Oscillator Lab: start, pause, resume, reset', () => {
    test('the pendulum runs, pauses, resumes and resets', async ({ page }) => {
        await page.goto('#/shm');
        const canvas = page.getByRole('img', { name: 'Pendulum simulation' });
        await expectAnimating(canvas);

        await page.getByRole('button', { name: /pause/i }).click();
        await expect(page.getByRole('button', { name: /resume/i })).toBeVisible();
        await expectFrozen(page, canvas);

        await page.getByRole('button', { name: /resume/i }).click();
        await expectAnimating(canvas);

        // After two periods a measured period appears in the validation panel; reset clears it.
        const period = page.getByRole('region', { name: 'Validation' }).getByRole('row').filter({ hasText: /^Period T/ });
        await expect(period).toHaveText(/\d\.\d{3,} s.*\d\.\d{3,} s/, { timeout: 10_000 });
        await page.getByRole('button', { name: /reset/i }).click();
        await expect(period).toContainText('measuring…');
    });

    test('switching to the spring changes the controls and the drawing', async ({ page }) => {
        await page.goto('#/shm');
        await page.getByRole('button', { name: 'Spring', exact: true }).click();
        await expect(page.getByRole('img', { name: 'Spring-mass simulation' })).toBeVisible();
        await expect(page.getByRole('slider', { name: /spring constant/i })).toBeVisible();
        await expectAnimating(page.getByRole('img', { name: 'Spring-mass simulation' }));
    });
});

test.describe('other labs start and stop', () => {
    test('Numerical Methods Lab: pause freezes all three pendulums; restart clears the periods', async ({ page }) => {
        await page.goto('#/numerical-methods');
        const pendulums = page.getByRole('img', { name: /three pendulums/i });
        await expectAnimating(pendulums);
        await page.getByRole('button', { name: /pause/i }).click();
        await expectFrozen(page, pendulums);
        await page.getByRole('button', { name: /resume/i }).click();
        await expectAnimating(pendulums);
        await page.getByRole('button', { name: /restart/i }).click();
        await expect(page.getByRole('cell', { name: 'measuring…' })).toHaveCount(3);
    });

    test('Projectile Lab: a shot flies and lands', async ({ page }) => {
        await page.goto('#/projectile');
        await page.getByLabel('Playback speed').selectOption('10');
        await page.getByRole('button', { name: 'FIRE' }).click();
        await expect(page.getByRole('button', { name: /stop/i })).toBeVisible();
        await expect(page.getByRole('slider', { name: /initial velocity/i })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'FIRE' })).toBeVisible({ timeout: 10_000 }); // landed
        await expect(page.getByRole('slider', { name: /initial velocity/i })).toBeEnabled();
    });

    test('Wave Interference: animates, freezes and animates again', async ({ page }) => {
        await page.goto('#/simulation');
        const field = page.getByRole('img', { name: /wave field/i });
        await expectAnimating(field);
        await page.getByRole('button', { name: /freeze/i }).click();
        await expectFrozen(page, field);
        await page.getByRole('button', { name: /animate/i }).click();
        await expectAnimating(field);
    });

    test('FDTD lab: runs, pauses, restarts, and reports a CFL blow-up', async ({ page }) => {
        await page.goto('#/waves/fdtd');
        const field = page.getByRole('img', { name: /fdtd wave field/i });
        await expectAnimating(field);
        await page.getByRole('button', { name: /pause/i }).click();
        await expectFrozen(page, field);
        await page.getByRole('button', { name: /run/i }).click();
        await expectAnimating(field);

        const courant = page.getByRole('spinbutton', { name: /courant/i });
        await courant.fill('0.8');
        await courant.press('Enter');
        await expect(page.getByRole('alert')).toContainText('violates the CFL condition');
        await expect(page.getByRole('status')).toContainText(/blew up after \d+ steps/, { timeout: 15_000 });
        await courant.fill('0.5');
        await courant.press('Enter');
        await expect(page.getByRole('status')).toHaveCount(0);
    });
});
