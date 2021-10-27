<h1 align="center" style="display: block; text-align: center;">⚫ Apollo Server Vercel</h1>
<p align="center"><a href="https://www.npmjs.org/package/@saeris/apollo-server-vercel"><img src="https://img.shields.io/npm/v/@saeris/apollo-server-vercel.svg?style=flat" alt="npm"></a><a href="https://codecov.io/gh/Saeris/apollo-server-vercel"><img src="https://codecov.io/gh/Saeris/apollo-server-vercel/branch/master/graph/badge.svg" alt="codecov"/></a></p>
<p align="center">Production-ready Node.js GraphQL server for <a href="https://vercel.com/">Vercel</a> Serverless Functions</a>.</p>

---

> Note: These docs are subject to change, as this library is under construction. Expect things to be broken!

## 📦 Installation

In an existing application deployable to Vercel (such as [create-next-app](https://nextjs.org/blog/create-next-app)), add the following to your project's dependencies:

```bash
npm install --save @saeris/apollo-server-vercel graphql
# or
yarn add @saeris/apollo-server-vercel graphql
```

Only clone this repository if you intend to contribute to the development of this library! Please read the [Contributing](#%EF%B8%8F-contributing) section below for more details.

## 🔧 Usage

Please read Vercel's documentation on [how to deploy a serverless function](https://vercel.com/docs/serverless-functions/introduction) or if you are using Nextjs, follow their [guide on adding API routes](https://nextjs.org/docs/api-routes/introduction). Also note that this library is intended only for use with Vercel's hosting platform. If you intend to deploy a Nextjs app to a different platform, such as Netlify, you will need to use [Apollo Server Lambda](https://www.apollographql.com/docs/apollo-server/deployment/netlify/) instead. The API of this library is identical to `apollo-server-lambda` and as such, switching between the two is as simple as swapping out dependencies and placing your endpoint handler in the appropriate directory.

```typescript
// Create a new API endpoint handler in the appropriate directory for your project:
// Vercel: ./api/<endpoint-name>.{js|ts}
// Nextjs: ./pages/api/<endpoint-name>.{js|ts} or ./src/pages/api/<endpoint-name>.{js|ts}

import { ApolloServer } from "@saeris/apollo-server-vercel";

// Construct a schema, using GraphQL schema language
const typeDefs = `
  type Query {
    hello: String
  }
`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: () => "Hello world!"
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,

  // By default, the GraphQL Playground interface and GraphQL introspection
  // is disabled in "production" (i.e. when `process.env.NODE_ENV` is `production`).
  //
  // If you'd like to have GraphQL Playground and introspection enabled in production,
  // the `playground` and `introspection` options must be set explicitly to `true`.
  playground: true,
  introspection: true
});

export default server.createHandler();

// You should now be able to access your new endpoint from via::
// http://localhost:3000/api/<endpoint-name>
```

## 🕹️ Demo

The example under `api/example.ts` is live at https://apollo-server-vercel.saeris.io/api/example. You can also give it a try [via CodeSandbox](https://codesandbox.io/s/apollo-server-vercel-demo-oumls?file=/pages/api/demo.ts) or locally by cloning this repo, running `yarn && yarn start`, and then navigate to the URL provided in your terminal (usually http://localhost:3000/api/example).

---

## 🏗️ Contributing

If you would like to contribute to the development of this library, feel free to open a pull request! Getting started should be as easy as running `git clone https://github.com/Saeris/apollo-server-vercel.git` and then `npm install` or `yarn` to install dependencies. Please make sure you run `yarn test` after making any changes to ensure that all of the integration tests pass before submitting your PR.

## 🧪 Testing

Testing is provided via `jest` and is pre-configured to run with `codecov` as well. Tests for this library have been adapted from the official Apollo Server integration tests and they can be found under `src/__test__`. Additionally, this library uses `eslint`, `typescript`, and `prettier`, all three of which are automatically run on each commit via `husky` + `lint-staged`. To manually lint and test, use the following commands:

Lint:

```bash
yarn lint
```

Typecheck:

```bash
yarn typecheck
```

Test and watch for changes:

```bash
yarn test:watch
```

Lint + Typecheck + Test:

```bash
yarn test
```

## ⚠️ Support Notice

This code is released as-is, with no guarantee of support or maintenance over time. It was developed to meet my own personal needs and will only receive updates as and when I have a need for them. For that reason, if you come to rely on this package in your own codebase, I highly recommend that you create a fork rather than to submit a pull request, as I can make no promises about reviewing or merging PRs in a timely manner. Though I do very much appreciate feedback, PRs, and bug reports.

When updates are published, significant changes to the public API (including Typescript types) or major versions of peer dependencies will be considered breaking changes and as such will be published under a new major version. Features will be released under a new minor version, and miscellaneous changes or bug fixes will be published as patches.

## 📣 Acknowledgements

This library is based on [apollo-server-lambda](https://github.com/apollographql/apollo-server/tree/main/packages/apollo-server-lambda) and uses integration tests copied from that library as well as [apollo-server-integration-testsuite](https://github.com/apollographql/apollo-server/tree/main/packages/apollo-server-integration-testsuite). Huge thanks to all the folks at Apollo for their amazing work!

## 🥂 License

Released under the [MIT license](https://github.com/Saeris/apollo-server-vercel/blob/master/LICENSE.md).
