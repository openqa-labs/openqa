Feature: TodoMVC

  Scenario: Add a todo item
    * Navigate to "https://demo.playwright.dev/todomvc/"
    * Add a new todo item "Buy groceries"
    * Should see "Buy groceries" in the todo list

  Scenario: Filter completed todos
    * Navigate to "https://demo.playwright.dev/todomvc/"
    * Add three todo items: "Task 1", "Task 2", and "Task 3"
    * Mark the first todo as completed
    * Click the Active filter
    * Should see 2 active todos
