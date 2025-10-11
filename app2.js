// Uses Chart.js (MIT License) – chartjs.org
// See LICENSE.txt for license text.

const WEEK_HOURS = 168;
const STUDY_MULTIPLIER = 3; // units × 3 hours out-of-class

/* ---------- Mascot center plugin ---------- */
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

/* ---------- Categories (study will be computed) ---------- */
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

const $ = (sel) => document.querySelector(sel);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/* ---------- Parse helpers ---------- */
const getIntField = (id, min=0, max=168) => {
  const el = $(id);
  const n = parseInt(el.value, 10);
  const v = Number.isFinite(n) ? clamp(n, min, max) : 0;
  // normalize UI if user typed decimals etc.
  el.value = v;
  return v;
};

/* ---------- Study auto-calc from units ---------- */
function computeStudyFromUnits() {
  const units = getIntField("#hours-units", 0, 24);
  const study = clamp(units * STUDY_MULTIPLIER, 0, WEEK_HOURS);
  const studyEl = $("#hours-study");
  studyEl.value = study;
  return { units, study };
}

/* ---------- Read all inputs (with study overwritten) ---------- */
function readAll() {
  // Update study based on units first
  const { study } = computeStudyFromUnits();

  const vals = { study };
  // Read the rest (excluding study)
  catDefs.forEach(c => {
    if (c.key === "study") return;
    vals[c.key] = getIntField(`#hours-${c.key}`);
  });
  return vals;
}

/* ---------- KPI & warnings ---------- */
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

/* ---------- Chart ---------- */
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
        onClick: () => {},                    // disable legend toggling
        onHover: (e) => { e.native.target.style.cursor = "default"; },
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

/* ---------- Recompute + redraw ---------- */
function recomputeAndDraw() {
  const vals = readAll();
  const used = Object.values(vals).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, WEEK_HOURS - used);
  const overage   = Math.max(0, used - WEEK_HOURS);

  const labels = [];
  const data = [];
  const bg = [];
  catDefs.forEach(c => {
    const v = vals[c.key];
    if (v > 0) { labels.push(c.label); data.push(v); bg.push(c.color); }
  });
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

/* ---------- Wire inputs (stable layout) ---------- */
function bindInputOnly(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", recomputeAndDraw, { passive: true });
}

// Units: input (live) + change (iOS fallback). No blur.
const unitsEl = document.getElementById("hours-units");
if (unitsEl) {
  unitsEl.addEventListener("input", recomputeAndDraw, { passive: true });
  unitsEl.addEventListener("change", recomputeAndDraw, { passive: true });
}

// Bind the rest with input only
["inclass","work","commute","sleep","meals","hygiene","exercise","family"]
  .forEach(key => bindInputOnly(`hours-${key}`));

// Prevent mouse-wheel from changing number fields while scrolling (desktop)
document.querySelectorAll('.tmc-rowctrl input[type="number"]').forEach(input=>{
  input.addEventListener('wheel', e => {
    if (document.activeElement === input) e.preventDefault();
  }, { passive:false });
});


/* ---------- First render ---------- */
recomputeAndDraw();













