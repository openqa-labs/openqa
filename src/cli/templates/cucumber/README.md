# OpenQA Cucumber.js Project

AI-powered browser automation with Cucumber/Gherkin syntax.

## Setup

1. **Authentication** (choose one):

   ```bash
   # Option 1: Claude Code (Recommended)
   claude login

   # Option 2: API Key
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

2. **Run tests**:

   ```bash
   npm test
   ```

3. **View test report**:

   Open `cucumber-report.html` in your browser

## Writing Tests

Create `.feature` files in the `features/` directory using Gherkin syntax:

```gherkin
Feature: My Feature

  Scenario: My Scenario
    Given I navigate to "https://example.com"
    When I click on the "Sign In" button
    And I fill in "email" with "test@example.com"
    And I fill in "password" with "password123"
    And I click the "Login" button
    Then I should see "Welcome back!" on the page
```

The AI agent automatically handles all steps - no code required!
Browser setup and teardown is handled automatically.

## Learn More

- [OpenQA Documentation](https://openqa.io/)
- [Cucumber.js Documentation](https://github.com/cucumber/cucumber-js)
