Feature: TodoMVC

  Scenario: Add a todo item
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add a new todo item "Buy groceries"
    * I should see "Buy groceries" in the todo list

  Scenario: Filter completed todos
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add three todo items: "Task 1", "Task 2", and "Task 3"
    * I mark the first todo as completed
    * I click the Active filter
    * I should see 2 active todos
