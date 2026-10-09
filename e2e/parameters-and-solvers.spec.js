import { test, expect } from '@playwright/test';

test.describe('parameters change correctly', () => {
    test('slider keyboard: three → presses step gravity 9.81 → 9.84; End jumps to the maximum', async ({ page }) => {
        await page.goto('#/shm');
        const slider = page.getByRole('slider', { name: /gravity/i });
        const field = page.getByRole('spinbutton', { name: /gravity value/i });
        await slider.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(field).toHaveValue('9.84');
        await page.keyboard.press('End');
        await expect(field).toHaveValue('25.00');
    });

    test('typing an out-of-range value shows an error and Enter clamps it', async ({ page }) => {
        await page.goto('#/shm');
        const field = page.getByRole('spinbutton', { name: /gravity value/i });
        await field.fill('30');
        await expect(page.getByRole('alert')).toHaveText('Must be between 1 and 25.');
        await field.press('Enter');
        await expect(field).toHaveValue('25.00');
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('projectile: launch speed drives the predicted range (R = v²/g at 45°)', async ({ page }) => {
        await page.goto('#/projectile');
        const row = page.getByRole('row', { name: /Analytical, no drag/ });
        await expect(row).toContainText('366.972'); // 60²/9.81
        const v = page.getByRole('spinbutton', { name: /initial velocity v₀ value/i });
        await v.fill('40');
        await v.press('Enter');
        await expect(row).toContainText('163.099'); // 40²/9.81
    });

    test('waves: wavelength drives the predicted fringe spacing (β = λD/d)', async ({ page }) => {
        await page.goto('#/simulation');
        const row = page.getByRole('row', { name: /Fringe spacing β.*small angle/ });
        await expect(row).toContainText('λD/d20 cm');
        const lambda = page.getByRole('spinbutton', { name: /wavelength/i });
        await lambda.fill('30');
        await lambda.press('Enter');
        await expect(row).toContainText('λD/d30 cm');
    });
});

test.describe('solvers produce output', () => {
    test('projectile solver', async ({ page }) => {
        await page.goto('#/projectile/problems');
        await page.getByRole('button', { name: 'Calculate' }).click();
        await expect(page.getByText('40.77 m').first()).toBeVisible(); // 20²/9.81
        await page.getByLabel('Angle (θ) [deg, 0–90]').fill('120');
        await page.getByRole('button', { name: 'Calculate' }).click();
        await expect(page.getByRole('alert')).toContainText('Angle must be between 0° and 90°.');
    });

    test('pendulum solver', async ({ page }) => {
        await page.goto('#/shm/problems');
        await page.getByLabel('Length (L) [m]').fill('2');
        await page.getByRole('button', { name: 'Calculate' }).click();
        await expect(page.getByText(/2\.8370 s/).first()).toBeVisible(); // 2π√(2/9.81)
    });

    test('double-slit solver', async ({ page }) => {
        await page.goto('#/problems');
        await page.getByLabel('Problem Type').selectOption('maxima');
        await page.getByLabel(/Order \(n\)/).fill('2');
        await page.getByRole('button', { name: /calculate/i }).click();
        await expect(page.getByText('Final result: 2.0000 mm', { exact: false })).toBeVisible();
    });
});
