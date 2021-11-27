// @ts-check

// @ts-ignore
require(`@saeris/eslint-config/patch`);

/**
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  root: true,
  extends: [
    require.resolve(`@saeris/eslint-config/base`),
    require.resolve(`@saeris/eslint-config/jest`),
    require.resolve(`@saeris/eslint-config/typescript`),
    require.resolve(`@saeris/eslint-config/type-aware`)
  ],
  rules: {
    "import/no-named-as-default": `off`,
    "import/no-cycle": `off`,
    "import/no-unused-modules": `off`,
    "import/no-deprecated": `off`
  },
  ignorePatterns: [`*.js`]
};
