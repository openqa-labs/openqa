Feature: TodoMVC Automation

  Scenario: Add todo item (intentionally failing)
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add a new todo item "Buy groceries" on the web page
    * I should see "Buy fruits" in the todo list
    * I add a new todo item "Buy veggies" on the web page
    * I should see "Buy Bananas" in the todo list

  Scenario: Filter todos
    * I navigate to "https://demo.playwright.dev/todomvc/"
    * I add three todo items: "Task 1", "Task 2", and "Task 3" on the web page
    * I mark the first todo as completed
    * I click the Active filter to show only active todos on the web page
    * I should see 2 active todos
