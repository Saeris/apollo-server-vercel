import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLScalarType
} from "graphql";

const QueryRootType = new GraphQLObjectType({
  name: `QueryRoot`,
  fields: {
    test: {
      type: GraphQLString,
      args: {
        who: {
          type: GraphQLString
        }
      },
      resolve: (_, args): string => `Hello ${String(args.who) || `World`}`
    },
    thrower: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (): void => {
        throw new Error(`Throws!`);
      }
    },
    custom: {
      type: GraphQLString,
      args: {
        foo: {
          type: new GraphQLScalarType({
            name: `Foo`,
            serialize: <T>(v: T): T => v,
            parseValue: (): void => {
              throw new Error(`Something bad happened`);
            },
            parseLiteral: (): void => {
              throw new Error(`Something bad happened`);
            }
          })
        }
      }
    },
    context: {
      type: GraphQLString,
      resolve: (_obj, _args, context): typeof context => context
    }
  }
});

export const TestSchema = new GraphQLSchema({
  query: QueryRootType,
  mutation: new GraphQLObjectType({
    name: `MutationRoot`,
    fields: {
      writeTest: {
        type: QueryRootType,
        resolve: (): {} => ({})
      }
    }
  })
});

const personType = new GraphQLObjectType({
  name: `PersonType`,
  fields: {
    firstName: {
      type: GraphQLString
    },
    lastName: {
      type: GraphQLString
    }
  }
});

const queryType = new GraphQLObjectType({
  name: `QueryType`,
  fields: {
    testString: {
      type: GraphQLString,
      resolve(): string {
        return `it works`;
      }
    },
    testPerson: {
      type: personType,
      resolve(): { firstName: string; lastName: string } {
        return { firstName: `Jane`, lastName: `Doe` };
      }
    },
    testStringWithDelay: {
      type: GraphQLString,
      args: {
        delay: { type: new GraphQLNonNull(GraphQLInt) }
      },
      async resolve(_, args): Promise<string> {
        return new Promise((resolve) => {
          setTimeout(() => resolve(`it works`), args.delay);
        });
      }
    },
    testContext: {
      type: GraphQLString,
      resolve(_parent, _args, context): string {
        if (context.otherField) {
          return `unexpected`;
        }
        context.otherField = true;
        return context.testField;
      }
    },
    testRootValue: {
      type: GraphQLString,
      resolve(rootValue): typeof rootValue {
        return rootValue;
      }
    },
    testArgument: {
      type: GraphQLString,
      args: { echo: { type: GraphQLString } },
      resolve(_, { echo }): string {
        return `hello ${String(echo)}`;
      }
    },
    testError: {
      type: GraphQLString,
      resolve(): void {
        throw new Error(`Secret error message`);
      }
    }
  }
});

const mutationType = new GraphQLObjectType({
  name: `MutationType`,
  fields: {
    testMutation: {
      type: GraphQLString,
      args: { echo: { type: GraphQLString } },
      resolve(_, { echo }): string {
        return `not really a mutation, but who cares: ${String(echo)}`;
      }
    },
    testPerson: {
      type: personType,
      args: {
        firstName: {
          type: new GraphQLNonNull(GraphQLString)
        },
        lastName: {
          type: new GraphQLNonNull(GraphQLString)
        }
      },
      resolve(_, args): typeof args {
        return args;
      }
    },
    testRootValue: {
      type: GraphQLString,
      resolve(rootValue): typeof rootValue {
        return rootValue;
      }
    }
  }
});

export const schema = new GraphQLSchema({
  query: queryType,
  mutation: mutationType
});
