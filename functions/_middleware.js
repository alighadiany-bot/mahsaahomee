// قفل رمزی برای پیشخوان و APIهای مدیریت
// نام کاربری: admin    رمز: متغیر محیطی ADMIN_PASSWORD

const PROTECTED = (p) => p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin') || p === '/api/export';

const unauthorized = () =>
  new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Mahsa Home Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });

function safeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const path = new URL(request.url).pathname;
  if (!PROTECTED(path)) return next();

  if (!env.ADMIN_PASSWORD) return new Response('ADMIN_PASSWORD is not set', { status: 500 });

  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Basic ')) return unauthorized();
  let user = '', pass = '';
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(auth.slice(6)), (c) => c.charCodeAt(0)));
    const i = decoded.indexOf(':');
    user = decoded.slice(0, i);
    pass = decoded.slice(i + 1);
  } catch {
    return unauthorized();
  }
  if (user !== 'admin' || !safeEqual(pass, env.ADMIN_PASSWORD)) return unauthorized();

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
