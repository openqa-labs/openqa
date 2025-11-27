/**
 * OpenQA Step Definitions
 *
 * This single import replaces all manual step definitions!
 * The AI agent will handle all Given/When/Then steps automatically.
 * Browser setup is handled automatically.
 */

import { setDefaultTimeout } from '@cucumber/cucumber';
import 'openqa/bdd/cucumber';

// Set default timeout to 4 minutes for AI-powered browser tests
setDefaultTimeout(240000);

// That's it! Write your .feature files and let AI do the rest.
