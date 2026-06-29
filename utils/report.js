// utils/report.js
// Pure helpers to serialise a page scan report to CSV/JSON. UMD so it's usable
// in the popup (window) and require-able in unit tests.
(function (root) {
  const COLUMNS = ['name', 'price', 'verdict', 'confidence', 'engine', 'model', 'imageUrl'];

  function csvEscape(value) {
    const s = value == null ? '' : String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv(report) {
    const products = (report && report.products) || [];
    const header = [...COLUMNS, 'site', 'pageUrl'];
    const rows = [header];
    for (const p of products) {
      rows.push([
        p.name, p.price, p.verdict, p.confidence, p.engine, p.model, p.imageUrl,
        report.site, report.pageUrl,
      ]);
    }
    return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  }

  function buildJson(report) {
    return JSON.stringify(report, null, 2);
  }

  const RMF_Report = { COLUMNS, csvEscape, buildCsv, buildJson };
  root.RMF_Report = RMF_Report;
  if (typeof module !== 'undefined' && module.exports) module.exports = RMF_Report;
})(typeof self !== 'undefined' ? self : this);
