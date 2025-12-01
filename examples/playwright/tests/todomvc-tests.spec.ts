import { test, expect } from "@playwright/test";
import { runAgent } from "openqa";

/**
 * TodoMVC Tests
 *
 * Demonstrates AI agent automation with:
 * - 1 failing test (Add todo item - intentionally fails to demonstrate error handling)
 * - 1 passing test (Filter todos - demonstrates complex multi-step automation)
 * - Shared browser context between test and agent
 * - Uses unified agent interface (defaults to Claude, configurable via AGENT_TYPE env var)
 */

test.describe("TodoMVC Automation", () => {
  test("Add todo item (intentionally failing)", async ({ page, context }) => {
    await test.step('Navigate to the TodoMVC home page', async () => {
      await runAgent('Navigate to the TodoMVC home page https://demo.playwright.dev/todomvc/', context, { verbose: true });
    });
    await test.step('Add a new todo item "Buy groceries" on the web page', async () => {
      await runAgent('Add a new todo item "Buy groceries" on the web page', context, { verbose: true });
    });
    await test.step('Verify that "Buy fruits" appears in the todo list', async () => {
      // Note: This step intentionally fails - we added "Buy groceries" but verify "Buy fruits"
      await runAgent('Verify that "Buy fruits" appears in the todo list', context, { verbose: true });
    });
    await test.step('Add a new todo item "Buy veggies" on the web page', async () => {
      await runAgent('Add a new todo item "Buy veggies" on the web page', context, { verbose: true });
    });
  });

  test("Filter todos", async ({ page, context }) => {
    await runAgent('Navigate to "https://demo.playwright.dev/todomvc/"', context);
    await runAgent('Add three todo items: "Task 1", "Task 2", and "Task 3" on the web page', context);
    await runAgent('Mark the first todo as completed', context);
    await runAgent('Click the Active filter to show only active todos on the web page', context);
    await runAgent('Verify that there are 2 active todos', context);
  });
});

