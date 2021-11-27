import { ApolloServerBase, formatApolloErrors, processFileUploads } from "apollo-server-core";
import type { GraphQLOptions, FileUploadOptions } from "apollo-server-core";
import { renderPlaygroundPage } from "@apollographql/graphql-playground-html";
import type { RenderPageOptions as PlaygroundRenderPageOptions } from "@apollographql/graphql-playground-html";
import type { VercelApiHandler, VercelRequest, VercelResponse } from "@vercel/node";
import { setHeaders } from "./setHeaders";
import { graphqlVercel } from "./vercelApollo";

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
  onHealthCheck?: (req: VercelRequest) => Promise<void>;
}

export class ApolloServer extends ApolloServerBase {
  async createGraphQLServerOptions(req: VercelRequest, res: VercelResponse): Promise<GraphQLOptions> {
    return super.graphQLServerOptions({ req, res });
  }

  protected supportsUploads(): boolean {
    return true;
  }

  public createHandler({ cors, onHealthCheck }: CreateHandlerOptions = {}): VercelApiHandler {
    const corsHeaders = new Map();

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

    return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
      const willStart = this.willStart();
      const requestCorsHeaders = new Map(corsHeaders);

      if (cors?.origin) {
        const requestOrigin = req.headers.origin;
        if (typeof cors.origin === `string`) {
          requestCorsHeaders.set(`access-control-allow-origin`, cors.origin);
        } else if (
          requestOrigin &&
          (typeof cors.origin === `boolean` ||
            (Array.isArray(cors.origin) && requestOrigin && cors.origin.includes(requestOrigin)))
        ) {
          requestCorsHeaders.set(`access-control-allow-origin`, requestOrigin);
        }

        const requestAccessControlRequestHeaders = req.headers[`access-control-request-headers`];
        if (!cors.allowedHeaders && requestAccessControlRequestHeaders) {
          requestCorsHeaders.set(`access-control-allow-headers`, requestAccessControlRequestHeaders);
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
        res.status(204).send(``);
        return;
      }

      if (req.url === `/.well-known/apollo/server-health`) {
        const successfulResponse = (): VercelResponse => {
          setHeaders(res, {
            "Content-Type": `application/json`,
            ...requestCorsHeadersObject
          });
          return res.status(200).json({ status: `pass` });
        };
        if (onHealthCheck) {
          try {
            void onHealthCheck(req);
            successfulResponse();
          } catch {
            setHeaders(res, {
              "Content-Type": `application/json`,
              ...requestCorsHeadersObject
            });
            res.status(503).json({ status: `fail` });
            return;
          }
        } else {
          successfulResponse();
          return;
        }
      }

      if (this.playgroundOptions && req.method === `GET`) {
        const acceptHeader = req.headers.Accept ?? req.headers.accept;
        if (acceptHeader?.includes(`text/html`)) {
          const path = req.url ?? `/`;
          const playgroundRenderPageOptions: PlaygroundRenderPageOptions = {
            endpoint: path,
            ...this.playgroundOptions
          };

          setHeaders(res, {
            "Content-Type": `text/html`,
            ...requestCorsHeadersObject
          });
          res.status(200).send(renderPlaygroundPage(playgroundRenderPageOptions));
          return;
        }
      }

      type NextFunction = () => Promise<void>;

      const fileUploadHandler = async (next: NextFunction): Promise<void> => {
        const contentType = req.headers[`content-type`] ?? req.headers[`Content-Type`];
        if (
          contentType &&
          (contentType as string).startsWith(`multipart/form-data`) &&
          typeof processFileUploads === `function`
        ) {
          try {
            // eslint-disable-next-line require-atomic-updates
            req.body = await processFileUploads(req, res, this.uploadsConfig ?? {});
            await next();
          } catch (error: unknown) {
            if (error instanceof Error) {
              // eslint-disable-next-line @typescript-eslint/no-throw-literal
              throw formatApolloErrors([error], {
                formatter: this.requestOptions.formatError,
                debug: this.requestOptions.debug
              });
            }
          }
        } else {
          await next();
        }
      };

      const handleGraphQLRequest = async (): Promise<void> => {
        await willStart;
        if (cors) {
          setHeaders(res, {
            ...requestCorsHeadersObject
          });
        }
        const options = await this.createGraphQLServerOptions(req, res);
        graphqlVercel(options)(req, res);
      };

      await fileUploadHandler(handleGraphQLRequest);
    };
  }
}
