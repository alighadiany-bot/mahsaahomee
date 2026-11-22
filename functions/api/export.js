// GET /api/export  ->  دانلود همه ثبت‌نام‌ها به‌صورت CSV (قابل‌باز شدن در Excel)
// قفل رمزی در functions/_middleware.js اعمال می‌شود.

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // جلوگیری از Formula injection
  return '"' + s.replace(/"/g, '""') + '"';
};

const STATUS = { new: 'جدید', contacted: 'تماس گرفته شد', confirmed: 'تأیید شد', rejected: 'ردشده' };

export async function onRequestGet({ env }) {
  if (!env.DB) return new Response('DB not bound', { status: 500 });

  const { results } = await env.DB.prepare(
    `SELECT id, created_at, brand, contact_name, phone, product_group, package_choice,
            prev_collab, prize_support, brand_url, message, status, admin_note
     FROM registrations ORDER BY id DESC`
  ).all();

  const head = ['شناسه','زمان ثبت (UTC)','نام برند','نام مسئول','شماره تماس','گروه محصول','پکیج','همکاری قبلی','حمایت از جوایز','آدرس','توضیحات','وضعیت','یادداشت داخلی'];
  const rows = results.map((r) => [r.id, r.created_at, r.brand, r.contact_name, r.phone, r.product_group, r.package_choice, r.prev_collab, r.prize_support, r.brand_url, r.message, STATUS[r.status] || r.status, r.admin_note]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="registrations.csv"',
    },
  });
}
