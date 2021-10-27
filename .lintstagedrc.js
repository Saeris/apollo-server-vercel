// @ts-check

module.exports = {
  "src/**/*.{j,t}s?x": (filenames) => [
    `prettier --write ${filenames.join(` `)}`, // Applies code formatting
    `yarn lint --quiet --fix ${filenames.join(` `)}`, // Lints & Applies automatic fixes to problems
    `yarn typecheck --silent`
  ]
};
