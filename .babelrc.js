module.exports = {
  plugins: [
    require(`@babel/plugin-proposal-class-properties`),
    require(`@babel/plugin-proposal-object-rest-spread`)
  ],
  presets: [
    require(`@babel/preset-typescript`),
    [
      require(`@babel/preset-env`),
      { targets: { node: true }, modules: false, useBuiltIns: `usage`, corejs: 3 }
    ]
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
}
