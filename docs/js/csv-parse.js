/* GiniUs · CSV and number parsing for the Gini index calculator (comma, semicolon or tab; quoted fields; decimal comma). */
(function (root) {
  "use strict";
  function detectDelimiter(text) {
    const first = text.split(/\r?\n/).find(l => l.trim().length) || "";
    const counts = {",": 0, ";": 0, "\t": 0};
    let q = false;
    for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const d = detectDelimiter(text), rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === d) { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(x => x.trim() !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(x => x.trim() !== "")) rows.push(row);
    if (!rows.length) return {header: [], data: []};
    const header = rows[0].map((h, j) => h.trim() || `V${j + 1}`);
    const data = rows.slice(1).map(r => Object.fromEntries(header.map((h, j) => [h, (r[j] ?? "").trim()])));
    return {header, data};
  }
  function toNumber(s) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/\s/g, "");
    if (s === "") return NaN;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");   // 1.234,56
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");                                   // 1234,56
    else s = s.replace(/,(?=\d{3}(\D|$))/g, "");                                                // 1,234.56
    return Number(s);
  }
  function parseList(text) {
    // Numbers separated by semicolons, spaces, tabs or new lines (a comma is then a decimal comma);
    // if there are no such separators, commas separate the numbers.
    const t = text.trim();
    const tokens = /[;\s]/.test(t) ? t.split(/[;\s]+/) : t.split(",");
    return tokens.map(toNumber).filter(Number.isFinite);
  }

  root.CsvParse = {parseCSV, toNumber, parseList};
})(typeof window !== "undefined" ? window : globalThis);
