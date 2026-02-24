import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRouteHandler<Req extends Request = Request> = (req: Req, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler<Req extends Request = Request>(handler: AsyncRouteHandler<Req>): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
