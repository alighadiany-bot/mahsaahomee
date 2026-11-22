// API پیشخوان (با قفل رمزی در _middleware.js)
//   GET    /api/admin/registrations           ← فهرست همه ثبت‌نام‌ها
//   PATCH  /api/admin/registrations           ← تغییر وضعیت / یادداشت   { id, status, admin_note }
//   DELETE /api/admin/registrations?id=12     ← حذف یک ثبت‌نام

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const STATUSES = ['new', 'contacted', 'confirmed', 'rejected'];

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, brand, contact_name, phone, product_group, package_choice,
            prev_collab, prize_support, brand_url, message, status, admin_note
     FROM registrations ORDER BY id DESC LIMIT 2000`
  ).all();
  return json({ ok: true, rows: results });
}

export async function onRequestPatch({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  const id = Number(b.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: 'bad_id' }, 400);
  if (!STATUSES.includes(b.status)) return json({ ok: false, error: 'bad_status' }, 400);
  const note = String(b.admin_note ?? '').slice(0, 2000);
  const r = await env.DB.prepare('UPDATE registrations SET status = ?, admin_note = ? WHERE id = ?')
    .bind(b.status, note, id).run();
  return json({ ok: true, changed: r.meta?.changes ?? 0 });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return json({ ok: false, error: 'bad_id' }, 400);
  await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
