// Uses Chart.js (MIT License) – chartjs.org
// See LICENSE.txt for license text.

const WEEK_HOURS = 168;
const STUDY_MULTIPLIER = 3; // units × 3 hours out of class

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
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(imgEl, cx - radius, cy - radius, side, side);
    ctx.restore();
  }
};

/* ---------- Categories ---------- */
const catDefs = [
  { key: "study", label: "Study (out of class)", color: "#4ADE80" },
  { key: "inclass", label: "In class / Direct Instruction", color: "#60A5FA" },
  { key: "work", label: "Work (job)", color: "#F59E0B" },
  { key: "commute", label: "Commute", color: "#FCD34D" },
  { key: "sleep", label: "Sleep", color: "#8B5CF6" },
  { key: "meals", label: "Meals", color: "#FB7185" },
  { key: "hygiene", label: "Hygiene / personal care", color: "#A78BFA" },
  { key: "exercise", label: "Exercise / movement", color: "#34D399" },
  { key: "family", label: "Family / caregiving", color: "#F472B6" }
];

const $ = (sel) => document.querySelector(sel);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/* ---------- Parse helpers ---------- */
const getIntField = (id, min = 0, max = 168) => {
  const el = $(id);
  const n = parseInt(el.value, 10);
  const v = Number.isFinite(n) ? clamp(n, min, max) : 0;
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

/* ---------- Read all inputs ---------- */
function readAll() {
  const { study } = computeStudyFromUnits();

  const vals = { study };
  catDefs.forEach((c) => {
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
    warn.textContent = `You’re over the 168 hour week by ${overage} hour${overage === 1 ? "" : "s"}. Please adjust your entries.`;
  } else {
    warn.hidden = true;
    warn.textContent = "";
  }
}

/* ---------- Accessible chart summary ---------- */
function renderChartSummary(vals, remaining, overage) {
  const summaryEl = $("#chartSummary");
  if (!summaryEl) return;

  const parts = [];

  catDefs.forEach((c) => {
    const value = vals[c.key] || 0;
    const pct = ((value / WEEK_HOURS) * 100).toFixed(1);
    parts.push(`${c.label}: ${value} hours (${pct} percent)`);
  });

  if (overage > 0) {
    const pct = ((overage / WEEK_HOURS) * 100).toFixed(1);
    parts.push(`Over by: ${overage} hours (${pct} percent)`);
  } else {
    const pct = ((remaining / WEEK_HOURS) * 100).toFixed(1);
    parts.push(`Remaining: ${remaining} hours (${pct} percent)`);
  }

  summaryEl.textContent = `Weekly time allocation summary. ${parts.join(". ")}.`;
}

/* ---------- Chart ---------- */
const ctx = document.getElementById("timeDonut");

const chart = new Chart(ctx, {
  type: "doughnut",
  data: {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderWidth: 0
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        onClick: () => {},
        onHover: (e) => {
          e.native.target.style.cursor = "default";
        },
        labels: {
          color:
            getComputedStyle(document.querySelector(".tmc-app"))
              .getPropertyValue("--tmc-text") || "#1f2937",

          generateLabels(chart) {
            const data = chart.data;
            const dataset = data.datasets[0];
            const values = dataset.data || [];

            return data.labels.map((label, i) => {
              const value = values[i] || 0;
              const pct = ((value / WEEK_HOURS) * 100).toFixed(1);

              return {
                text: `${label} (${pct}%)`,
                fillStyle: dataset.backgroundColor[i],
                strokeStyle: dataset.backgroundColor[i],
                lineWidth: 0,
                hidden: false,
                index: i
              };
            });
          }
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
      tmcCenterImage: {
        imageId: "tmc-mascot",
        scale: 0.85
      }
    },
    layout: {
      padding: 10
    },
    cutout: "60%"
  },
  plugins: [mascotCenterPlugin]
});

/* ---------- Mascot refresh ---------- */
const mascotEl = document.getElementById("tmc-mascot");

function refreshWhenMascotReady() {
  if (!mascotEl) {
    try {
      chart.update();
    } catch (_) {}
    return;
  }

  const draw = () => {
    try {
      chart.update();
    } catch (_) {}
  };

  if (mascotEl.complete && mascotEl.naturalWidth > 0) {
    draw();
  } else {
    mascotEl.addEventListener("load", draw, { once: true });
  }

  try {
    if (typeof mascotEl.decode === "function") {
      mascotEl.decode().then(draw).catch(() => {});
    }
  } catch (_) {}
}

/* ---------- Recompute + redraw ---------- */
function recomputeAndDraw() {
  const vals = readAll();
  const used = Object.values(vals).reduce((s, v) => s + v, 0);
  const remaining = Math.max(0, WEEK_HOURS - used);
  const overage = Math.max(0, used - WEEK_HOURS);

  const labels = [];
  const data = [];
  const bg = [];

  catDefs.forEach((c) => {
    const v = vals[c.key];
    if (v > 0) {
      labels.push(c.label);
      data.push(v);
      bg.push(c.color);
    }
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
  renderChartSummary(vals, remaining, overage);
}

/* ---------- Wire inputs ---------- */
["units", "inclass", "work", "commute", "sleep", "meals", "hygiene", "exercise", "family"].forEach((key) => {
  const el = document.getElementById(`hours-${key}`);
  if (el) el.addEventListener("input", recomputeAndDraw);
});

/* Prevent mouse wheel from changing number fields while scrolling */
document.querySelectorAll('.tmc-rowctrl input[type="number"]').forEach((input) => {
  input.addEventListener(
    "wheel",
    (e) => {
      if (document.activeElement === input) e.preventDefault();
    },
    { passive: false }
  );
});

/* ---------- First render ---------- */
document.addEventListener("DOMContentLoaded", () => {
  recomputeAndDraw();
  refreshWhenMascotReady();
});

window.addEventListener("load", refreshWhenMascotReady);
