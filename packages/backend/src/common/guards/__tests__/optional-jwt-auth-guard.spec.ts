import { OptionalJwtAuthGuard } from '../optional-jwt-auth.guard';

function ctxWith(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; userId?: string } = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  } as never as {
    switchToHttp: () => { getRequest: () => typeof req };
    _req: typeof req;
  };
}

function makeGuard(getUser: jest.Mock) {
  const supabaseService = { getClient: () => ({ auth: { getUser } }) };
  return new OptionalJwtAuthGuard(supabaseService as never);
}

describe('OptionalJwtAuthGuard', () => {
  it('allows anonymous (no header) and leaves userId unset', async () => {
    const getUser = jest.fn();
    const guard = makeGuard(getUser);
    const ctx = ctxWith({});
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBeUndefined();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('sets userId for a valid Bearer token', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const guard = makeGuard(getUser);
    const ctx = ctxWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBe('u1');
  });

  it('allows through (anon) when the token is invalid — never throws', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const guard = makeGuard(getUser);
    const ctx = ctxWith({ authorization: 'Bearer bad' });
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx._req.userId).toBeUndefined();
  });
});
