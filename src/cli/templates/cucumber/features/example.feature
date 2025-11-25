Feature: Example TodoMVC Test

  Scenario: Add a todo item
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item "Buy groceries" to the list
    Then I should see "Buy groceries" in the todo list
    And the todo counter should show "1 item left"

  Scenario: Complete a todo item
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item "Complete this task"
    And I mark "Complete this task" as completed
    Then the todo item "Complete this task" should have a line through it
