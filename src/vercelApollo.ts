import type { GraphQLOptions, HttpQueryError } from "apollo-server-core";
import { runHttpQuery, convertNodeHttpToRequest } from "apollo-server-core";
import type { VercelApiHandler, VercelRequest } from "@vercel/node";
import { setHeaders } from "./setHeaders";

export type VercelGraphQLOptionsFunction = (req?: VercelRequest) => GraphQLOptions | Promise<GraphQLOptions>;

export function graphqlVercel(options: GraphQLOptions | VercelGraphQLOptionsFunction): VercelApiHandler {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!options) throw new Error(`Apollo Server requires options.`);

  if (arguments.length > 1) {
    throw new Error(`Apollo Server expects exactly one argument, got ${arguments.length}`);
  }

  const graphqlHandler: VercelApiHandler = async (req, res) => {
    if (req.method === `POST` && !req.body) {
      res.status(500).send(`POST body missing.`);
      return;
    }

    try {
      const { graphqlResponse, responseInit } = await runHttpQuery([req, res], {
        method: req.method!,
        options,
        query: req.body || req.query,
        request: convertNodeHttpToRequest(req)
      });
      setHeaders(res, responseInit.headers ?? {});
      res.status(200).send(graphqlResponse);
    } catch (error: unknown) {
      const { headers, statusCode, message } = error as HttpQueryError;
      setHeaders(res, headers ?? {});
      res.status(statusCode).send(message);
    }
  };

  return graphqlHandler;
}
