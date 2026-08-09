const inr = (n) => "\u20B9" + (Number(n) || 0).toLocaleString("en-IN");

function fmtDate(s) {
  try {
    return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

const STYLES = `
  *{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
  body{margin:0;padding:0;color:#111;background:#fff}
  .invoice{padding:40px;page-break-after:always}
  .invoice:last-child{page-break-after:auto}
  .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #ff7a2f;padding-bottom:16px}
  .brand h1{margin:0;font-size:24px;letter-spacing:-.5px}
  .brand .accent{color:#ff7a2f}
  .brand .tag{font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase}
  .meta{display:flex;justify-content:space-between;margin:24px 0;font-size:13px}
  .meta h3{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#888}
  .meta p{margin:2px 0;color:#333}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th{background:#f4f5f7;text-align:left;padding:10px;border-bottom:2px solid #ddd;text-transform:uppercase;font-size:11px;letter-spacing:.5px;color:#555}
  td{padding:10px;border-bottom:1px solid #eee}
  .num{text-align:right}
  tfoot td{border:none;font-weight:600}
  .total-row td{border-top:2px solid #ff7a2f;font-size:16px;color:#ff7a2f}
  .status{display:inline-block;padding:3px 10px;border-radius:4px;background:#f4f5f7;font-size:12px;text-transform:capitalize}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
`;

export function invoiceBody(o) {
  const bc = o.buyer_contact || {};
  const rows = (o.line_items || [])
    .map(
      (li, i) => `<tr>
        <td>${i + 1}</td><td>${li.name}</td>
        <td class="num">${li.qty} ${li.unit}</td>
        <td class="num">${inr(li.unit_price)}</td>
        <td class="num">${inr(li.amount)}</td>
      </tr>`,
    )
    .join("");
  return `<div class="invoice">
    <div class="brand">
      <div><h1>Cons<span class="accent">Mat</span></h1><div class="tag">Construction Materials Marketplace</div></div>
      <div style="text-align:right"><h2 style="margin:0;font-size:18px">INVOICE</h2><div style="color:#888;font-size:13px">${o.id}</div></div>
    </div>
    <div class="meta">
      <div>
        <h3>Billed To</h3>
        <p><strong>${o.buyer}</strong></p>
        ${bc.contact ? `<p>Attn: ${bc.contact}</p>` : ""}
        ${bc.address ? `<p>${bc.address}</p>` : ""}
        ${bc.phone ? `<p>${bc.phone}</p>` : ""}
        ${bc.gstin ? `<p>GSTIN: ${bc.gstin}</p>` : ""}
      </div>
      <div style="text-align:right">
        <h3>Details</h3>
        <p>Vendor: <strong>${o.vendor}</strong></p>
        <p>Date: ${fmtDate(o.created_at)}</p>
        <p>Status: <span class="status">${String(o.status).replace("_", " ")}</span></p>
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row"><td colspan="4" class="num">Grand Total</td><td class="num">${inr(o.amount)}</td></tr></tfoot>
    </table>
    <div class="footer">This is a system-generated invoice from ConsMat. Amounts in INR (₹).</div>
  </div>`;
}

export function openInvoiceWindow(orders, title = "Invoices") {
  const list = Array.isArray(orders) ? orders : [orders];
  if (list.length === 0) return false;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title><style>${STYLES}</style></head>
    <body>${list.map(invoiceBody).join("")}
    <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
    </body></html>`;
  const w = window.open("", "_blank", "width=880,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
