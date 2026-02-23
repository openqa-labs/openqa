import { test } from "@playwright/test";
import { runAgent, createSession, closeSession } from "openqa";

/**
 * TodoMVC Tests
 *
 * Demonstrates AI agent automation with:
 * - 1 failing test (Add todo item - intentionally fails to demonstrate error handling)
 * - 1 passing test (Filter todos - demonstrates complex multi-step automation)
 * - Session-based browser management via playwright-cli
 * - Uses unified agent interface (defaults to Claude, configurable via AGENT_TYPE env var)
 */

test.describe("TodoMVC Automation", () => {
  let session: string;

  test.beforeEach(async () => { session = createSession(); });
  test.afterEach(async () => { await closeSession(session); });

  test("Add todo item (intentionally failing)", async () => {
    await test.step('Navigate to the TodoMVC home page', async () => {
      await runAgent('Navigate to the TodoMVC home page https://demo.playwright.dev/todomvc/', { session, verbose: true });
    });
    await test.step('Add a new todo item "Buy groceries" on the web page', async () => {
      await runAgent('Add a new todo item "Buy groceries" on the web page', { session, verbose: true });
    });
    await test.step('Verify that "Buy fruits" appears in the todo list', async () => {
      // Note: This step intentionally fails - we added "Buy groceries" but verify "Buy fruits"
      await runAgent('Verify that "Buy fruits" appears in the todo list', { session, verbose: true });
    });
    await test.step('Add a new todo item "Buy veggies" on the web page', async () => {
      await runAgent('Add a new todo item "Buy veggies" on the web page', { session, verbose: true });
    });
  });

  test("Filter todos", async () => {
    await runAgent('Navigate to "https://demo.playwright.dev/todomvc/"', { session });
    await runAgent('Add three todo items: "Task 1", "Task 2", and "Task 3" on the web page', { session });
    await runAgent('Mark the first todo as completed', { session });
    await runAgent('Click the Active filter to show only active todos on the web page', { session });
    await runAgent('Verify that there are 2 active todos', { session });
  });
});
