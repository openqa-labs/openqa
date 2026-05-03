# OpenQA Playwright-BDD Project

AI-powered browser automation with Gherkin/BDD syntax.

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

   ```bash
   npm run test:report
   ```

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

## Learn More

- [OpenQA Documentation](https://openqa.io/)
- [Playwright-BDD Documentation](https://vitalets.github.io/playwright-bdd/)
