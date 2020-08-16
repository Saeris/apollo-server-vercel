import { IncomingHttpHeaders } from "http";
import { Readable } from "stream";
import {
  ApolloServerBase,
  GraphQLOptions,
  formatApolloErrors,
  processFileUploads,
  FileUploadOptions
} from "apollo-server-core";
import {
  renderPlaygroundPage,
  RenderPageOptions as PlaygroundRenderPageOptions
} from "@apollographql/graphql-playground-html";
import { NowRequest, NowResponse } from "@vercel/node";
import { graphqlVercel } from "./vercelApollo";
import { setHeaders } from "./setHeaders";

export interface CreateHandlerOptions {
  cors?: {
    origin?: boolean | string | string[];
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
  };
  uploadsConfig?: FileUploadOptions;
  onHealthCheck?: (req: NowRequest) => Promise<any>;
}

export class FileUploadRequest extends Readable {
  headers!: IncomingHttpHeaders;
}

export class ApolloServer extends ApolloServerBase {
  createGraphQLServerOptions(req: NowRequest, res: NowResponse): Promise<GraphQLOptions> {
    return super.graphQLServerOptions({ req, res });
  }

  protected supportsUploads(): boolean {
    return true;
  }

  public createHandler({ cors, onHealthCheck }: CreateHandlerOptions = {}) {
    const promiseWillStart = this.willStart();
    const corsHeaders = new Headers();

    if (cors) {
      if (cors.methods) {
        if (typeof cors.methods === `string`) {
          corsHeaders.set(`access-control-allow-methods`, cors.methods);
        } else if (Array.isArray(cors.methods)) {
          corsHeaders.set(`access-control-allow-methods`, cors.methods.join(`,`));
        }
      }

      if (cors.allowedHeaders) {
        if (typeof cors.allowedHeaders === `string`) {
          corsHeaders.set(`access-control-allow-headers`, cors.allowedHeaders);
        } else if (Array.isArray(cors.allowedHeaders)) {
          corsHeaders.set(`access-control-allow-headers`, cors.allowedHeaders.join(`,`));
        }
      }

      if (cors.exposedHeaders) {
        if (typeof cors.exposedHeaders === `string`) {
          corsHeaders.set(`access-control-expose-headers`, cors.exposedHeaders);
        } else if (Array.isArray(cors.exposedHeaders)) {
          corsHeaders.set(`access-control-expose-headers`, cors.exposedHeaders.join(`,`));
        }
      }

      if (cors.credentials) {
        corsHeaders.set(`access-control-allow-credentials`, `true`);
      }
      if (typeof cors.maxAge === `number`) {
        corsHeaders.set(`access-control-max-age`, cors.maxAge.toString());
      }
    }

    return async (req: NowRequest, res: NowResponse) => {
      const requestCorsHeaders = new Headers(corsHeaders);

      if (cors && cors.origin) {
        const requestOrigin = req.headers.origin;
        if (typeof cors.origin === `string`) {
          requestCorsHeaders.set(`access-control-allow-origin`, cors.origin);
        } else if (
          requestOrigin &&
          (typeof cors.origin === `boolean` ||
            (Array.isArray(cors.origin) && requestOrigin && cors.origin.includes(requestOrigin as string)))
        ) {
          requestCorsHeaders.set(`access-control-allow-origin`, requestOrigin as string);
        }

        const requestAccessControlRequestHeaders = req.headers[`access-control-request-headers`];
        if (!cors.allowedHeaders && requestAccessControlRequestHeaders) {
          requestCorsHeaders.set(`access-control-allow-headers`, requestAccessControlRequestHeaders as string);
        }
      }

      const requestCorsHeadersObject = Array.from(requestCorsHeaders).reduce<Record<string, string>>(
        (headersObject, [key, value]) => {
          headersObject[key] = value;
          return headersObject;
        },
        {}
      );

      if (req.method === `OPTIONS`) {
        setHeaders(res, requestCorsHeadersObject);
        return res.status(204).send(``);
      }

      if (req.url === `/.well-known/apollo/server-health`) {
        const successfulResponse = () => {
          setHeaders(res, {
            "Content-Type": `application/json`,
            ...requestCorsHeadersObject
          });
          return res.status(200).json({ status: `pass` });
        };
        if (onHealthCheck) {
          try {
            await onHealthCheck(req);
            successfulResponse();
          } catch {
            setHeaders(res, {
              "Content-Type": `application/json`,
              ...requestCorsHeadersObject
            });
            return res.status(503).json({ status: `fail` });
          }
        } else {
          return successfulResponse();
        }
      }

      if (this.playgroundOptions && req.method === `GET`) {
        const acceptHeader = req.headers.Accept || req.headers.accept;
        if (acceptHeader && acceptHeader.includes(`text/html`)) {
          const path = req.url || `/`;
          const playgroundRenderPageOptions: PlaygroundRenderPageOptions = {
            endpoint: path,
            ...this.playgroundOptions
          };

          setHeaders(res, {
            "Content-Type": `text/html`,
            ...requestCorsHeadersObject
          });
          return res.status(200).send(renderPlaygroundPage(playgroundRenderPageOptions));
        }
      }

      const fileUploadHandler = async (next: Function) => {
        const contentType = req.headers[`content-type`] || req.headers[`Content-Type`];
        if (
          contentType &&
          (contentType as string).startsWith(`multipart/form-data`) &&
          typeof processFileUploads === `function`
        ) {
          try {
            req.body = await processFileUploads(req, res, this.uploadsConfig || {});
            return next();
          } catch (error) {
            throw formatApolloErrors([error], {
              formatter: this.requestOptions.formatError,
              debug: this.requestOptions.debug
            });
          }
        } else {
          return next();
        }
      };

      fileUploadHandler(() =>
        graphqlVercel(async () => {
          await promiseWillStart;
          return this.createGraphQLServerOptions(req, res);
        })(req, res)
      );
    };
  }
}
