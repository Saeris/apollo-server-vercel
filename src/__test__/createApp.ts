import { createServer } from "vercel-node-server";
import { send } from "micro";
import type { Config } from "apollo-server-core";
import { ApolloServer } from "../ApolloServer";
import { schema } from "./schema";

export const createApp = (options?: Config): ReturnType<typeof createServer> => {
  const server = new ApolloServer(options ?? { schema });
  const handler = server.createHandler();
  return createServer((req, res) => {
    // Vercel has Filesystem base routing, so it handles 404's for us
    if (req.url.includes(`/bogus-route`)) {
      void send(res, 404);
    } else {
      handler(req, res);
    }
  });
};

export const createCORSApp = (options?: Config): ReturnType<typeof createServer> => {
  const server = new ApolloServer(options ?? { schema });
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
    if (req.url.includes(`/bogus-route`)) {
      void send(res, 404);
    } else {
      handler(req, res);
    }
  });
};
