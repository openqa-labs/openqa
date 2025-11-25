export default {
  default: {
    require: ['features/step_definitions/**/*.js'],
    format: ['progress', 'html:cucumber-report.html'],
    paths: ['features/**/*.feature'],
    publishQuiet: true,
  }
};
