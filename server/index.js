import next from "next";
import Koa from "koa";
import favicon from "koa-favicon";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import cors from "kcors";
import mount from "koa-mount";
import serve from "koa-static";
import session from "koa-session";
import logger from "koa-bunyan-logger";
import path from "path";
import { parse as parseUrl } from "url";

import api from "./routers/api";

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();

  const server = new Koa();
  const router = new Router();

  router.use(api.routes(), api.allowedMethods());
  router.get("*", async ctx => {
    await handle(ctx.req, ctx.res);
    ctx.respond = false;
  });

  server.use(cors());
  server.use(logger());
  server.use(bodyParser());
  server.use(mount("/assets", serve("./assets", { maxage: 360000 })));
  server.use(favicon(path.resolve("./assets/favicon.ico")));

  server.use(async (ctx, next) => {
    ctx.res.statusCode = 200;
    try {
      await next();
    } catch (err) {
      ctx.log.error("Unhandled Exception", err);
      const parsedUrl = parseUrl(ctx.req.url, true);
      const { pathname, query } = parsedUrl;
      const html = await app.renderErrorToHTML(
        err,
        ctx.req,
        ctx.res,
        pathname,
        query
      );
      ctx.body = html;
      ctx.status = err.status || 500;
    }
  });

  server.keys = [process.env.SECRET_KEY];
  server.use(
    session(
      {
        httpOnly: false,
        rolling: true
      },
      server
    )
  );
  server.use(router.routes());
  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}

main();
