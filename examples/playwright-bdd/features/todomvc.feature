Feature: TodoMVC Automation

  Scenario: Add todo item (intentionally failing)
    * Navigate to "https://demo.playwright.dev/todomvc/"
    * Add a new todo item "Buy groceries" on the web page
    * Should see "Buy fruits" in the todo list
    * Add a new todo item "Buy veggies" on the web page
    * Should see "Buy Bananas" in the todo list

  Scenario: Filter todos
    * Navigate to "https://demo.playwright.dev/todomvc/"
    * Add three todo items: "Task 1", "Task 2", and "Task 3" on the web page
    * Mark the first todo as completed
    * Click the Active filter to show only active todos on the web page
    * Should see 2 active todos
