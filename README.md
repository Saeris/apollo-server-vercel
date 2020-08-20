<h1 align="center" style="display: block; text-align: center;">⚫ Apollo Server Vercel</h1>
<p align="center"><a href="https://www.npmjs.org/package/@saeris/apollo-server-vercel"><img src="https://img.shields.io/npm/v/@saeris/apollo-server-vercel.svg?style=flat" alt="npm"></a><a href="https://travis-ci.com/Saeris/apollo-server-vercel"><img src="https://travis-ci.com/Saeris/apollo-server-vercel.svg?branch=master" alt="travis"></a><a href="https://codecov.io/gh/Saeris/apollo-server-vercel"><img src="https://codecov.io/gh/Saeris/apollo-server-vercel/branch/master/graph/badge.svg" alt="codecov"/></a></p>
<p align="center">Production-ready Node.js GraphQL server for <a href="https://vercel.com/">Vercel</a> Serverless Functions</a>.</p>

---

> Note: These docs are subject to change, as this library is under construction. Expect things to be broken!

## 📦 Installation

```bash
npm install --save @saeris/apollo-server-vercel
# or
yarn add @saeris/apollo-server-vercel
```

## 🔧 Usage

```typescript
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
    hello: () => 'Hello world!',
  },
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
  introspection: true,
});

export default server.createHandler();
```

## 🏖️ Example

Give it a try [via CodeSandbox](https://codesandbox.io/s/apollo-server-vercel-demo-oumls?file=/pages/api/demo.ts)!

## 🥂 License

Released under the [MIT license](https://github.com/Saeris/apollo-server-vercel/blob/master/LICENSE.md).
