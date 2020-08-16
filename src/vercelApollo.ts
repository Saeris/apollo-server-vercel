import { GraphQLOptions, HttpQueryError, runHttpQuery, convertNodeHttpToRequest } from "apollo-server-core";
import { ValueOrPromise } from "apollo-server-types";
import { NowRequest, NowResponse } from "@vercel/node";
import { setHeaders } from "./setHeaders";

type NowApiHandler = (req: NowRequest, res: NowResponse) => void;

export interface NowGraphQLOptionsFunction {
  (req?: NowRequest): ValueOrPromise<GraphQLOptions>;
}

export function graphqlVercel(options: GraphQLOptions | NowGraphQLOptionsFunction): NowApiHandler {
  if (!options) throw new Error(`Apollo Server requires options.`);

  if (arguments.length > 1) {
    throw new Error(`Apollo Server expects exactly one argument, got ${arguments.length}`);
  }

  const graphqlHandler = async (req: NowRequest, res: NowResponse) => {
    if (req.method === `POST` && !req.body) {
      return res.status(500).send(`POST body missing.`);
    }

    try {
      const { graphqlResponse, responseInit } = await runHttpQuery([req, res], {
        method: req.method as string,
        options,
        query: req?.body || req.query,
        request: convertNodeHttpToRequest(req)
      });
      setHeaders(res, responseInit.headers ?? {});
      return res.status(200).json(graphqlResponse);
    } catch (error) {
      const { headers, statusCode, message }: HttpQueryError = error;
      setHeaders(res, headers ?? {});
      return res.status(statusCode).send(message);
    }
  };

  return graphqlHandler;
}
