import { ApolloServerBase, GraphQLOptions } from "apollo-server-core"
import {
  renderPlaygroundPage,
  RenderPageOptions as PlaygroundRenderPageOptions
} from "@apollographql/graphql-playground-html"
import { NowRequest, NowResponse } from "@now/node"
import { graphqlNow } from "./nowApollo"
import { setHeaders } from "./setHeaders"

export interface CreateHandlerOptions {
  cors?: {
    origin?: boolean | string | string[]
    methods?: string | string[]
    allowedHeaders?: string | string[]
    exposedHeaders?: string | string[]
    credentials?: boolean
    maxAge?: number
  }
  onHealthCheck?: (req: NowRequest) => Promise<any>
}

export class ApolloServer extends ApolloServerBase {
  createGraphQLServerOptions(
    req: NowRequest,
    res: NowResponse
  ): Promise<GraphQLOptions> {
    return super.graphQLServerOptions({ req, res })
  }

  public createHandler({ cors, onHealthCheck }: CreateHandlerOptions = {}) {
    const corsHeaders = new Headers()

    if (cors) {
      if (cors.methods) {
        if (typeof cors.methods === `string`) {
          corsHeaders.set(`access-control-allow-methods`, cors.methods)
        } else if (Array.isArray(cors.methods)) {
          corsHeaders.set(
            `access-control-allow-methods`,
            cors.methods.join(`,`)
          )
        }
      }

      if (cors.allowedHeaders) {
        if (typeof cors.allowedHeaders === `string`) {
          corsHeaders.set(`access-control-allow-headers`, cors.allowedHeaders)
        } else if (Array.isArray(cors.allowedHeaders)) {
          corsHeaders.set(
            `access-control-allow-headers`,
            cors.allowedHeaders.join(`,`)
          )
        }
      }

      if (cors.exposedHeaders) {
        if (typeof cors.exposedHeaders === `string`) {
          corsHeaders.set(`access-control-expose-headers`, cors.exposedHeaders)
        } else if (Array.isArray(cors.exposedHeaders)) {
          corsHeaders.set(
            `access-control-expose-headers`,
            cors.exposedHeaders.join(`,`)
          )
        }
      }

      if (cors.credentials) {
        corsHeaders.set(`access-control-allow-credentials`, `true`)
      }
      if (typeof cors.maxAge === `number`) {
        corsHeaders.set(`access-control-max-age`, cors.maxAge.toString())
      }
    }

    return async (req: NowRequest, res: NowResponse) => {
      const requestCorsHeaders = new Headers(corsHeaders)

      if (cors && cors.origin) {
        const requestOrigin = req.headers.origin
        if (typeof cors.origin === `string`) {
          requestCorsHeaders.set(`access-control-allow-origin`, cors.origin)
        } else if (
          requestOrigin &&
          (typeof cors.origin === `boolean` ||
            (Array.isArray(cors.origin) &&
              requestOrigin &&
              cors.origin.includes(requestOrigin as string)))
        ) {
          requestCorsHeaders.set(
            `access-control-allow-origin`,
            requestOrigin as string
          )
        }

        const requestAccessControlRequestHeaders =
          req.headers[`access-control-request-headers`]
        if (!cors.allowedHeaders && requestAccessControlRequestHeaders) {
          requestCorsHeaders.set(
            `access-control-allow-headers`,
            requestAccessControlRequestHeaders as string
          )
        }
      }

      const requestCorsHeadersObject = Object.fromEntries(
        requestCorsHeaders.entries()
      )

      if (req.method === `OPTIONS`) {
        setHeaders(res, requestCorsHeadersObject)
        res.statusCode = 204
        res.send(``)
      }

      if (req.url === `/.well-known/apollo/server-health`) {
        const successfulResponse = () => {
          setHeaders(res, {
            "Content-Type": `application/json`,
            ...requestCorsHeadersObject
          })
          res.statusCode = 200
          res.send({ status: `pass` })
        }
        if (onHealthCheck) {
          try {
            await onHealthCheck(req)
            successfulResponse()
          } catch {
            setHeaders(res, {
              "Content-Type": `application/json`,
              ...requestCorsHeadersObject
            })
            res.statusCode = 503
            res.send({ status: `fail` })
          }
        } else {
          successfulResponse()
        }
      }

      if (this.playgroundOptions && req.method === `GET`) {
        const acceptHeader = req.headers.Accept || req.headers.accept
        if (acceptHeader && acceptHeader.includes(`text/html`)) {
          const path = req.url || `/`

          const playgroundRenderPageOptions: PlaygroundRenderPageOptions = {
            endpoint: path,
            ...this.playgroundOptions
          }

          setHeaders(res, {
            "Content-Type": `text/html`,
            ...requestCorsHeadersObject
          })
          res.statusCode = 200
          res.send(renderPlaygroundPage(playgroundRenderPageOptions))
        }
      }

      graphqlNow(() => this.createGraphQLServerOptions(req, res))
    }
  }
}
