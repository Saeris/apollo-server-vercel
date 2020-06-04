import {
  GraphQLOptions,
  HttpQueryError,
  runHttpQuery,
  convertNodeHttpToRequest
} from "apollo-server-core"
import { ValueOrPromise } from "apollo-server-types"
import { NowRequest, NowResponse } from "@vercel/node"
import { setHeaders } from "./setHeaders"

type NowApiHandler = (req: NowRequest, res: NowResponse) => void

export interface NowGraphQLOptionsFunction {
  (req?: NowRequest): ValueOrPromise<GraphQLOptions>
}

export function graphqlVercel(
  options: GraphQLOptions | NowGraphQLOptionsFunction
): NowApiHandler {
  if (!options) throw new Error(`Apollo Server requires options.`)

  if (arguments.length > 1) {
    throw new Error(
      `Apollo Server expects exactly one argument, got ${arguments.length}`
    )
  }

  const graphqlHandler = async (req: NowRequest, res: NowResponse) => {
    try {
      const { graphqlResponse, responseInit } = await runHttpQuery([req, res], {
        method: req.method as string,
        options,
        query: req.method === `POST` ? req.body : req.query,
        request: convertNodeHttpToRequest(req)
      })
      setHeaders(res, responseInit.headers ?? {})
      res.statusCode = 200
      res.send(graphqlResponse)
    } catch (error) {
      const err: HttpQueryError = error
      if (err.headers) setHeaders(res, err.headers)
      res.statusCode = err.statusCode
      res.send(err.message)
    }
  }

  return graphqlHandler
}
