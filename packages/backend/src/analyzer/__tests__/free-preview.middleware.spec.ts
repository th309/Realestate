import { FreePreviewMiddleware } from '../free-preview.middleware';

process.env.ANALYZER_PREVIEW_SECRET =
  'test-secret-only-for-tests-do-not-use-anywhere-else';

function makeCtx(cookieVal?: string, authed = false) {
  const req: any = {
    cookies: cookieVal ? { piq_analyzer_uses: cookieVal } : {},
    user: authed ? { id: 'u1' } : undefined,
  };
  const setCookie = jest.fn();
  const res: any = {
    cookie: setCookie,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next, setCookie };
}

describe('FreePreviewMiddleware', () => {
  it('first anonymous use: sets cookie to signed "1", calls next', () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx();
    m.use(req, res, next);
    expect(setCookie).toHaveBeenCalledWith(
      'piq_analyzer_uses',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(next).toHaveBeenCalled();
  });

  it('fourth anonymous use: 402 quota exceeded', () => {
    const m = new FreePreviewMiddleware();
    const initial = m.sign(3);
    const { req, res, next } = makeCtx(initial);
    m.use(req, res, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticated user bypasses', () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx(m.sign(3), true);
    m.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it('tampered cookie is rejected, counter resets to 1', () => {
    const m = new FreePreviewMiddleware();
    const { req, res, next, setCookie } = makeCtx('not-a-valid-signed-value');
    m.use(req, res, next);
    expect(setCookie).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
