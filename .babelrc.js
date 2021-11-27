// @ts-check

/**
 * @type {import("@babel/core").ConfigFunction}
 */
module.exports = {
  presets: [
    require(`@babel/preset-typescript`),
    [require(`@babel/preset-env`), { targets: { node: true }, modules: false, useBuiltIns: `usage`, corejs: 3 }]
  ],
  env: {
    test: {
      sourceMaps: `inline`,
      presets: [
        [
          require(`@babel/preset-env`),
          {
            targets: { node: true },
            modules: `commonjs`,
            useBuiltIns: `usage`,
            corejs: 3
          }
        ]
      ]
    }
  }
};
