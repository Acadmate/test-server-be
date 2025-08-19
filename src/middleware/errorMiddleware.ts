import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const notFound = (c: Context) => {
  throw new HTTPException(404, { message: `Not Found - ${c.req.url}` });
};

export const errorHandler = (err: Error, c: Context) => {
  console.error('Error occurred:', err);
  
  if (err instanceof HTTPException) {
    return c.json({
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    }, err.status);
  }

  return c.json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  }, 500);
};
