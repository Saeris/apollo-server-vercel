// Adapted from https://github.com/apollographql/apollo-server/blob/main/packages/apollo-server-lambda/src/__tests__/lambdaApollo.test.ts
import { gql } from "apollo-server-core";
import request from "supertest";
import { createApp, createCORSApp } from "./createApp";

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
    async singleUpload(_parent: unknown, { file }: { file: any }) {
      // eslint-disable-next-line jest/no-standalone-expect
      expect((await file).createReadStream).toBeDefined();
      return file;
    },
    async multiUpload(_parent: unknown, { files }: { files: any }) {
      const fileArray = await files;
      fileArray.forEach(async (file: any) => {
        // eslint-disable-next-line jest/no-standalone-expect
        expect((await file).createReadStream).toBeDefined();
      });
      return fileArray;
    }
  }
};

// NODE: Skip Node.js 6 and 14, but only because `graphql-upload`
// doesn't support them on the version use use.
describe(`skip node v6 and v14`, () => {
  ([6, 14].includes(parseInt(process.versions.node.split(`.`, 1)[0], 10)) ? describe.skip : describe)(
    `file uploads`,
    () => {
      let app = null as ReturnType<typeof createApp>;

      beforeEach(() => {
        app = createApp({
          typeDefs,
          resolvers
        });
      });

      it(`allows for a standard query without uploads`, async () => {
        const res = await request(app)
          .post(`/graphql`)
          .set(`Content-Type`, `application/json`)
          .set(`Accept`, `application/json`)
          .send({
            query: `
              query {
                helloWorld
              }
            `
          });
        expect(res.status).toBe(200);
        expect(res.body.data.helloWorld).toBe(`hi`);
      });

      it(`allows for uploading a single file`, async () => {
        const expected = {
          filename: `package.json`,
          encoding: `7bit`,
          mimetype: `application/json`
        };

        const res = await request(app)
          .post(`/graphql`)
          .set(`Content-Type`, `multipart/form-data`)
          .field(
            `operations`,
            JSON.stringify({
              query: `
                mutation ($file: Upload!) {
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
        expect(res.status).toStrictEqual(200);
        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.singleUpload).toStrictEqual(expected);
      });

      it(`allows for uploading multiple files`, async () => {
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

        const res = await request(app)
          .post(`/graphql`)
          .type(`form`)
          .field(
            `operations`,
            JSON.stringify({
              query: `
                mutation ($files: [Upload!]!) {
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
        expect(res.status).toStrictEqual(200);
        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.multiUpload).toStrictEqual(expected);
      });
    }
  );
});

describe(`cors`, () => {
  let app = null as ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createCORSApp({
      typeDefs,
      resolvers
    });
  });

  it(`should add expected cors headers to response`, async () => {
    const res = await request(app)
      .post(`/graphql`)
      .set(`Content-Type`, `application/json`)
      .set(`Accept`, `application/json`)
      .send({
        query: `
          query {
            helloWorld
          }
        `
      });
    expect(res.status).toBe(200);
    expect(res.body.data.helloWorld).toBe(`hi`);
    expect(res.header[`access-control-allow-origin`]).toStrictEqual(`*`);
    expect(res.header[`access-control-allow-credentials`]).toStrictEqual(`true`);
    expect(res.header[`access-control-allow-headers`]).toStrictEqual(`origin,content-type`);
    expect(res.header[`access-control-allow-methods`]).toStrictEqual(`GET,POST`);
  });
});
