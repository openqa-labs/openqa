export default {
  default: {
    require: ['features/step_definitions/**/*.js'],
    format: ['progress', '@cucumber/pretty-formatter', 'html:reports/cucumber-report.html'],
    paths: ['features/**/*.feature'],
    publishQuiet: true,
    parallel: 5,
    mode: 'generate'
  }
};
