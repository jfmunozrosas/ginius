/* GiniUs · Gini index engine (runs in the browser; also usable in Node for testing).
   - Probability distributions with a given Gini index (Pareto, Dagum, lognormal, Weibull, Gamma)
   - Estimators of the Gini index (Ga, Gb, Gc; weighted), O(n) jackknife after sorting, bootstrap
   - Monte Carlo experiments: bias explorer and missing data simulator (MCAR, MAR, MNAR)
   Project PID2022-136235NB-I00 (MICIU/AEI/10.13039/501100011033 and ERDF/EU). */
(function (root) {
  "use strict";

  // ---------------- Random numbers ----------------
  function makeRng(seed) {
    if (seed === undefined || seed === null) return Math.random;
    let a = (seed >>> 0) || 1;
    return function () { // mulberry32
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function runif(rng) { let u; do { u = rng(); } while (u <= 0 || u >= 1); return u; }
  function rnorm(rng) {
    return Math.sqrt(-2 * Math.log(runif(rng))) * Math.cos(2 * Math.PI * rng());
  }
  function rgamma(k, rng) { // Marsaglia and Tsang
    if (k < 1) return rgamma(k + 1, rng) * Math.pow(runif(rng), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = rnorm(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = runif(rng);
      if (u < 1 - 0.0331 * x ** 4) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  // ---------------- Special functions ----------------
  function lgamma(x) { // Lanczos approximation (g = 7)
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function pnorm(z) { // Abramowitz-Stegun 7.1.26 via erf, |error| < 1.5e-7
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function qnorm(p) { // Acklam's algorithm with one Newton step
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r, x;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    else if (p <= 1 - pl) { q = p - 0.5; r = q * q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
    else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    const e = pnorm(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }
  function bisectLog(f, lo, hi, target) { // f monotone; finds x with f(x) = target on a log scale
    const flo = f(lo) - target;
    for (let i = 0; i < 200; i++) {
      const mid = Math.sqrt(lo * hi), fm = f(mid) - target;
      if ((fm > 0) === (flo > 0)) lo = mid; else hi = mid;
      if (hi / lo < 1 + 1e-12) break;
    }
    return Math.sqrt(lo * hi);
  }

  // ---------------- Distributions with a given Gini index ----------------
  const DISTRIBUTIONS = ["Pareto", "Dagum-p20", "Dagum-p0.5", "Lognormal", "Weibull", "Gamma"];
  const giniGamma = k => Math.exp(lgamma(k + 0.5) - lgamma(k) - Math.log(k) - 0.5 * Math.log(Math.PI));
  const giniDagum = (a, p) => Math.exp(lgamma(p) + lgamma(2 * p + 1 / a) - lgamma(2 * p) - lgamma(p + 1 / a)) - 1;

  function params(dist, G) {
    switch (dist) {
      case "Lognormal": return {sigma: Math.SQRT2 * qnorm((G + 1) / 2)};
      case "Pareto":    return {alpha: (1 + G) / (2 * G)};
      case "Weibull":   return {k: Math.LN2 / -Math.log(1 - G)};
      case "Gamma":     return {k: bisectLog(giniGamma, 1e-4, 1e5, G)};
      case "Dagum-p20": return {p: 20, a: bisectLog(a => giniDagum(a, 20), 1.0001, 1e4, G)};
      case "Dagum-p0.5":return {p: 0.5, a: bisectLog(a => giniDagum(a, 0.5), 1.0001, 1e4, G)};
    }
    throw new Error("Unknown distribution: " + dist);
  }
  function hasQuantile(dist) { return dist !== "Gamma"; }
  function quantile(dist, par, u) {
    switch (dist) {
      case "Lognormal": return Math.exp(par.sigma * qnorm(u));
      case "Pareto":    return Math.pow(1 - u, -1 / par.alpha);
      case "Weibull":   return Math.pow(-Math.log(1 - u), 1 / par.k);
      case "Dagum-p20": case "Dagum-p0.5": return Math.pow(Math.pow(u, -1 / par.p) - 1, -1 / par.a);
    }
    throw new Error("No closed-form quantile for " + dist);
  }
  function draw(dist, par, rng) {
    if (dist === "Gamma") return rgamma(par.k, rng);
    if (dist === "Lognormal") return Math.exp(par.sigma * rnorm(rng));
    return quantile(dist, par, runif(rng));
  }
  function sample(dist, G, n, rng) {
    const par = params(dist, G), y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = draw(dist, par, rng);
    return y;
  }

  // ---------------- Descriptive statistics ----------------
  function mean(y) { let s = 0; for (const v of y) s += v; return s / y.length; }
  function skewness(y) { // Fisher's (moment) coefficient
    const n = y.length, m = mean(y);
    let m2 = 0, m3 = 0;
    for (const v of y) { const d = v - m; m2 += d * d; m3 += d * d * d; }
    m2 /= n; m3 /= n;
    return m3 / Math.pow(m2, 1.5);
  }

  // ---------------- Estimators of the Gini index ----------------
  function sorted(y) { return Float64Array.from(y).sort(); }
  // Gb = (2 / (n T)) sum_i i y_(i) - (n + 1) / n  (mid-point distribution function; valid with ties)
  function giniFromSorted(ys) {
    const n = ys.length; let S = 0, T = 0;
    for (let i = 0; i < n; i++) { S += (i + 1) * ys[i]; T += ys[i]; }
    const Gb = 2 * S / (n * T) - (n + 1) / n;
    return {Gb, Gc: n / (n - 1) * Gb, n, T, S};
  }
  // Ga with the empirical distribution function F_n(y_i) = #{y_j <= y_i} / n (handles ties)
  function giniAFromSorted(ys) {
    const n = ys.length; let T = 0, A = 0, i = 0;
    while (i < n) {
      let j = i; while (j + 1 < n && ys[j + 1] === ys[i]) j++;
      const F = (j + 1) / n;
      for (let k = i; k <= j; k++) { A += (2 * F - 1) * ys[k]; T += ys[k]; }
      i = j + 1;
    }
    return A / T;
  }
  function gini(y) { const ys = sorted(y); const g = giniFromSorted(ys); return {Ga: giniAFromSorted(ys), Gb: g.Gb, Gc: g.Gc}; }
  function giniC(y) { return giniFromSorted(sorted(y)).Gc; }

  // Weighted (finite population) estimator with the mid-point distribution function:
  // Gw = 2 A / (W T) - 1,  A = sum_i w_i y_i (C_i + w_i / 2),  C_i = cumulative weight before i
  function giniWeighted(y, w) {
    const idx = Array.from(y.keys()).sort((a, b) => y[a] - y[b]);
    let W = 0, T = 0, A = 0;
    for (const i of idx) { A += w[i] * y[i] * (W + w[i] / 2); W += w[i]; T += w[i] * y[i]; }
    return 2 * A / (W * T) - 1;
  }

  // Delete-one jackknife in O(n) after sorting (unweighted, estimator Gc or Gb).
  // Removing the k-th order statistic: S' = S - k y_(k) - sum_{j>k} y_(j);  T' = T - y_(k).
  function jackknife(y, which = "Gc", level = 0.95) {
    const ys = sorted(y), n = ys.length;
    const g = giniFromSorted(ys), est = g[which];
    const suffix = new Float64Array(n + 1);
    for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + ys[i];
    let sum = 0, sum2 = 0;
    const m = n - 1;
    for (let k = 0; k < n; k++) {
      const S1 = g.S - (k + 1) * ys[k] - suffix[k + 1], T1 = g.T - ys[k];
      const Gb1 = 2 * S1 / (m * T1) - (m + 1) / m;
      const v = which === "Gc" ? m / (m - 1) * Gb1 : Gb1;
      sum += v; sum2 += v * v;
    }
    const meanLoo = sum / n;
    const variance = (n - 1) / n * (sum2 - n * meanLoo * meanLoo);
    const bias = (n - 1) * (meanLoo - est), se = Math.sqrt(Math.max(variance, 0)), z = qnorm(1 - (1 - level) / 2);
    const corrected = est - bias;
    return {estimate: est, bias, relBias: bias / est, corrected, se, variance,
            ci: [est - z * se, est + z * se], ciCorrected: [corrected - z * se, corrected + z * se]};
  }
  // Weighted delete-one jackknife in O(n) after sorting (ignores strata and clusters).
  function jackknifeWeighted(y, w, level = 0.95) {
    const idx = Array.from(y.keys()).sort((a, b) => y[a] - y[b]);
    const n = idx.length, ys = idx.map(i => y[i]), ws = idx.map(i => w[i]);
    let W = 0, T = 0, A = 0; const C = new Float64Array(n);
    for (let k = 0; k < n; k++) { C[k] = W; A += ws[k] * ys[k] * (W + ws[k] / 2); W += ws[k]; T += ws[k] * ys[k]; }
    const est = 2 * A / (W * T) - 1;
    const suffixWY = new Float64Array(n + 1);
    for (let k = n - 1; k >= 0; k--) suffixWY[k] = suffixWY[k + 1] + ws[k] * ys[k];
    let sum = 0, sum2 = 0;
    for (let k = 0; k < n; k++) {
      const A1 = A - ws[k] * ys[k] * (C[k] + ws[k] / 2) - ws[k] * suffixWY[k + 1];
      const v = 2 * A1 / ((W - ws[k]) * (T - ws[k] * ys[k])) - 1;
      sum += v; sum2 += v * v;
    }
    const meanLoo = sum / n, variance = (n - 1) / n * (sum2 - n * meanLoo * meanLoo);
    const bias = (n - 1) * (meanLoo - est), se = Math.sqrt(Math.max(variance, 0)), z = qnorm(1 - (1 - level) / 2);
    const corrected = est - bias;
    return {estimate: est, bias, relBias: bias / est, corrected, se, variance,
            ci: [est - z * se, est + z * se], ciCorrected: [corrected - z * se, corrected + z * se]};
  }
  // Percentile bootstrap interval (unweighted: estimator Gc; weighted: Gw resampling units with their weights)
  function bootstrap(y, w, B = 1000, level = 0.95, seed = 2026) {
    const rng = makeRng(seed), n = y.length, est = new Float64Array(B);
    const yb = new Float64Array(n), wb = w ? new Float64Array(n) : null;
    for (let b = 0; b < B; b++) {
      for (let i = 0; i < n; i++) { const j = Math.floor(rng() * n); yb[i] = y[j]; if (w) wb[i] = w[j]; }
      est[b] = w ? giniWeighted(yb, wb) : giniC(yb);
    }
    est.sort();
    const lo = est[Math.floor((1 - level) / 2 * (B - 1))], hi = est[Math.ceil((1 + level) / 2 * (B - 1))];
    let s = 0, s2 = 0; for (const v of est) { s += v; s2 += v * v; }
    return {ci: [lo, hi], se: Math.sqrt((s2 - s * s / B) / (B - 1))};
  }
  // Lorenz curve (weighted or not), at most ~400 points
  function lorenz(y, w) {
    const idx = Array.from(y.keys()).sort((a, b) => y[a] - y[b]);
    let W = 0, T = 0; for (const i of idx) { const wi = w ? w[i] : 1; W += wi; T += wi * y[i]; }
    const pts = [{p: 0, L: 0}], step = Math.max(1, Math.floor(idx.length / 400));
    let cw = 0, ct = 0;
    idx.forEach((i, k) => { const wi = w ? w[i] : 1; cw += wi; ct += wi * y[i];
      if (k % step === 0 || k === idx.length - 1) pts.push({p: cw / W, L: ct / T}); });
    return pts;
  }

  // ---------------- Monte Carlo: bias explorer ----------------
  // Returns relative biases (%) of Ga, Gb, Gc and the jackknife-corrected Gc for each distribution and G.
  function biasExperiment({dists, Ggrid, n, R, seed = 123, jack = false}) {
    const rng = makeRng(seed), out = [];
    for (const dist of dists) {
      for (const G of Ggrid) {
        const par = params(dist, G); let sa = 0, sb = 0, sc = 0, sj = 0, sk = 0;
        const y = new Float64Array(n);
        for (let r = 0; r < R; r++) {
          for (let i = 0; i < n; i++) y[i] = draw(dist, par, rng);
          const ys = sorted(y), g = giniFromSorted(ys);
          sa += giniAFromSorted(ys); sb += g.Gb; sc += g.Gc; sk += skewness(y);
          if (jack) sj += jackknife(y, "Gc").corrected;
        }
        const rb = s => 100 * (s / R - G) / G;
        out.push({distribution: dist, G, estimator: "Ga", RB: rb(sa)},
                 {distribution: dist, G, estimator: "Gb", RB: rb(sb)},
                 {distribution: dist, G, estimator: "Gc", RB: rb(sc)});
        if (jack) out.push({distribution: dist, G, estimator: "Gc (jackknife-corrected)", RB: rb(sj)});
        out.push({distribution: dist, G, estimator: "skewness", RB: sk / R});
      }
    }
    return out;
  }
  // Replicated estimates (for box plots)
  function replicates({dist, Ggrid, n, R, seed = 321}) {
    const rng = makeRng(seed), out = [];
    for (const G of Ggrid) {
      const par = params(dist, G), y = new Float64Array(n);
      for (let r = 0; r < R; r++) { for (let i = 0; i < n; i++) y[i] = draw(dist, par, rng); out.push({distribution: dist, G, estimate: giniC(y)}); }
    }
    return out;
  }

  // ---------------- Monte Carlo: missing data ----------------
  const MECHANISMS = ["MCAR", "MAR", "MNAR"];
  const METHODS = ["Complete cases", "Mean imputation", "Hot-deck imputation", "Regression imputation",
                   "Stochastic regression imputation", "Multiple imputation (M = 5)"];
  const logistic = t => 1 / (1 + Math.exp(-t));
  function calibrateIntercept(eta, rate) { // find a with mean(logistic(a + eta)) = rate
    let lo = -40, hi = 40;
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2; let s = 0;
      for (const e of eta) s += logistic(mid + e);
      if (s / eta.length > rate) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }
  function ols(x, z) { // z = a + b x
    const n = x.length; let mx = 0, mz = 0;
    for (let i = 0; i < n; i++) { mx += x[i]; mz += z[i]; }
    mx /= n; mz /= n;
    let sxx = 0, sxz = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxz += (x[i] - mx) * (z[i] - mz); }
    const b = sxx > 0 ? sxz / sxx : 0, a = mz - b * mx;
    const res = new Float64Array(n);
    for (let i = 0; i < n; i++) res[i] = z[i] - a - b * x[i];
    return {a, b, res};
  }
  // One sample with missing values. "x" is an auxiliary variable correlated (rho) with the rank of y.
  //  MCAR: P(missing) constant.  MAR: depends on x.  MNAR: depends on y itself.
  //  direction = +1: units with high values are more likely to be missing (usual with incomes).
  function generate({dist, G, n, rho, rng}) {
    const par = params(dist, G), y = new Float64Array(n), x = new Float64Array(n), z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const z1 = rnorm(rng), z2 = rnorm(rng);
      z[i] = z1; y[i] = quantile(dist, par, Math.min(Math.max(pnorm(z1), 1e-12), 1 - 1e-12));
      x[i] = rho * z1 + Math.sqrt(1 - rho * rho) * z2;
    }
    return {y, x, z};
  }
  function missingIndicator({mechanism, x, z, rate, strength, direction, rng}) {
    const n = x.length, eta = new Float64Array(n);
    for (let i = 0; i < n; i++) eta[i] = mechanism === "MCAR" ? 0 : direction * strength * (mechanism === "MAR" ? x[i] : z[i]);
    const a = calibrateIntercept(eta, rate), miss = new Uint8Array(n);
    for (let i = 0; i < n; i++) miss[i] = rng() < logistic(a + eta[i]) ? 1 : 0;
    return miss;
  }
  function impute(method, y, x, miss, rng, M = 5) {
    const n = y.length, obs = [], mis = [];
    for (let i = 0; i < n; i++) (miss[i] ? mis : obs).push(i);
    if (obs.length < 5) return NaN;
    const yo = obs.map(i => y[i]);
    if (method === "Complete cases") return giniC(yo);
    const full = Float64Array.from(y);
    if (method === "Mean imputation") { const m = mean(yo); for (const i of mis) full[i] = m; return giniC(full); }
    if (method === "Hot-deck imputation") { for (const i of mis) full[i] = yo[Math.floor(rng() * yo.length)]; return giniC(full); }
    // Regression models on the log scale: log(y) = a + b x + e
    const xo = obs.map(i => x[i]), lo = yo.map(Math.log);
    if (method === "Regression imputation") {
      const f = ols(xo, lo); for (const i of mis) full[i] = Math.exp(f.a + f.b * x[i]); return giniC(full);
    }
    if (method === "Stochastic regression imputation") {
      const f = ols(xo, lo);
      for (const i of mis) full[i] = Math.exp(f.a + f.b * x[i] + f.res[Math.floor(rng() * f.res.length)]);
      return giniC(full);
    }
    if (method === "Multiple imputation (M = 5)") {
      // Proper imputation: the model is refitted on a bootstrap sample of respondents in each imputation
      let s = 0; const k = obs.length, xb = new Float64Array(k), lb = new Float64Array(k);
      for (let m = 0; m < M; m++) {
        for (let j = 0; j < k; j++) { const r = Math.floor(rng() * k); xb[j] = xo[r]; lb[j] = lo[r]; }
        const f = ols(xb, lb);
        for (const i of mis) full[i] = Math.exp(f.a + f.b * x[i] + f.res[Math.floor(rng() * k)]);
        s += giniC(full);
      }
      return s / M;
    }
    throw new Error("Unknown method: " + method);
  }
  function missingExperiment({dist, G, n, R, rate, strength, rho, direction = 1, methods = METHODS, mechanisms = MECHANISMS, seed = 2024}) {
    const rng = makeRng(seed), acc = {};
    const key = (mech, met) => mech + "|" + met;
    const add = (k, v) => { if (!Number.isFinite(v)) return; const a = acc[k] || (acc[k] = {s: 0, s2: 0, r: 0}); a.s += v; a.s2 += (v - G) ** 2; a.r++; };
    for (let r = 0; r < R; r++) {
      const {y, x, z} = generate({dist, G, n, rho, rng});
      add(key("No missing data", "Full sample"), giniC(y));
      for (const mech of mechanisms) {
        const miss = missingIndicator({mechanism: mech, x, z, rate, strength, direction, rng});
        for (const met of methods) add(key(mech, met), impute(met, y, x, miss, rng));
      }
    }
    const out = [];
    for (const k in acc) {
      const [mechanism, method] = k.split("|"), a = acc[k];
      const m = a.s / a.r;
      out.push({mechanism, method, mean: m, RB: 100 * (m - G) / G, RRMSE: 100 * Math.sqrt(a.s2 / a.r) / G, reps: a.r});
    }
    return out;
  }
  function missingExample({dist, G, n, rate, strength, rho, direction = 1, mechanism, seed = 7}) {
    const rng = makeRng(seed), {y, x, z} = generate({dist, G, n, rho, rng});
    const miss = missingIndicator({mechanism, x, z, rate, strength, direction, rng});
    return Array.from(y, (v, i) => ({y: v, x: x[i], status: miss[i] ? "Missing" : "Observed"}));
  }

  const api = {makeRng, rnorm, rgamma, lgamma, pnorm, qnorm, DISTRIBUTIONS, params, hasQuantile, quantile, draw, sample,
    mean, skewness, gini, giniC, giniWeighted, jackknife, jackknifeWeighted, bootstrap, lorenz,
    biasExperiment, replicates, MECHANISMS, METHODS, missingExperiment, missingExample, giniGamma, giniDagum};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GiniSim = api;
})(typeof window !== "undefined" ? window : globalThis);
