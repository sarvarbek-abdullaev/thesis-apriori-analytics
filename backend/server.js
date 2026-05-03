require("dotenv").config();

const PORT = process.env.PORT || 3001;

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { parse } = require("csv-parse/sync");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- HELPERS ---------------- */

function mapLikert(value) {
  if (!value) return "Medium";
  value = String(value).toLowerCase().trim();

  if (value.includes("strongly disagree")) return "Low";
  if (value.includes("disagree")) return "Low";
  if (value.includes("strongly agree")) return "High";
  if (value.includes("agree")) return "High";
  if (value.includes("neutral")) return "Medium";

  // Handle numeric scales (1-5)
  const num = parseFloat(value);
  if (!isNaN(num)) {
    if (num <= 2) return "Low";
    if (num >= 4) return "High";
    return "Medium";
  }

  return "Medium";
}

/* ---------------- GET DATA ---------------- */

async function getData() {
  try {
    const response = await axios.get(process.env.SHEET_CSV_URL, {
      timeout: 10000,
    });

    const parsed = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log("✅ Data rows:", parsed.length);
    if (parsed.length > 0) {
      console.log("📋 Columns:", Object.keys(parsed[0]));
    }

    return parsed;
  } catch (err) {
    console.error("❌ Data loading error:", err.message);
    throw err;
  }
}

/* ---------------- COLUMN NAME RESOLVER ---------------- */
// Tries multiple possible column name formats
function getCol(row, prefix, index) {
  const attempts = [
    `${prefix}${index}`,
    `${prefix} ${index}`,
    `${prefix.toLowerCase()}${index}`,
    `${prefix.toLowerCase()} ${index}`,
  ];
  for (const key of attempts) {
    if (row[key] !== undefined) return row[key];
  }
  return null;
}

/* ================== APRIORI ================== */

function getSupport(transactions, itemset) {
  let count = 0;
  for (let t of transactions) {
    if (itemset.every((i) => t.includes(i))) count++;
  }
  return count / transactions.length;
}

function generateCandidates(prev, k) {
  const candidates = [];
  const seen = new Set();

  for (let i = 0; i < prev.length; i++) {
    for (let j = i + 1; j < prev.length; j++) {
      const a = prev[i];
      const b = prev[j];

      if (a.slice(0, k - 2).join(",") === b.slice(0, k - 2).join(",")) {
        const union = [...new Set([...a, ...b])].sort();
        if (union.length === k) {
          const key = union.join("|");
          if (!seen.has(key)) {
            seen.add(key);
            candidates.push(union);
          }
        }
      }
    }
  }

  return candidates;
}

function runApriori(transactions, minSupport = 0.15, maxItemsetSize = 3, maxCandidates = 500) {
  let results = [];

  // Count single items
  let counts = {};
  transactions.forEach((t) =>
    t.forEach((i) => {
      if (i) counts[i] = (counts[i] || 0) + 1;
    }),
  );

  let L = Object.keys(counts)
    .filter((i) => counts[i] / transactions.length >= minSupport)
    .map((i) => [i])
    .sort((a, b) => a[0].localeCompare(b[0]));

  L.forEach((i) =>
    results.push({ items: i, support: getSupport(transactions, i) }),
  );

  let k = 1;

  while (L.length > 0) {
    k++;

    // Guard 1: stop before generating candidates if max size reached
    if (k > maxItemsetSize) break;

    let candidates = generateCandidates(L, k);

    // Guard 2: stop if candidate explosion detected
    if (candidates.length > maxCandidates) {
      console.warn(
        `Apriori stopped at k=${k}: candidate count (${candidates.length}) exceeded limit (${maxCandidates})`
      );
      break;
    }

    let newL = [];

    candidates.forEach((c) => {
      const sup = getSupport(transactions, c);
      if (sup >= minSupport) {
        newL.push(c);
        results.push({ items: c, support: sup });
      }
    });

    L = newL;
  }

  return results;
}

/* ================== RULES ================== */

function generateRules(frequent, minConfidence = 0.4) {
  const rules = [];

  // Build a lookup map for faster access
  const supportMap = {};
  frequent.forEach((f) => {
    supportMap[JSON.stringify(f.items.slice().sort())] = f.support;
  });

  frequent.forEach((f) => {
    if (f.items.length < 2) return;

    for (let i = 0; i < f.items.length; i++) {
      const antecedent = f.items.filter((_, idx) => idx !== i).sort();
      const consequent = [f.items[i]];

      const antSupport = supportMap[JSON.stringify(antecedent)];
      const conSupport = supportMap[JSON.stringify(consequent.slice().sort())];

      if (!antSupport || !conSupport) continue;

      const confidence = f.support / antSupport;
      const lift = confidence / conSupport;

      if (confidence >= minConfidence) {
        rules.push({
          antecedent,
          consequent,
          support: f.support,
          confidence,
          lift,
        });
      }
    }
  });

  return rules;
}

/* ================== BUILD TRANSACTIONS ================== */

function buildTransactions(data) {
  return data.map((d) => {
    const items = [];
    ["SAL", "CD", "JA", "LS", "OE", "JS"].forEach((prefix) => {
      for (let i = 1; i <= 4; i++) {
        const val = getCol(d, prefix, i);
        const level = mapLikert(val);
        items.push(`${prefix}${i}_${level}`);
      }
    });
    return items.filter(Boolean);
  });
}

/* ================== INSIGHTS ================== */

async function generateInsights(topN, month, minConf, factor) {
  let data = await getData();

  if (month) {
    data = data.filter((d) => {
      const ts = d["Timestamp"] || d["timestamp"] || d["Date"] || "";
      if (!ts) return true;
      return new Date(ts).getMonth() + 1 == month;
    });
    console.log(`📅 After month filter (${month}): ${data.length} rows`);
  }

  if (data.length === 0) {
    console.warn("⚠️ No data after filtering");
    return [];
  }

  const transactions = buildTransactions(data);
  console.log("🔢 Sample transaction:", transactions[0]);

  const frequent = runApriori(transactions, 0.1);
  console.log("📦 Frequent itemsets found:", frequent.length);

  let rules = generateRules(frequent, minConf);
  console.log("📐 Rules generated:", rules.length);

  // Only keep rules where consequent is about job satisfaction
  rules = rules.filter((r) => r.consequent.some((c) => c.startsWith("JS")));

  // Filter by factor if specified
  if (factor !== "ALL") {
    rules = rules.filter((r) => r.antecedent.some((a) => a.startsWith(factor)));
  }

  // Sort by combined score
  rules.sort(
    (a, b) =>
      b.lift * b.confidence * b.support - a.lift * a.confidence * a.support,
  );

  console.log("✅ Final rules after filter:", rules.length);

  return rules.slice(0, topN);
}

/* ---------------- LABEL MAPS ---------------- */

const factorLabel = {
  SAL: "Salary",
  CD: "Career Development",
  JA: "Job Autonomy",
  LS: "Leadership Style",
  OE: "Office Environment",
  JS: "Job Satisfaction",
};

function humanizeItem(item) {
  // e.g. "SAL1_Low" -> "Low Salary (Q1)"
  const match = item.match(/^([A-Z]+)(\d+)_(.+)$/);
  if (!match) return item;
  const [, prefix, num, level] = match;
  const label = factorLabel[prefix] || prefix;
  return `${level} ${label} (Q${num})`;
}

/* ---------------- API ROUTES ---------------- */

app.get("/insights", async (req, res) => {
  try {
    const topN = parseInt(req.query.top) || 5;
    const month = req.query.month || "";
    const minConf = parseFloat(req.query.confidence) || 0.4;
    const factor = req.query.factor || "ALL";

    const rules = await generateInsights(topN, month, minConf, factor);

    if (rules.length === 0) {
      return res.json({
        insights: [],
        message:
          "No patterns found. Try lowering the confidence threshold or selecting All Months.",
      });
    }

    const explained = rules.map((r) => {
      const consequentItem = r.consequent[0];
      const level = consequentItem.split("_")[1] || "";

      const antecedentReadable = r.antecedent.map(humanizeItem).join(" + ");
      const consequentReadable = humanizeItem(consequentItem);

      return {
        rule: `${antecedentReadable} → ${consequentReadable}`,
        explanation: `Employees who report ${antecedentReadable.toLowerCase()} tend to have ${level.toLowerCase()} job satisfaction.`,
        confidence: (r.confidence * 100).toFixed(1) + "%",
        support: (r.support * 100).toFixed(1) + "%",
        lift: r.lift.toFixed(2),
      };
    });

    res.json({ insights: explained });
  } catch (err) {
    console.error("🔥 /insights ERROR:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const data = await getData();

    const counts = { SAL: 0, CD: 0, JA: 0, LS: 0, OE: 0 };
    const totals = { SAL: 0, CD: 0, JA: 0, LS: 0, OE: 0 };

    data.forEach((d) => {
      ["SAL", "CD", "JA", "LS", "OE"].forEach((key) => {
        for (let i = 1; i <= 4; i++) {
          const val = getCol(d, key, i);
          if (val !== null) {
            if (mapLikert(val) === "Low") counts[key]++;
            totals[key]++;
          }
        }
      });
    });

    const result = {};
    Object.keys(counts).forEach((k) => {
      result[k] =
        totals[k] > 0 ? ((counts[k] / totals[k]) * 100).toFixed(1) : "0.0";
    });

    res.json(result);
  } catch (err) {
    console.error("🔥 /stats ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/trends", async (req, res) => {
  try {
    const data = await getData();

    const monthly = {};

    data.forEach((d) => {
      const ts = d["Timestamp"] || d["timestamp"] || d["Date"] || "";
      const month = ts ? new Date(ts).getMonth() + 1 : null;
      if (!month || isNaN(month)) return;

      if (!monthly[month]) monthly[month] = { total: 0, low: 0 };

      for (let i = 1; i <= 4; i++) {
        const val = getCol(d, "JS", i);
        if (val !== null) {
          if (mapLikert(val) === "Low") monthly[month].low++;
          monthly[month].total++;
        }
      }
    });

    const result = Object.keys(monthly)
      .sort((a, b) => Number(a) - Number(b))
      .map((m) => ({
        month: Number(m),
        dissatisfaction:
          monthly[m].total > 0
            ? parseFloat(((monthly[m].low / monthly[m].total) * 100).toFixed(1))
            : 0,
      }));

    res.json(result);
  } catch (err) {
    console.error("🔥 /trends ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Report endpoint — returns a simple HTML report (PDF generation requires puppeteer/pdfkit setup)
app.get("/report", async (req, res) => {
  try {
    const topN = parseInt(req.query.top) || 5;
    const month = req.query.month || "";

    const rules = await generateInsights(topN, month, 0.4, "ALL");

    const rows = rules
      .map(
        (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.antecedent.map(humanizeItem).join(", ")}</td>
        <td>${humanizeItem(r.consequent[0])}</td>
        <td>${(r.confidence * 100).toFixed(1)}%</td>
        <td>${(r.support * 100).toFixed(1)}%</td>
        <td>${r.lift.toFixed(2)}</td>
      </tr>`,
      )
      .join("");

    const html = `
      <html><head><title>Manager Report</title>
      <style>
        body { font-family: Arial; padding: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #2196F3; color: white; }
        h1 { color: #333; }
      </style>
      </head><body>
      <h1>Manager Analytics Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      ${month ? `<p>Month: ${month}</p>` : "<p>All months</p>"}
      <table>
        <tr><th>#</th><th>Antecedent</th><th>Consequent</th><th>Confidence</th><th>Support</th><th>Lift</th></tr>
        ${rows || "<tr><td colspan='6'>No insights found</td></tr>"}
      </table>
      </body></html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("🔥 /report ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- START ---------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
