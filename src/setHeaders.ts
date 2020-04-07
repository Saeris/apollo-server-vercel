import { NowResponse } from "@now/node"

export const setHeaders = (
  res: NowResponse,
  headers: Record<string, any>
): void => {
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value)
  }
}
