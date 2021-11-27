import type { ServerResponse } from "http";

export const setHeaders = <T extends ServerResponse>(
  res: T,
  headers: Record<string, Parameters<typeof res.setHeader>[1]>
): void => {
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
};
