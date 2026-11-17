/* GiniUs · Gini index calculator: user interface (uses js/csv-parse.js and js/gini-sim.js) */
(function () {
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 4) => Number.isFinite(v) ? v.toFixed(d) : "–";
  const pct = v => Number.isFinite(v) ? (100 * v).toFixed(1) + "%" : "–";
  const P = window.CsvParse, G = window.GiniSim;
  let parsed = null, lastCSV = "";

  const EX = {
    list: "10\n20\n30\n40\n60\n80\n150",
    sex: "income;sex\n12;Woman\n15;Woman\n18;Woman\n22;Woman\n30;Woman\n45;Woman\n16;Man\n20;Man\n25;Man\n35;Man\n50;Man\n95;Man",
    regions: (() => {
      // Reproducible simulated lognormal incomes with sampling weights (seeded generator)
      const rng = G.makeRng(2026);
      const R = [["North", 700, 9.9, 0.5, 120], ["South", 500, 9.5, 0.8, 200], ["Centre", 300, 10.1, 0.65, 90]];
      let out = "income;region;weight";
      for (const [r, n, m, sd, w] of R) for (let i = 0; i < n; i++)
        out += `\n${Math.round(Math.exp(m + sd * G.rnorm(rng)))};${r};${Math.round(w * (0.6 + 0.8 * rng()))}`;
      return out;
    })()
  };
  document.querySelectorAll("[data-example]").forEach(b => b.addEventListener("click", () => {
    $("calc-input").value = EX[b.dataset.example]; prepare(); run();
  }));
  $("calc-file-btn").addEventListener("click", () => $("calc-file").click());
  $("calc-file").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    $("calc-file-name").textContent = f.name;
    const r = new FileReader();
    r.onload = () => { $("calc-input").value = r.result; prepare(); };
    r.readAsText(f);
  });
  $("calc-input").addEventListener("input", () => { clearTimeout(window._calcT); window._calcT = setTimeout(prepare, 400); });
  $("calc-run").addEventListener("click", run);

  function isTable(text) { const first = text.trim().split(/\r?\n/)[0] || ""; return /[A-Za-zÀ-ÿ]/.test(first); }
  function prepare() {
    const text = $("calc-input").value;
    if (text === lastCSV) return;
    lastCSV = text;
    if (!text.trim() || !isTable(text)) { parsed = null; $("calc-cols").hidden = true; return; }
    parsed = P.parseCSV(text);
    const opts = none => (none ? `<option value="">(none)</option>` : "") + parsed.header.map(h => `<option>${h}</option>`).join("");
    $("calc-y").innerHTML = opts(false); $("calc-g").innerHTML = opts(true); $("calc-w").innerHTML = opts(true);
    const numeric = h => parsed.data.slice(0, 50).filter(r => Number.isFinite(P.toNumber(r[h]))).length > 0.8 * Math.min(50, parsed.data.length);
    const wh = parsed.header.find(h => /^(w|wt|weight|weights|peso|pesos|factor|fe)$/i.test(h));
    const yh = parsed.header.find(h => numeric(h) && h !== wh); if (yh) $("calc-y").value = yh;
    const gh = parsed.header.find(h => !numeric(h)); if (gh) $("calc-g").value = gh;
    if (wh) $("calc-w").value = wh;
    $("calc-cols").hidden = false;
  }

  function run() {
    prepare();
    const text = $("calc-input").value;
    let y = [], g = null, w = null, dropped = 0, neg = 0;
    if (parsed) {
      const yh = $("calc-y").value, gh = $("calc-g").value, wh = $("calc-w").value;
      const rows = parsed.data.map(r => ({y: P.toNumber(r[yh]), g: gh ? r[gh] : null, w: wh ? P.toNumber(r[wh]) : 1}));
      const ok = rows.filter(r => Number.isFinite(r.y) && r.y >= 0 && Number.isFinite(r.w) && r.w > 0 && (!gh || r.g !== ""));
      neg = rows.filter(r => Number.isFinite(r.y) && r.y < 0).length; dropped = rows.length - ok.length - neg;
      y = ok.map(r => r.y); if (gh) g = ok.map(r => r.g); if (wh) w = ok.map(r => r.w);
    } else {
      const all = P.parseList(text); y = all.filter(v => v >= 0); neg = all.length - y.length;
    }
    $("calc-msg").innerHTML = (neg || dropped) ? `<p class="calc-note">${neg ? `${neg} negative value(s) were excluded. ` : ""}${dropped ? `${dropped} row(s) with missing or invalid values were excluded.` : ""}</p>` : "";
    if (y.length < 3 || y.every(v => v === 0)) { $("calc-out").innerHTML = `<div class="callout callout-warning"><p>At least 3 non-negative values (not all zero) are needed.</p></div>`; return; }
    $("calc-out").innerHTML = `<p class="calc-note">Computing…</p>`;
    setTimeout(() => show(y, g, w), 20);
  }

  function estimateAll(y, w, boot) {
    if (w) {
      const j = G.jackknifeWeighted(y, w), b = boot ? G.bootstrap(y, w, 1000) : null;
      return {main: "Gw", rows: [["Ĝw (weighted, mid-point)", j, b]]};
    }
    const gg = G.gini(y), jc = G.jackknife(y, "Gc"), jb = G.jackknife(y, "Gb"), b = boot ? G.bootstrap(y, null, 1000) : null;
    return {main: "Gc", Ga: gg.Ga, rows: [["Ĝc = n/(n−1) · Ĝb", jc, b], ["Ĝb (usual estimator)", jb, null]]};
  }

  function lorenzSVG(series) {
    const W = 360, H = 360, m = 40, sx = p => m + p * (W - 2 * m), sy = L => H - m - L * (H - 2 * m);
    const colors = ["#1A5FA8", "#C9962B", "#D43F3A", "#5E8C61", "#9C6ADE", "#E89A3C"];
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="Lorenz curve">`;
    for (let t = 0; t <= 1.0001; t += 0.25) s += `<line x1="${sx(t)}" y1="${sy(0)}" x2="${sx(t)}" y2="${sy(1)}" stroke="#eee"/><line x1="${sx(0)}" y1="${sy(t)}" x2="${sx(1)}" y2="${sy(t)}" stroke="#eee"/>` +
      `<text x="${sx(t)}" y="${H - m + 16}" font-size="11" text-anchor="middle">${t}</text><text x="${m - 6}" y="${sy(t) + 4}" font-size="11" text-anchor="end">${t}</text>`;
    s += `<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(1)}" stroke="#D43F3A" stroke-dasharray="4,3"/>`;
    series.forEach((ser, k) => {
      s += `<polyline fill="none" stroke="${colors[k % colors.length]}" stroke-width="2.4" points="${ser.pts.map(d => `${sx(d.p).toFixed(1)},${sy(d.L).toFixed(1)}`).join(" ")}"/>`;
      s += `<text x="${m + 6}" y="${m + 4 + 15 * k}" font-size="12" fill="${colors[k % colors.length]}" font-weight="700">${ser.label}</text>`;
    });
    s += `<text x="${W / 2}" y="${H - 6}" font-size="12" text-anchor="middle">Cumulative share of population</text>` +
         `<text transform="translate(12,${H / 2}) rotate(-90)" font-size="12" text-anchor="middle">Cumulative share of income</text></svg>`;
    return s;
  }

  function show(y, g, w) {
    const boot = $("calc-boot").checked;
    const est = estimateAll(y, w, boot);
    const n = y.length, mu = w ? y.reduce((s, v, i) => s + v * w[i], 0) / w.reduce((a, b) => a + b, 0) : G.mean(y);
    let html = `<h3>3. Results</h3>
      <p>n = <b>${n.toLocaleString("en")}</b> observations${w ? " (weighted)" : ""} · mean = <b>${mu.toLocaleString("en", {maximumFractionDigits: 2})}</b>${w ? "" : ` · skewness = <b>${fmt(G.skewness(y), 2)}</b>`}</p>
      <table class="table table-sm calc-table"><thead><tr><th>Estimator</th><th>Estimate</th><th>Jackknife bias</th><th>Relative bias</th><th>Std. error</th><th>95% CI (jackknife)</th><th>95% CI (bootstrap)</th></tr></thead><tbody>` +
      est.rows.map(([lab, j, b]) => `<tr><td>${lab}</td><td><b>${fmt(j.estimate)}</b></td><td>${fmt(j.bias)}</td><td>${pct(j.relBias)}</td><td>${fmt(j.se)}</td><td>[${fmt(j.ci[0])}, ${fmt(j.ci[1])}]</td><td>${b ? `[${fmt(b.ci[0])}, ${fmt(b.ci[1])}]` : "–"}</td></tr>`).join("") +
      (est.Ga !== undefined ? `<tr><td>Ĝa (for comparison)</td><td>${fmt(est.Ga)}</td><td colspan="5" class="calc-note">Overestimates inequality, especially when inequality is low (Ĝa ≈ Ĝb + 1/n).</td></tr>` : "") +
      `</tbody></table>`;
    const j0 = est.rows[0][1];
    if (Math.abs(j0.relBias) > 0.02) html += `<div class="callout callout-warning"><p><b>Non-negligible bias.</b> The jackknife estimates a relative bias of ${pct(j0.relBias)} for the main estimator. This is common with small samples or highly skewed data; consider reporting the bias-corrected estimate (${fmt(j0.corrected)}) and its interval [${fmt(j0.ciCorrected[0])}, ${fmt(j0.ciCorrected[1])}].</p></div>`;

    const series = [{label: `All (G = ${fmt(j0.estimate, 3)})`, pts: G.lorenz(y, w)}];
    let groups = null;
    if (g) {
      const levels = [...new Set(g)].sort();
      if (levels.length > 30) html += `<p class="calc-note">The grouping variable has more than 30 categories; groups are not shown.</p>`;
      else {
        groups = levels.map(l => {
          const ix = g.map((v, i) => v === l ? i : -1).filter(i => i >= 0), yy = ix.map(i => y[i]), ww = w ? ix.map(i => w[i]) : null;
          if (yy.length < 3 || yy.every(v => v === 0)) return {group: l, n: yy.length};
          const j = w ? G.jackknifeWeighted(yy, ww) : G.jackknife(yy, "Gc");
          return {group: l, n: yy.length, mean: ww ? yy.reduce((s, v, i) => s + v * ww[i], 0) / ww.reduce((a, b) => a + b, 0) : G.mean(yy), j, pts: G.lorenz(yy, ww)};
        });
        html += `<h3>Gini index by group</h3><table class="table table-sm calc-table"><thead><tr><th>Group</th><th>n</th><th>Mean</th><th>Gini</th><th>Jackknife bias</th><th>Std. error</th><th>95% CI (jackknife)</th></tr></thead><tbody>` +
          groups.map(r => r.j ? `<tr><td>${r.group}</td><td>${r.n}</td><td>${r.mean.toLocaleString("en", {maximumFractionDigits: 2})}</td><td><b>${fmt(r.j.estimate)}</b></td><td>${fmt(r.j.bias)}</td><td>${fmt(r.j.se)}</td><td>[${fmt(r.j.ci[0])}, ${fmt(r.j.ci[1])}]</td></tr>` : `<tr><td>${r.group}</td><td>${r.n}</td><td colspan="5" class="calc-note">Too few observations</td></tr>`).join("") +
          `</tbody></table><p class="calc-note">The Gini index is not additively decomposable into between- and within-group inequality; compare the groups taking into account their confidence intervals. Small groups give biased and imprecise estimates.</p>`;
        groups.filter(r => r.pts).slice(0, 5).forEach(r => series.push({label: `${r.group} (G = ${fmt(r.j.estimate, 3)})`, pts: r.pts}));
      }
    }
    html += `<h3>Lorenz curve</h3>${lorenzSVG(series)}
      <p><a class="btn btn-outline-primary btn-sm" id="calc-dl" download="ginius_calculator_results.csv" href="#">Download results (CSV)</a></p>
      <p class="calc-note">Methods: delete-one jackknife bias and variance; jackknife interval = estimate ± 1.96 × standard error; bootstrap = percentile interval with 1,000 resamples (seed 2026). With strongly skewed data or very small samples, these intervals can be too narrow; giniVarCI offers other intervals (BCa, linearisation, empirical likelihood).</p>`;
    $("calc-out").innerHTML = html;

    let csv = "section,estimator_or_group,statistic,value\n";
    for (const [lab, j, b] of est.rows) {
      const k = `"${lab}"`;
      for (const s of ["estimate", "bias", "relBias", "corrected", "se"]) csv += `results,${k},${s},${j[s]}\n`;
      csv += `results,${k},ci_jackknife_lower,${j.ci[0]}\nresults,${k},ci_jackknife_upper,${j.ci[1]}\n`;
      if (b) csv += `results,${k},ci_bootstrap_lower,${b.ci[0]}\nresults,${k},ci_bootstrap_upper,${b.ci[1]}\n`;
    }
    if (est.Ga !== undefined) csv += `results,"Ga",estimate,${est.Ga}\n`;
    if (groups) for (const r of groups) if (r.j) for (const s of ["estimate", "bias", "se"]) csv += `groups,"${String(r.group).replace(/"/g, '""')}",${s},${r.j[s]}\n`;
    $("calc-dl").href = URL.createObjectURL(new Blob(["﻿" + csv], {type: "text/csv;charset=utf-8"}));
  }
})();
