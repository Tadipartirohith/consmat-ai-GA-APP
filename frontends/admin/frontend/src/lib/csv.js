function escapeCell(val) {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportToCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(typeof c.value === "function" ? c.value(row) : row[c.value])).join(","))
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
