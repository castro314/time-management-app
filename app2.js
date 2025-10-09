// Uses Chart.js (MIT License) – chartjs.org
// See LICENSE.txt for license text.

const WEEK_HOURS = 168;

/* ---------- Mascot center plugin (draw BEFORE datasets so tooltips stay on top) ---------- */
const mascotCenterPlugin = {
  id: "tmcCenterImage",
  beforeDatasetsDraw(chart, args, options) {
    const imgEl = document.getElementById(options.imageId || "tmc-mascot");
    if (!imgEl || !imgEl.complete) return;
    const meta = chart.getDatasetMeta(0);
    const { ctx, chartArea } = chart;
    if (!meta || !meta.data?.length) return;

    const innerRadius = meta.data[0].innerRadius;
    const radius = innerRadius * (options.scale || 0.9);
    const side = radius * 2;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(imgEl, cx - radius, cy - radius, side, side);
    ctx.restore();
  }
};

/* ---------- Initial categories/values (match the inputs’ default values) ---------- */
const catDefs = [
  { key: "study",    label: "Study (out-of-class)",         color: "#4ADE80" },
  { key: "inclass",  label: "In-class / Direct Instruction",color: "#60A5FA" },
  { key: "work",     label: "Work (job)",                   color: "#F59E0B" },
  { key: "commute",  label: "Commute",                      color: "#FCD34D" },
  { key: "sleep",    label: "Sleep",                        color: "#8B5CF6" },
  { key: "meals",    label: "Meals",                        color: "#FB7185" },
  { key: "hygiene",  label: "Hygiene / personal care",      color: "#A78BFA" },
  { key: "exercise", label: "Exercise / movement",          color: "#34D399" },
  { key: "family",   label: "Family / caregiving",          color: "#F472B6" }
];

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const getInt = (id) => {
  const v = parseInt($(id).value, 10);
  return Number.isFinite(v) && v >= 0 ? Math.min(v, WEEK_HOURS) : 0;
};

/* ---------- Build initial arrays from DOM ---------- */
function readAll() {
  const vals = {};
  catDefs.forEach(c => { vals[c.key] = getInt(`#hours-${c.key}`); });
  return vals;
}

/* ---------- KPI rendering ---------- */
function renderKpi(overage, remaining) {
  const kpi = $("#remainingKpi");
  const text = $("#remainingText");
  if (overage > 0) {
    kpi.classList.add("tmc-kpi--danger");
    text.textContent = `Over by ${overage} hrs`;
  } else {
    kpi.classList.remove("tmc-kpi--danger");
    text.textContent = `${remaining} hrs`;
  }
}

/* ---------- Warning banner ---------- */
function renderWarning(overage) {
  const warn = $("#tmc-warning");
  if (overage > 0) {
    warn.hidden = false;
    warn.textContent = `You’re over the 168-hour week by ${overage} hour${overage === 1 ? "" : "s"}. Please adjust your entries.`;
  } else {
    warn.hidden = true;
    warn.textContent = "";
  }
}

/* ---------- Chart setup ---------- */
const ctx = document.getElementById("timeDonut");
const chart = new Chart(ctx, {
  type: "doughnut",
  data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }] },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: getComputedStyle(document.querySelector('.tmc-app'))
                  .getPropertyValue('--tmc-text') || '#1f2937'
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed;
            const pct = ((v / WEEK_HOURS) * 100).toFixed(1);
            return ` ${ctx.label}: ${v} hrs (${pct}%)`;
          }
        }
      },
      tmcCenterImage: { imageId: "tmc-mascot", scale: 0.85 }
    },
    layout: { padding: 10 },
    cutout: "60%"
  },
  plugins: [mascotCenterPlugin]
});

/* ---------- Recompute + redraw (called on every input) ---------- */
function recomputeAndDraw() {
  // Clamp any out-of-range input immediately (0–168, integers only)
  catDefs.forEach(c => {
    const el = document.getElementById(`hours-${c.key}`);
    if (!el) return;
    // force integer input & clamp
    const n = parseInt(el.value, 10);
    if (!Number.isFinite(n) || n < 0) el.value = 0;
    else if (n > WEEK_HOURS) el.value = WEEK_HOURS;
    else el.value = n; // remove decimals if any
  });

  const vals = readAll();
  const used = Object.values(vals).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, WEEK_HOURS - used);
  const overage   = Math.max(0, used - WEEK_HOURS);

  // Build chart dataset from non-zero categories
  const labels = [];
  const data = [];
  const bg = [];
  catDefs.forEach(c => {
    const v = vals[c.key];
    if (v > 0) { labels.push(c.label); data.push(v); bg.push(c.color); }
  });
  // Remaining slice only when not over
  if (overage === 0 && remaining > 0) {
    labels.push("Remaining");
    data.push(remaining);
    bg.push("#9CA3AF");
  }

  chart.data.labels = labels;
  chart.data.datasets[0].data = data;
  chart.data.datasets[0].backgroundColor = bg;
  chart.update("none");

  renderKpi(overage, remaining);
  renderWarning(overage);
}

/* ---------- Wire inputs ---------- */
catDefs.forEach(c => {
  const el = document.getElementById(`hours-${c.key}`);
  if (el) el.addEventListener("input", recomputeAndDraw);
});

/* ---------- First render ---------- */
recomputeAndDraw();
