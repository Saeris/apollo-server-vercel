// Adapted from https://github.com/apollographql/apollo-server/blob/main/packages/apollo-server-lambda/src/__tests__/lambdaApollo.test.ts
import { Config } from "apollo-server-core";
import gql from "graphql-tag";
// @ts-ignore
import request from "supertest";
import { createServer } from "vercel-node-server";
import { send } from "micro"
import testSuite, { schema as Schema, CreateAppOptions, NODE_MAJOR_VERSION } from "./integration";
import { ApolloServer } from "../ApolloServer";

const createApp = (options: CreateAppOptions | Config = { schema: Schema }) => {
  const server = new ApolloServer(options as Config);
  const handler = server.createHandler();
  return createServer((req, res) => {
    // Vercel has Filesystem base routing, so it handles 404's for us
    if (req?.url.includes(`/bogus-route`)) {
      send(res, 404);
    } else {
      handler(req, res);
    }
  });
};

const createCORSApp = (options: CreateAppOptions | Config = { schema: Schema }) => {
  const server = new ApolloServer(options as Config);
  const handler = server.createHandler({
    cors: {
      origin: `*`,
      credentials: true,
      methods: `GET,POST`,
      allowedHeaders: `origin,content-type`
    }
  });
  return createServer((req, res) => {
    // Vercel has Filesystem base routing, so it handles 404's for us
    if (req?.url.includes(`/bogus-route`)) {
      send(res, 404);
    } else {
      handler(req, res);
    }
  });
};

describe(`integration:Vercel`, () => {
  testSuite(createApp);
});

const typeDefs = gql`
  type File {
    filename: String!
    mimetype: String!
    encoding: String!
  }
  type Query {
    uploads: [File]
    helloWorld: String
  }
  type Mutation {
    singleUpload(file: Upload!): File!
    multiUpload(files: [Upload!]!): [File]!
  }
`;

const resolvers = {
  Query: {
    uploads() {}, // eslint-disable-line
    helloWorld() {
      return `hi`;
    }
  },
  Mutation: {
    async singleUpload(_parent: any, { file }: { file: any }) {
      expect((await file).createReadStream).toBeDefined();
      return file;
    },
    async multiUpload(_parent: any, { files }: { files: any }) {
      const fileArray = await files;
      fileArray.forEach(async (file: any) => {
        expect((await file).createReadStream).toBeDefined();
      });
      return fileArray;
    }
  }
};

// NODE: Skip Node.js 6 and 14, but only because `graphql-upload`
// doesn't support them on the version use use.
([6, 14].includes(NODE_MAJOR_VERSION) ? describe.skip : describe)(`file uploads`, () => {
  let app = <any>null;

  beforeEach(() => {
    app = createApp({
      typeDefs,
      resolvers
    });
  });

  test(`allows for a standard query without uploads`, async () => {
    const req = request(app)
      .post(`/graphql`)
      .set(`Content-Type`, `application/json`)
      .set(`Accept`, `application/json`)
      .send({
        query: `query{helloWorld}`
      });
    const res = await req;
    expect(res.statusCode).toBe(200);
    expect(res.body.data.helloWorld).toBe(`hi`);
  });

  test(`allows for uploading a single file`, () => {
    const expected = {
      filename: `package.json`,
      encoding: `7bit`,
      mimetype: `application/json`
    };

    const req = request(app)
      .post(`/graphql`)
      .set(`Content-Type`, `multipart/form-data`)
      .field(
        `operations`,
        JSON.stringify({
          query: `
            mutation($file: Upload!) {
              singleUpload(file: $file) {
                filename
                encoding
                mimetype
              }
            }
          `,
          variables: {
            file: null
          }
        })
      )
      .field(`map`, JSON.stringify({ 0: [`variables.file`] }))
      .attach(`0`, `package.json`);
    // eslint-disable-next-line
    return req.then((res: any) => {
      expect(res.status).toEqual(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.singleUpload).toEqual(expected);
    });
  });

  test(`allows for uploading multiple files`, () => {
    const expected = [
      {
        filename: `package.json`,
        encoding: `7bit`,
        mimetype: `application/json`
      },
      {
        filename: `tsconfig.json`,
        encoding: `7bit`,
        mimetype: `application/json`
      }
    ];

    const req = request(app)
      .post(`/graphql`)
      .type(`form`)
      .field(
        `operations`,
        JSON.stringify({
          query: `
            mutation($files: [Upload!]!) {
              multiUpload(files: $files) {
                filename
                encoding
                mimetype
              }
            }
          `,
          variables: {
            files: [null, null]
          }
        })
      )
      .field(`map`, JSON.stringify({ 0: [`variables.files.0`], 1: [`variables.files.1`] }))
      .attach(`0`, `package.json`)
      .attach(`1`, `tsconfig.json`);
    // eslint-disable-next-line
    return req.then((res: any) => {
      expect(res.status).toEqual(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.multiUpload).toEqual(expected);
    });
  });
});

describe(`cors`, () => {
  let app = <any>null;

  beforeEach(() => {
    app = createCORSApp({
      typeDefs,
      resolvers
    });
  });

  it(`should add expected cors headers to response`, async () => {
    const req = request(app)
      .post(`/graphql`)
      .set(`Content-Type`, `application/json`)
      .set(`Accept`, `application/json`)
      .send({
        query: `query{helloWorld}`
      });
    const res = await req;
    expect(res.statusCode).toBe(200);
    expect(res.body.data.helloWorld).toBe(`hi`);
    expect(res.header[`access-control-allow-origin`]).toEqual(`*`);
    expect(res.header[`access-control-allow-credentials`]).toEqual(`true`);
    expect(res.header[`access-control-allow-headers`]).toEqual(`origin,content-type`);
    expect(res.header[`access-control-allow-methods`]).toEqual(`GET,POST`);
  })
});
