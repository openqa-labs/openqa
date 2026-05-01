import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://demo.playwright.dev/todomvc/');
  
  // Fill the todo input and press Enter
  await page.fill('.new-todo', 'Buy groceries');
  await page.press('.new-todo', 'Enter');
  
  // Wait for the item to be added
  await page.waitForTimeout(500);
  
  // Verify the item was added
  const todoText = await page.textContent('.todo-list li label');
  console.log('✓ Todo item added to page');
  console.log('✓ Visible text:', todoText);
  
  await browser.close();
})();
