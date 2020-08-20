module.exports = {
  displayName: `graphql-scalars`,
  coverageDirectory: `./.coverage/`,
  collectCoverage: true,
  collectCoverageFrom: [
    // include
    `./src/**/*.ts`,
    // exclude
    `!**/__mocks__/**/*`,
    `!**/__test__/**/*`,
    `!**/node_modules/**`,
    `!**/vendor/**`
  ],
  testEnvironment: `node`,
  transform: {
    "^.+\\.(js|ts)x?$": `babel-jest`
  },
  verbose: true
}
