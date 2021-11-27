// Borrowed from https://github.com/apollographql/apollo-server/tree/main/packages/apollo-server-integration-testsuite
import type { PersistedQueryOptions, KeyValueCache } from "apollo-server-core";
import { gql } from "apollo-server-core";
import type { GraphQLRequestListener } from "apollo-server-plugin-base";
import { PersistedQueryNotFoundError } from "apollo-server-errors";
import { GraphQLError, getIntrospectionQuery, BREAK } from "graphql";
import request from "supertest";
import { sha256 } from "js-sha256";
import { createApp } from "./createApp";
import { schema, TestSchema } from "./schema";

type HTTPError = Exclude<request.Response["error"], false>;
const VERSION = 1 as const;

describe(`apolloServer`, () => {
  let app = null as ReturnType<typeof createApp>;
  let didEncounterErrors: jest.Mock<
    ReturnType<GraphQLRequestListener["didEncounterErrors"]>,
    Parameters<GraphQLRequestListener["didEncounterErrors"]>
  >;

  afterEach(() => {
    if (app) {
      app = null;
    }
  });

  describe(`graphqlHTTP`, () => {
    it(`rejects the request if the method is not POST or GET`, async () => {
      app = createApp();
      const res = await request(app).head(`/graphql`).send();
      expect(res.status).toStrictEqual(405);
      expect(res.header.allow).toStrictEqual(`GET, POST`);
    });

    it(`throws an error if POST body is missing`, async () => {
      app = createApp();
      const res = await request(app).post(`/graphql`).send();
      expect(res.status).toStrictEqual(500);
      expect((res.error as HTTPError).text).toMatch(`POST body missing.`);
    });

    it(`throws an error if GET query is missing`, async () => {
      app = createApp();
      const res = await request(app).get(`/graphql`);
      expect(res.status).toStrictEqual(400);
      expect((res.error as HTTPError).text).toMatch(`GET query missing.`);
    });

    it(`can handle a basic GET request`, async () => {
      app = createApp();
      const expected = {
        testString: `it works`
      };
      const query = {
        query: `
          query test {
            testString
          }
        `
      };
      const res = await request(app).get(`/graphql`).query(query);
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle a basic implicit GET request`, async () => {
      app = createApp();
      const expected = {
        testString: `it works`
      };
      const query = {
        query: `
          {
            testString
          }
        `
      };
      const res = await request(app).get(`/graphql`).query(query);
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`throws error if trying to use mutation using GET request`, async () => {
      didEncounterErrors = jest.fn();
      app = createApp({
        schema,
        plugins: [
          {
            requestDidStart(): { didEncounterErrors: typeof didEncounterErrors } {
              return { didEncounterErrors };
            }
          }
        ]
      });
      const query = {
        query: `
          mutation test {
            testMutation(echo: "ping")
          }
        `
      };
      const res = await request(app).get(`/graphql`).query(query);

      expect(res.status).toStrictEqual(405);
      expect(res.header.allow).toStrictEqual(`POST`);
      expect((res.error as HTTPError).text).toMatch(`GET supports only query operation`);
      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: `GET supports only query operation`
            })
          ])
        })
      );
    });

    it(`throws error if trying to use mutation with fragment using GET request`, async () => {
      didEncounterErrors = jest.fn();
      app = createApp({
        schema,
        plugins: [
          {
            requestDidStart(): { didEncounterErrors: typeof didEncounterErrors } {
              return { didEncounterErrors };
            }
          }
        ]
      });
      const query = {
        query: `
          fragment PersonDetails on PersonType {
            firstName
          }
          mutation test {
            testPerson(firstName: "Test", lastName: "Me") {
              ...PersonDetails
            }
          }
        `
      };
      const res = await request(app).get(`/graphql`).query(query);
      expect(res.status).toStrictEqual(405);
      expect(res.header.allow).toStrictEqual(`POST`);
      expect((res.error as HTTPError).text).toMatch(`GET supports only query operation`);
      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: `GET supports only query operation`
            })
          ])
        })
      );
    });

    it(`can handle a GET request with variables`, async () => {
      app = createApp();
      const query = {
        query: `
          query test($echo: String) {
            testArgument(echo: $echo)
          }
        `,
        variables: JSON.stringify({ echo: `world` })
      };
      const expected = {
        testArgument: `hello world`
      };
      const res = await request(app).get(`/graphql`).query(query);
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle a basic request`, async () => {
      app = createApp();
      const expected = {
        testString: `it works`
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testString
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle a basic request with cacheControl`, async () => {
      app = createApp({ schema, cacheControl: true });
      const expected = {
        testPerson: { firstName: `Jane` }
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testPerson {
                firstName
              }
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
      expect(res.body.extensions).toStrictEqual({
        cacheControl: {
          version: 1,
          hints: [{ maxAge: 0, path: [`testPerson`] }]
        }
      });
    });

    it(`can handle a basic request with cacheControl and defaultMaxAge`, async () => {
      app = createApp({
        schema,
        cacheControl: {
          defaultMaxAge: 5,
          stripFormattedExtensions: false,
          calculateHttpHeaders: false
        }
      });
      const expected = {
        testPerson: { firstName: `Jane` }
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testPerson {
                firstName
              }
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
      expect(res.body.extensions).toStrictEqual({
        cacheControl: {
          version: 1,
          hints: [{ maxAge: 5, path: [`testPerson`] }]
        }
      });
    });

    it(`returns PersistedQueryNotSupported to a GET request if PQs disabled`, async () => {
      app = createApp({ schema, persistedQueries: false });
      const res = await request(app)
        .get(`/graphql`)
        .query({
          extensions: JSON.stringify({
            persistedQuery: {
              version: 1,
              sha256Hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
            }
          })
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toStrictEqual(`PersistedQueryNotSupported`);
    });

    it(`returns PersistedQueryNotSupported to a POST request if PQs disabled`, async () => {
      app = createApp({ schema, persistedQueries: false });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
            }
          }
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toStrictEqual(`PersistedQueryNotSupported`);
    });

    it(`returns PersistedQueryNotFound to a GET request`, async () => {
      app = createApp();
      const res = await request(app)
        .get(`/graphql`)
        .query({
          extensions: JSON.stringify({
            persistedQuery: {
              version: 1,
              sha256Hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
            }
          })
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toStrictEqual(`PersistedQueryNotFound`);
    });

    it(`returns PersistedQueryNotFound to a POST request`, async () => {
      app = createApp();
      const res = await request(app)
        .post(`/graphql`)
        .send({
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
            }
          }
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toStrictEqual(`PersistedQueryNotFound`);
    });

    it(`can handle a request with variables`, async () => {
      app = createApp();
      const expected = {
        testArgument: `hello world`
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test($echo: String) {
              testArgument(echo: $echo)
            }
          `,
          variables: { echo: `world` }
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle a request with variables as string`, async () => {
      app = createApp();
      const expected = {
        testArgument: `hello world`
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test($echo: String!) {
              testArgument(echo: $echo)
            }
          `,
          variables: `{ "echo": "world" }`
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle a request with variables as an invalid string`, async () => {
      app = createApp();
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test($echo: String!) {
              testArgument(echo: $echo)
            }
          `,
          variables: `{ echo: "world" }`
        });
      expect(res.status).toStrictEqual(400);
      expect((res.error as HTTPError).text).toMatch(`Variables are invalid JSON.`);
    });

    it(`can handle a request with operationName`, async () => {
      app = createApp();
      const expected = {
        testString: `it works`
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test($echo: String) {
              testArgument(echo: $echo)
            }
            query test2 {
              testString
            }
          `,
          variables: { echo: `world` },
          operationName: `test2`
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`can handle introspection request`, async () => {
      app = createApp();
      const res = await request(app).post(`/graphql`).send({ query: getIntrospectionQuery() });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data.__schema.types[0].fields[0].name).toStrictEqual(`testString`);
    });

    it(`does not accept a query AST`, async () => {
      app = createApp();
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: gql`
            query test {
              testString
            }
          `
        });
      expect(res.status).toStrictEqual(400);
      expect(res.text).toMatch(`GraphQL queries must be strings`);
    });

    it(`can handle batch requests`, async () => {
      app = createApp();
      const expected = [
        {
          data: {
            testString: `it works`
          }
        },
        {
          data: {
            testArgument: `hello yellow`
          }
        }
      ];
      const res = await request(app)
        .post(`/graphql`)
        .send([
          {
            query: `
              query test($echo: String) {
                testArgument(echo: $echo)
              }
              query test2 {
                testString
              }
            `,
            variables: { echo: `world` },
            operationName: `test2`
          },
          {
            query: `
              query testX($echo: String) {
                testArgument(echo: $echo)
              }
            `,
            variables: { echo: `yellow` },
            operationName: `testX`
          }
        ]);
      expect(res.status).toStrictEqual(200);
      expect(res.body).toStrictEqual(expected);
    });

    it(`can handle batch requests 2`, async () => {
      app = createApp();
      const expected = [
        {
          data: {
            testString: `it works`
          }
        }
      ];
      const res = await request(app)
        .post(`/graphql`)
        .send([
          {
            query: `
              query test($echo: String) {
                testArgument(echo: $echo)
              }
              query test2 {
                testString
              }
            `,
            variables: { echo: `world` },
            operationName: `test2`
          }
        ]);
      expect(res.status).toStrictEqual(200);
      expect(res.body).toStrictEqual(expected);
    });

    it(`can handle batch requests in parallel`, async () => {
      const parallels = 100;
      const delayPerReq = 40;

      app = createApp();
      const expected = Array(parallels).fill({
        data: { testStringWithDelay: `it works` }
      });
      const res = await request(app)
        .post(`/graphql`)
        .send(
          Array(parallels).fill({
            query: `
              query test($delay: Int!) {
                testStringWithDelay(delay: $delay)
              }
            `,
            operationName: `test`,
            variables: { delay: delayPerReq }
          })
        );
      expect(res.status).toStrictEqual(200);
      expect(res.body).toStrictEqual(expected);
    }, 3000); // this test will fail due to timeout if running serially.

    it(`clones batch context`, async () => {
      app = createApp({
        schema,
        context: { testField: `expected` }
      });
      const expected = [
        {
          data: {
            testContext: `expected`
          }
        },
        {
          data: {
            testContext: `expected`
          }
        }
      ];
      const res = await request(app)
        .post(`/graphql`)
        .send([
          {
            query: `
              query test {
                testContext
              }
            `
          },
          {
            query: `
              query test {
                testContext
              }
            `
          }
        ]);
      expect(res.status).toStrictEqual(200);
      expect(res.body).toStrictEqual(expected);
    });

    it(`executes batch context if it is a function`, async () => {
      let callCount = 0;
      app = createApp({
        schema,
        context: () => {
          callCount++;
          return { testField: `expected` };
        }
      });
      const expected = [
        {
          data: {
            testContext: `expected`
          }
        },
        {
          data: {
            testContext: `expected`
          }
        }
      ];
      const res = await request(app)
        .post(`/graphql`)
        .send([
          {
            query: `
              query test {
                testContext
              }
            `
          },
          {
            query: `
              query test {
                testContext
              }
            `
          }
        ]);
      // XXX In AS 1.0 we ran context once per GraphQL operation (so this
      // was 2) rather than once per HTTP request. Was this actually
      // helpful? Honestly we're not sure why you'd use a function in the
      // 1.0 API anyway since the function didn't actually get any useful
      // arguments. Right now there's some weirdness where a context
      // function is actually evaluated both inside ApolloServer and in
      // runHttpQuery.
      expect(callCount).toStrictEqual(1);
      expect(res.status).toStrictEqual(200);
      expect(res.body).toStrictEqual(expected);
    });

    it(`can handle a request with a mutation`, async () => {
      app = createApp();
      const expected = {
        testMutation: `not really a mutation, but who cares: world`
      };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            mutation test($echo: String) {
              testMutation(echo: $echo)
            }
          `,
          variables: { echo: `world` }
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data).toStrictEqual(expected);
    });

    it(`applies the formatResponse function`, async () => {
      app = createApp({
        schema,
        formatResponse(response) {
          response.extensions = { it: `works` };
          return response;
        }
      });
      const expected = { it: `works` };
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            mutation test($echo: String) {
              testMutation(echo: $echo)
            }
          `,
          variables: { echo: `world` }
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.extensions).toStrictEqual(expected);
    });

    it(`passes the context to the resolver`, async () => {
      const expected = `context works`;
      app = createApp({
        schema,
        context: { testField: expected }
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testContext
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data.testContext).toStrictEqual(expected);
    });

    it(`passes the rootValue to the resolver`, async () => {
      const expected = `it passes rootValue`;
      app = createApp({
        schema,
        rootValue: expected
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testRootValue
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.data.testRootValue).toStrictEqual(expected);
    });

    it(`passes the rootValue function result to the resolver for query`, async () => {
      const expectedQuery = `query: it passes rootValue`;
      app = createApp({
        schema,
        rootValue: () => expectedQuery
      });
      const queryRes = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testRootValue
            }
          `
        });
      expect(queryRes.status).toStrictEqual(200);
      expect(queryRes.body.data.testRootValue).toStrictEqual(expectedQuery);
    });

    it(`passes the rootValue function result to the resolver for mutation`, async () => {
      const expectedMutation = `mutation: it passes rootValue`;
      app = createApp({
        schema,
        rootValue: () => expectedMutation
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            mutation test {
              testRootValue
            }
          `
        });
      res.body; //?
      expect(res.status).toStrictEqual(200);
      expect(res.body.data.testRootValue).toStrictEqual(expectedMutation);
    });

    it(`returns errors`, async () => {
      const expected = `Secret error message`;
      app = createApp({
        schema
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testError
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors[0].message).toStrictEqual(expected);
    });

    it(`applies formatError if provided`, async () => {
      const expected = `--blank--`;
      app = createApp({
        schema,
        formatError: (error) => {
          expect(error instanceof Error).toBe(true);
          return { message: expected };
        }
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testError
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors[0].message).toStrictEqual(expected);
    });

    it(`formatError receives error that passes instanceof checks`, async () => {
      const expected = `--blank--`;
      app = createApp({
        schema,
        formatError: (error) => {
          expect(error instanceof Error).toBe(true);
          expect(error instanceof GraphQLError).toBe(true);
          return { message: expected };
        }
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testError
            }
          `
        });
      expect(res.status).toStrictEqual(200);
      expect(res.body.errors[0].message).toStrictEqual(expected);
    });

    it(`allows for custom error formatting to sanitize`, async () => {
      app = createApp({
        schema: TestSchema,
        formatError(error) {
          return { message: `Custom error format: ${error.message}` };
        }
      });

      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            {
              thrower
            }
          `
        });

      expect(res.status).toStrictEqual(200);
      expect(JSON.parse(res.text)).toStrictEqual({
        data: null,
        errors: [
          {
            message: `Custom error format: Throws!`
          }
        ]
      });
    });

    it(`allows for custom error formatting to elaborate`, async () => {
      app = createApp({
        schema: TestSchema,
        formatError(error) {
          return {
            message: error.message,
            locations: error.locations,
            stack: `Stack trace`
          };
        }
      });

      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            {
              thrower
            }
          `
        });

      expect(res.status).toStrictEqual(200);
      expect(JSON.parse(res.text)).toStrictEqual({
        data: null,
        errors: [
          {
            message: `Throws!`,
            locations: [{ line: 3, column: 15 }],
            stack: `Stack trace`
          }
        ]
      });
    });

    it(`sends internal server error when formatError fails`, async () => {
      app = createApp({
        schema,
        formatError: () => {
          throw new Error(`I should be caught`);
        }
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testError
            }
          `
        });
      expect(res.body.errors[0].message).toStrictEqual(`Internal server error`);
    });

    it(`applies additional validationRules`, async () => {
      const expected = `alwaysInvalidRule was really invalid!`;
      const alwaysInvalidRule = (context): { enter: () => unknown } => ({
        enter(): unknown {
          context.reportError(new GraphQLError(expected));
          return BREAK;
        }
      });
      app = createApp({
        schema,
        validationRules: [alwaysInvalidRule]
      });
      const res = await request(app)
        .post(`/graphql`)
        .send({
          query: `
            query test {
              testString
            }
          `
        });
      expect(res.status).toStrictEqual(400);
      expect(res.body.errors[0].message).toStrictEqual(expected);
    });
  });

  describe(`server setup`, () => {
    it(`throws error on 404 routes`, async () => {
      app = createApp();

      const query = {
        query: `
          {
            testString
          }
        `
      };
      const res = await request(app).get(`/bogus-route`).query(query);
      expect(res.status).toStrictEqual(404);
    });
  });

  describe(`Persisted Queries`, () => {
    const query = `{testString}`;
    const query2 = `{ testString }`;

    const hash = sha256.create().update(query).hex();
    const extensions = {
      persistedQuery: {
        version: VERSION,
        sha256Hash: hash
      }
    };

    const extensions2 = {
      persistedQuery: {
        version: VERSION,
        sha256Hash: sha256.create().update(query2).hex()
      }
    };

    const createMockCache = (): KeyValueCache => {
      const map = new Map<string, string>();
      return {
        set: jest.fn(async (key, val) => {
          // eslint-disable-next-line @typescript-eslint/await-thenable
          await map.set(key, val);
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        get: jest.fn(async (key) => map.get(key)),
        // eslint-disable-next-line @typescript-eslint/require-await
        delete: jest.fn(async (key) => map.delete(key))
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-shadow
    let didEncounterErrors: jest.Mock<
      ReturnType<GraphQLRequestListener["didEncounterErrors"]>,
      Parameters<GraphQLRequestListener["didEncounterErrors"]>
    >;

    let didResolveSource: jest.Mock<
      ReturnType<GraphQLRequestListener["didResolveSource"]>,
      Parameters<GraphQLRequestListener["didResolveSource"]>
    >;

    let cache: KeyValueCache;

    const createApqApp = (apqOptions: PersistedQueryOptions = {}): ReturnType<typeof createApp> =>
      createApp({
        schema,
        plugins: [
          {
            requestDidStart() {
              return {
                didResolveSource,
                didEncounterErrors
              };
            }
          }
        ],
        persistedQueries: {
          cache,
          ...apqOptions
        }
      });

    beforeEach(() => {
      cache = createMockCache();
      didResolveSource = jest.fn();
      didEncounterErrors = jest.fn();
    });

    it(`when ttlSeconds is set, passes ttl to the apq cache set call`, async () => {
      app = createApqApp({ ttl: 900 });

      await request(app).post(`/graphql`).send({
        extensions,
        query
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^apq:/),
        query,
        expect.objectContaining({
          ttl: 900
        })
      );
      expect(didResolveSource.mock.calls[0][0]).toHaveProperty(`source`, query);
    });

    it(`when ttlSeconds is unset, ttl is not passed to apq cache`, async () => {
      app = createApqApp();

      await request(app).post(`/graphql`).send({
        extensions,
        query
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^apq:/),
        `{testString}`,
        expect.not.objectContaining({
          ttl: 900
        })
      );
      expect(didResolveSource.mock.calls[0][0]).toHaveProperty(`source`, query);
    });

    it(`errors when version is not specified`, async () => {
      app = createApqApp();

      const result = await request(app)
        .get(`/graphql`)
        .query({
          query,
          extensions: JSON.stringify({
            persistedQuery: {
              // Version intentionally omitted.
              sha256Hash: extensions.persistedQuery.sha256Hash
            }
          })
        });

      expect(result).toMatchObject({
        status: 400,
        // Different integrations' response text varies in format.
        text: expect.stringContaining(`Unsupported persisted query version`),
        req: expect.objectContaining({
          method: `GET`
        })
      });

      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: `Unsupported persisted query version`
            })
          ])
        })
      );
    });

    it(`errors when version is unsupported`, async () => {
      app = createApqApp();

      const result = await request(app)
        .get(`/graphql`)
        .query({
          query,
          extensions: JSON.stringify({
            persistedQuery: {
              // Version intentionally wrong.
              version: VERSION + 1,
              sha256Hash: extensions.persistedQuery.sha256Hash
            }
          })
        });

      expect(result).toMatchObject({
        status: 400,
        // Different integrations' response text varies in format.
        text: expect.stringContaining(`Unsupported persisted query version`),
        req: expect.objectContaining({
          method: `GET`
        })
      });

      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: `Unsupported persisted query version`
            })
          ])
        })
      );
    });

    it(`errors when hash is mismatched`, async () => {
      app = createApqApp();

      const result = await request(app)
        .get(`/graphql`)
        .query({
          query,
          extensions: JSON.stringify({
            persistedQuery: {
              version: 1,
              // Sha intentionally wrong.
              sha256Hash: extensions.persistedQuery.sha256Hash.substr(0, 5)
            }
          })
        });

      expect(result).toMatchObject({
        status: 400,
        // Different integrations' response text varies in format.
        text: expect.stringContaining(`provided sha does not match query`),
        req: expect.objectContaining({
          method: `GET`
        })
      });

      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: `provided sha does not match query`
            })
          ])
        })
      );

      expect(didResolveSource).not.toHaveBeenCalled();
    });

    it(`returns PersistedQueryNotFound on the first try`, async () => {
      app = createApqApp();

      const res = await request(app).post(`/graphql`).send({
        extensions
      });

      expect(res.body.data).toBeUndefined();
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toStrictEqual(`PersistedQueryNotFound`);
      expect(res.body.errors[0].extensions.code).toStrictEqual(`PERSISTED_QUERY_NOT_FOUND`);

      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([expect.any(PersistedQueryNotFoundError)])
        })
      );

      expect(didResolveSource).not.toHaveBeenCalled();
    });

    it(`returns result on the second try`, async () => {
      app = createApqApp();

      await request(app).post(`/graphql`).send({
        extensions
      });

      // Only the first request should result in an error.
      expect(didEncounterErrors).toHaveBeenCalledTimes(1);
      expect(didEncounterErrors).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([expect.any(PersistedQueryNotFoundError)])
        })
      );

      expect(didResolveSource).not.toHaveBeenCalled();

      const result = await request(app).post(`/graphql`).send({
        extensions,
        query
      });

      // There should be no additional errors now.  In other words, we'll
      // re-assert that we've been called the same single time that we
      // asserted above.
      expect(didEncounterErrors).toHaveBeenCalledTimes(1);

      expect(didResolveSource.mock.calls[0][0]).toHaveProperty(`source`, query);

      expect(result.body.data).toStrictEqual({ testString: `it works` });
      expect(result.body.errors).toBeUndefined();
    });

    it(`returns with batched persisted queries`, async () => {
      app = createApqApp();

      const errors = await request(app)
        .post(`/graphql`)
        .send([
          {
            extensions
          },
          {
            extensions: extensions2
          }
        ]);

      expect(errors.body[0].data).toBeUndefined();
      expect(errors.body[1].data).toBeUndefined();
      expect(errors.body[0].errors[0].message).toStrictEqual(`PersistedQueryNotFound`);
      expect(errors.body[0].errors[0].extensions.code).toStrictEqual(`PERSISTED_QUERY_NOT_FOUND`);
      expect(errors.body[1].errors[0].message).toStrictEqual(`PersistedQueryNotFound`);
      expect(errors.body[1].errors[0].extensions.code).toStrictEqual(`PERSISTED_QUERY_NOT_FOUND`);

      const result = await request(app)
        .post(`/graphql`)
        .send([
          {
            extensions,
            query
          },
          {
            extensions: extensions2,
            query: query2
          }
        ]);

      expect(result.body[0].data).toStrictEqual({ testString: `it works` });
      expect(result.body[0].data).toStrictEqual({ testString: `it works` });
      expect(result.body.errors).toBeUndefined();
    });

    it(`returns result on the persisted query`, async () => {
      app = createApqApp();

      await request(app).post(`/graphql`).send({
        extensions
      });

      expect(didResolveSource).not.toHaveBeenCalled();

      await request(app).post(`/graphql`).send({
        extensions,
        query
      });
      const res = await request(app).post(`/graphql`).send({
        extensions
      });

      expect(didResolveSource.mock.calls[0][0]).toHaveProperty(`source`, query);

      expect(res.body.data).toStrictEqual({ testString: `it works` });
      expect(res.body.errors).toBeUndefined();
    });

    it(`returns error when hash does not match`, async () => {
      app = createApqApp();

      const res = await request(app)
        .post(`/graphql`)
        .send({
          extensions: {
            persistedQuery: {
              version: VERSION,
              sha: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
            }
          },
          query
        });
      expect(res.status).toStrictEqual(400);
      expect((res.error as HTTPError).text).toMatch(/does not match query/);
      expect(didResolveSource).not.toHaveBeenCalled();
    });

    it(`returns correct result using get request`, async () => {
      app = createApqApp();

      await request(app).post(`/graphql`).send({
        extensions,
        query
      });
      const result = await request(app)
        .get(`/graphql`)
        .query({
          extensions: JSON.stringify(extensions)
        });
      expect(result.body.data).toStrictEqual({ testString: `it works` });
      expect(didResolveSource.mock.calls[0][0]).toHaveProperty(`source`, query);
    });
  });
});
