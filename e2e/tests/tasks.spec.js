import { test, expect } from '@playwright/test';

// Each test uses a unique, timestamped title so tests can't collide with
// each other even though they share one backend across the whole run.
function uniqueTitle(label) {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-form')).toBeVisible();
});

test('adding a task shows it in the list', async ({ page }) => {
  const title = uniqueTitle('Buy groceries');

  await page.getByTestId('task-title-input').fill(title);
  await page.getByTestId('task-description-input').fill('Milk, eggs, bread');
  await page.getByTestId('add-task-button').click();

  const item = page.getByTestId('task-item').filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(item.getByText('Milk, eggs, bread')).toBeVisible();
});

test('submitting an empty title shows a validation error and adds nothing', async ({ page }) => {
  await page.getByTestId('add-task-button').click();
  await expect(page.getByTestId('form-error')).toHaveText(/title is required/i);
});

test('toggling a task marks it completed and updates the remaining count', async ({ page }) => {
  const title = uniqueTitle('Finish report');

  await page.getByTestId('task-title-input').fill(title);
  await page.getByTestId('add-task-button').click();

  const item = page.getByTestId('task-item').filter({ hasText: title });
  const before = await page.getByTestId('active-count').textContent();
  const beforeCount = parseInt(before, 10);

  await item.getByTestId('task-toggle').check();
  await expect(item).toHaveClass(/completed/);

  await expect
    .poll(async () => {
      const text = await page.getByTestId('active-count').textContent();
      return parseInt(text, 10);
    })
    .toBe(beforeCount - 1);
});

test('filtering shows only tasks matching the selected status', async ({ page }) => {
  const activeTitle = uniqueTitle('Stay active');
  const completedTitle = uniqueTitle('Already done');

  await page.getByTestId('task-title-input').fill(activeTitle);
  await page.getByTestId('add-task-button').click();
  await expect(page.getByTestId('task-item').filter({ hasText: activeTitle })).toBeVisible();

  await page.getByTestId('task-title-input').fill(completedTitle);
  await page.getByTestId('add-task-button').click();
  const completedItem = page.getByTestId('task-item').filter({ hasText: completedTitle });
  await expect(completedItem).toBeVisible();
  await completedItem.getByTestId('task-toggle').check();

  await page.getByTestId('filter-completed').click();
  await expect(page.getByTestId('task-item').filter({ hasText: completedTitle })).toBeVisible();
  await expect(page.getByTestId('task-item').filter({ hasText: activeTitle })).toHaveCount(0);

  await page.getByTestId('filter-active').click();
  await expect(page.getByTestId('task-item').filter({ hasText: activeTitle })).toBeVisible();
  await expect(page.getByTestId('task-item').filter({ hasText: completedTitle })).toHaveCount(0);

  await page.getByTestId('filter-all').click();
  await expect(page.getByTestId('task-item').filter({ hasText: activeTitle })).toBeVisible();
  await expect(page.getByTestId('task-item').filter({ hasText: completedTitle })).toBeVisible();
});

test('deleting a task removes it from the list', async ({ page }) => {
  const title = uniqueTitle('Temporary task');

  await page.getByTestId('task-title-input').fill(title);
  await page.getByTestId('add-task-button').click();

  const item = page.getByTestId('task-item').filter({ hasText: title });
  await expect(item).toBeVisible();

  await item.getByTestId('delete-task-button').click();
  await expect(page.getByTestId('task-item').filter({ hasText: title })).toHaveCount(0);
});
