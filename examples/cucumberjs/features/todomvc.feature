Feature: TodoMVC and Form Automation

  Scenario: Add todo item
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item "Buy groceries" on the web page
    Then I should see "Buy groceries" in the todo list

  Scenario: Complete todo item
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item with text "Complete this task"
    And I mark "Complete this task" as completed on the web page
    Then the todo "Complete this task" should be marked as completed

  Scenario: Filter todos
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add three todo items: "Task 1", "Task 2", and "Task 3" on the web page
    And I mark the first todo as completed
    And I click the Active filter to show only active todos on the web page
    Then I should see 2 active todos

  Scenario: Fill and submit pizza order form
    Given I navigate to "https://httpbin.org/forms/post"
    When I fill in the pizza order form with: customer name "John Doe", telephone "555-0123", email "john@example.com", select Medium size, select Bacon topping, and fill delivery time as "18:00"
    And I submit the pizza order form
    Then I should be on the success page
