declare global {
  namespace Express {
    interface Request {
      rawBody: string;
    }
  }
}

export {};
