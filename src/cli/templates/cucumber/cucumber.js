export default {
  default: {
    require: ['features/step_definitions/**/*.js'],
    format: ['progress', '@cucumber/pretty-formatter', 'html:cucumber-test-results/cucumber-report.html'],
    paths: ['features/**/*.feature'],
    publishQuiet: true,
  }
};
