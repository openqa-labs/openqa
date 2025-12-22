Feature: TodoMVC Automation on Steel Docker Browser

  Scenario: Add todo item (intentionally failing)
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item "Buy groceries" on the web page
    Then I should see "Buy fruits" in the todo list
    When I add a new todo item "Buy veggies" on the web page

  Scenario: Filter todos
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add three todo items: "Task 1", "Task 2", and "Task 3" on the web page
    And I mark the first todo as completed
    And I click the Active filter to show only active todos on the web page
    Then I should see 2 active todos
