import { test } from '@playwright/test';
import { runAgent } from 'openqa';

test.describe("Debug TodoMVC Test", () => {
  test("Debug: Add todo with verbose output", async ({ page, context }) => {
    await runAgent('Navigate to the pizza order form page https://httpbin.org/forms/post', context, { verbose: true });
    
    await runAgent('Fill in the pizza order form with customer name "John Doe", telephone "555-0123", email "john@example.com", select Medium size, select Bacon topping, and fill delivery time as "18:00"', context, { verbose: true });
    await runAgent('Submit the pizza order form', context, { verbose: true });
    await runAgent('Verify I am on the success page', context, { verbose: true });
  });
});

