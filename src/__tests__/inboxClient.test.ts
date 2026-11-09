import {
  deleteInboxItem,
  deleteInboxItems,
  describeInboxError,
  fetchInbox,
  InboxError,
  isValidInboxUrl,
  resolveInboxUrl,
} from '@/lib/inbox';

const URL = 'https://abc.mockapi.io/api/v1/inbox';

const response = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError('no json')) : Promise.resolve(body)),
  }) as Response;

describe('resolveInboxUrl', () => {
  it('prefers the URL entered in the app', () => {
    expect(resolveInboxUrl({ inboxUrl: ' https://mine.test/inbox ' }, 'https://build.test/inbox')).toBe('https://mine.test/inbox');
  });

  it('falls back to the build-time URL', () => {
    expect(resolveInboxUrl({ inboxUrl: '' }, 'https://build.test/inbox')).toBe('https://build.test/inbox');
  });

  it('is null when neither is set', () => {
    expect(resolveInboxUrl({ inboxUrl: '  ' }, '')).toBeNull();
  });
});

describe('isValidInboxUrl', () => {
  it.each(['', '  ', URL, 'https://abc.mockapi.io/inbox/'])('accepts %p', (u) => expect(isValidInboxUrl(u)).toBe(true));
  it.each(['http://abc.mockapi.io/inbox', 'abc.mockapi.io/inbox', 'https://', 'https://nodot/inbox', 'https://a b.io'])(
    'rejects %p',
    (u) => expect(isValidInboxUrl(u)).toBe(false),
  );
});

describe('fetchInbox', () => {
  it('returns the records', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, [{ id: '1', phrase: 'a', meaning: 'b' }, { foo: 1 }]));
    await expect(fetchInbox(URL, { fetchImpl })).resolves.toEqual([{ id: '1', phrase: 'a', meaning: 'b' }]);
    expect(fetchImpl).toHaveBeenCalledWith(URL, expect.objectContaining({ method: 'GET' }));
  });

  it('reports HTTP errors with the status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(500, {}));
    await expect(fetchInbox(URL, { fetchImpl })).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  it('reports a non-array or non-JSON body as invalid', async () => {
    await expect(fetchInbox(URL, { fetchImpl: jest.fn().mockResolvedValue(response(200, { a: 1 })) })).rejects.toMatchObject({
      kind: 'invalid',
    });
    await expect(fetchInbox(URL, { fetchImpl: jest.fn().mockResolvedValue(response(200)) })).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('reports network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(fetchInbox(URL, { fetchImpl })).rejects.toMatchObject({ kind: 'network' });
  });

  it('aborts and reports a timeout', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    await expect(fetchInbox(URL, { fetchImpl, timeoutMs: 5 })).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('deleteInboxItem', () => {
  it('DELETEs the record URL, tolerating a trailing slash', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, {}));
    await deleteInboxItem(`${URL}/`, '12', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(`${URL}/12`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('treats 404 as already deleted', async () => {
    await expect(deleteInboxItem(URL, '1', { fetchImpl: jest.fn().mockResolvedValue(response(404)) })).resolves.toBeUndefined();
  });

  it('throws on other HTTP errors', async () => {
    await expect(deleteInboxItem(URL, '1', { fetchImpl: jest.fn().mockResolvedValue(response(500)) })).rejects.toBeInstanceOf(
      InboxError,
    );
  });
});

describe('deleteInboxItems', () => {
  it('continues past failures and reports them', async () => {
    const fetchImpl = jest.fn((url: string) =>
      Promise.resolve(response(url.endsWith('/2') ? 500 : url.endsWith('/3') ? 404 : 200, {})),
    ) as unknown as typeof fetch;
    await expect(deleteInboxItems(URL, ['1', '2', '3'], { fetchImpl })).resolves.toEqual({ deleted: 2, failed: ['2'] });
  });
});

describe('describeInboxError', () => {
  it('gives a message per kind', () => {
    expect(describeInboxError(new InboxError('timeout', ''))).toBe('Không kết nối được hộp thư.');
    expect(describeInboxError(new InboxError('http', '', 503))).toBe('Hộp thư trả về lỗi 503.');
    expect(describeInboxError(new InboxError('invalid', ''))).toBe('Dữ liệu hộp thư không hợp lệ.');
    expect(describeInboxError(new Error('x'))).toBe('Có lỗi khi đọc hộp thư.');
  });
});
