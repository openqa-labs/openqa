Feature: TodoMVC Testing

  Scenario: Add a todo item
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item "Buy groceries" on the web page
    Then I should see "Buy groceries" in the todo list

  Scenario: Complete a todo
    Given I navigate to "https://demo.playwright.dev/todomvc/"
    When I add a new todo item with text "Complete this task"
    And I mark "Complete this task" as completed on the web page
    Then the todo "Complete this task" should be marked as completed
