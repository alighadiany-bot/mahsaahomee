// POST /api/register  ->  ذخیره درخواست ثبت‌نام در دیتابیس D1 (binding با نام DB)

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);

const normalizeDigits = (s) =>
  s
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}


const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendNotification(env, d) {
  const to = env.NOTIFY_EMAIL || 'mahmood.saeedipm@gmail.com';
  const from = env.FROM_EMAIL || 'Mahsa Home <onboarding@resend.dev>';
  const rows = [
    ['نام برند', d.brand], ['نام مسئول', d.contact_name], ['شماره تماس', d.phone],
    ['گروه محصول', d.product_group], ['پکیج موردنظر', d.package_choice],
    ['همکاری قبلی', d.prev_collab], ['حمایت از جوایز', d.prize_support],
    ['نشانی برند', d.brand_url], ['توضیحات', d.message],
  ];
  const html =
    '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9">' +
    '<h2 style="margin:0 0 12px">درخواست همکاری جدید</h2>' +
    '<table style="border-collapse:collapse;width:100%;max-width:560px">' +
    rows.map(([k, v]) =>
      '<tr><td style="border:1px solid #e5d7c6;padding:8px 12px;background:#faf3e9;width:150px"><b>' + esc(k) +
      '</b></td><td style="border:1px solid #e5d7c6;padding:8px 12px">' + (esc(v) || '—') + '</td></tr>').join('') +
    '</table></div>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: 'درخواست همکاری جدید | ' + d.brand + ' | مهسا هوم', html }),
  });
  if (!res.ok) throw new Error('resend ' + res.status + ' ' + (await res.text()).slice(0, 200));
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return json({ ok: false, error: 'db_not_bound' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }

  // honeypot: ربات‌ها این فیلد مخفی را پر می‌کنند؛ بی‌صدا موفق نشان بده
  if (body.website) return json({ ok: true });

  const d = {
    brand: clean(body.brand, 100),
    contact_name: clean(body.contact_name, 90),
    phone: normalizeDigits(clean(body.phone, 20)),
    product_group: clean(body.product_group, 80),
    package_choice: clean(body.package_choice, 120),
    prev_collab: clean(body.prev_collab, 120),
    prize_support: clean(body.prize_support, 120),
    brand_url: clean(body.brand_url, 180),
    message: clean(body.message, 1000),
  };

  if (d.brand.length < 2 || d.contact_name.length < 2) return json({ ok: false, error: 'invalid_name' }, 400);
  if (!/^[+0-9()\- ]{9,20}$/.test(d.phone)) return json({ ok: false, error: 'invalid_phone' }, 400);
  if (!d.product_group || !d.package_choice) return json({ ok: false, error: 'missing_fields' }, 400);
  if (body.consent !== true) return json({ ok: false, error: 'consent_required' }, 400);

  // محدودیت ارسال: حداکثر ۵ ثبت در ساعت از هر IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = (await sha256(ip + '|mahsa-home')).slice(0, 32);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM registrations WHERE ip_hash = ? AND created_at > datetime('now','-1 hour')"
  )
    .bind(ipHash)
    .first();
  if (recent && recent.c >= 5) return json({ ok: false, error: 'rate_limited' }, 429);

  await env.DB.prepare(
    `INSERT INTO registrations
      (brand, contact_name, phone, product_group, package_choice, prev_collab, prize_support, brand_url, message, consent, ip_hash, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`
  )
    .bind(
      d.brand, d.contact_name, d.phone, d.product_group, d.package_choice,
      d.prev_collab, d.prize_support, d.brand_url, d.message,
      ipHash, clean(request.headers.get('User-Agent'), 200)
    )
    .run();

  // ایمیل اطلاع‌رسانی؛ اگر ارسال نشود ثبت در دیتابیس تأثیری نمی‌بیند
  if (env.RESEND_API_KEY) {
    const task = sendNotification(env, d).catch((e) => console.error('email_failed', String(e)));
    if (waitUntil) waitUntil(task);
    else await task;
  }

  return json({ ok: true });
}

// هر متد دیگری مجاز نیست
export const onRequest = () => json({ ok: false, error: 'method_not_allowed' }, 405);
