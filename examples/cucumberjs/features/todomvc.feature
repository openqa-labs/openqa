Feature: TodoMVC Automation

  Scenario: Add todo item (intentionally failing)
    Given Navigate to "https://demo.playwright.dev/todomvc/"
    When Add a new todo item "Buy groceries" on the web page
    Then Should see "Buy fruits" in the todo list
    When Add a new todo item "Buy veggies" on the web page

  Scenario: Filter todos
    Given Navigate to "https://demo.playwright.dev/todomvc/"
    When Add three todo items: "Task 1", "Task 2", and "Task 3" on the web page
    And Mark the first todo as completed
    And Click the Active filter to show only active todos on the web page
    Then Should see 2 active todos
