module.exports = {
  displayName: `graphql-scalars`,
  coverageDirectory: `./.coverage/`,
  collectCoverage: true,
  testEnvironment: `node`,
  transform: {
    "^.+\\.(js|ts)x?$": `babel-jest`
  },
  verbose: true
}
