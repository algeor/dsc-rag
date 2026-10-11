const state = {
  selected: "naive",
  lastResult: null,
  evalOn: false,
  evalData: null,
};

const steps = {
  naive: { mode: "naive", reset: true, disabled: [] },
  indexing: { mode: "context", disabled: ["metadata", "rewrite", "rerank", "authority"] },
  metadata: { mode: "context", disabled: ["rewrite", "rerank", "authority"] },
  rewrite: { mode: "context", disabled: ["rerank", "authority"] },
  rerank: { mode: "context", disabled: ["authority"] },
  authority: { mode: "context", disabled: [] },
  live: { mode: "live", disabled: [] },
  complete: { mode: "live", set_de: "complete", disabled: [] },
};

const RESPONSE_DELAY_MS = 500;

const el = {
  question: document.querySelector("#question"),
  brandTitle: document.querySelector("#brandTitle"),
  date: document.querySelector("#date"),
  steps: [...document.querySelectorAll(".step")],
  clearChatBtn: document.querySelector("#clearChatBtn"),
  status: document.querySelector("#status"),
  evalToggle: document.querySelector("#evalToggle"),
  evalReadout: document.querySelector("#evalReadout"),
  modeBadge: document.querySelector("#modeBadge"),
  chat: document.querySelector("#chat"),
  readiness: document.querySelector("#readiness"),
  partitions: document.querySelector("#partitions"),
  liveNote: document.querySelector("#liveNote"),
  trace: document.querySelector("#trace"),
  evidence: document.querySelector("#evidence"),
  rawJson: document.querySelector("#rawJson"),
  copyBtn: document.querySelector("#copyBtn"),
};

function syncHeroSizing() {
  if (!el.brandTitle) return;
  const width = Math.ceil(el.brandTitle.getBoundingClientRect().width);
  document.documentElement.style.setProperty("--brand-title-width", `${width}px`);
}

syncHeroSizing();

if (window.ResizeObserver && el.brandTitle) {
  new ResizeObserver(syncHeroSizing).observe(el.brandTitle);
} else {
  window.addEventListener("resize", syncHeroSizing);
}

function setStatus(text, tone = "") {
  el.status.textContent = text;
  el.status.style.color = tone || "var(--muted)";
}

function selectStep(name) {
  state.selected = name;
  el.steps.forEach((step) => step.classList.toggle("active", step.dataset.step === name));
  if (state.evalOn) renderEvalReadout();
}

// --- Eval overlay -------------------------------------------------------
// Precomputed, deterministic per-stage "answer-correctness" (% of the final
// answer's rubric each stage satisfies). Fetched once from /api/eval and cached;
// the readout shows the value for whichever stage is currently selected.
async function ensureEvalData() {
  if (state.evalData) return state.evalData;
  const response = await fetch("/api/eval");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Eval failed");
  state.evalData = data.result;
  return state.evalData;
}

function renderEvalReadout() {
  const data = state.evalData;
  if (!data) return;
  const pct = (data.correctness_by_key || {})[state.selected];
  const row = (data.rows || []).find((r) => r.key === state.selected);
  if (typeof pct !== "number") {
    el.evalReadout.hidden = true;
    return;
  }
  const band = pct < 40 ? "not-ready" : pct < 80 ? "unknown" : "ready";
  const passed = row ? row.correctness_passed : "?";
  const total = row ? row.correctness_total : "?";
  el.evalReadout.hidden = false;
  el.evalReadout.className = `eval-readout ${band}`;
  el.evalReadout.innerHTML = `
    <span class="eval-readout-label">ANSWER CORRECTNESS</span>
    <b class="eval-readout-num">${pct}%</b>
    <span class="eval-readout-sub">${passed}/${total} vs. final target</span>
  `;
}

async function setEvalOn(on) {
  state.evalOn = on;
  if (!on) {
    el.evalReadout.hidden = true;
    return;
  }
  try {
    el.evalReadout.hidden = false;
    el.evalReadout.className = "eval-readout";
    el.evalReadout.innerHTML = `<span class="eval-readout-label">EVAL…</span>`;
    await ensureEvalData();
    renderEvalReadout();
  } catch (error) {
    el.evalReadout.className = "eval-readout not-ready";
    el.evalReadout.innerHTML = `<span class="eval-readout-label">EVAL ERROR</span>`;
    setStatus(error.message, "var(--red)");
  }
}

function requestForSelected(extra = {}) {
  return {
    ...steps[state.selected],
    ...extra,
    question: el.question.value.trim(),
    date: el.date.value.trim() || "2026-10-09",
    backend: "offline",
  };
}

async function runDemo(payload) {
  setStatus("Running...", "var(--amber)");
  const turn = appendQuestionBubble(payload);

  try {
    const responsePromise = fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((response) => response.json());

    const [data] = await Promise.all([responsePromise, sleep(RESPONSE_DELAY_MS)]);
    if (!data.ok) throw new Error(data.error || "Demo failed");

    state.lastResult = data.result;
    render(data.result, turn);
    setStatus("Done", "var(--lime)");
  } catch (error) {
    appendErrorBubble(turn, error.message || "Demo failed");
    throw error;
  }
}

function render(result, turn) {
  el.modeBadge.textContent = describeMode(result);
  appendResponseBubble(turn, result);
  renderLive(result.live_status);
  renderTrace(result.trace || []);
  renderEvidence(result.evidence || []);
  el.rawJson.textContent = JSON.stringify(result, null, 2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendQuestionBubble(payload) {
  const empty = el.chat.querySelector(".empty-chat");
  if (empty) empty.remove();

  const turn = document.createElement("div");
  turn.className = "turn";

  const user = document.createElement("div");
  user.className = "bubble-row user";
  user.innerHTML = `
    <div class="bubble user">
      <p class="bubble-kicker">QUESTION · ${escapeHtml(describePayload(payload))}</p>
      <p class="bubble-text">${escapeHtml(payload.question)}</p>
    </div>
  `;

  turn.append(user);
  turn.append(createPendingResponseBubble());
  el.chat.append(turn);
  scrollTurnIntoView(turn);
  return turn;
}

function createPendingResponseBubble() {
  const assistant = document.createElement("div");
  assistant.className = "bubble-row assistant pending-row";
  assistant.innerHTML = `
    <div class="bubble assistant pending">
      <p class="bubble-kicker">RESPONSE</p>
      <div class="typing" aria-label="Generating response">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  return assistant;
}

function appendResponseBubble(turn, result) {
  const tone = answerTone(result);
  const assistant = turn.querySelector(".pending-row") || document.createElement("div");
  assistant.className = "bubble-row assistant reveal-row";
  assistant.innerHTML = `
    <div class="bubble assistant ${tone} reveal-content">
      <p class="bubble-kicker">RESPONSE</p>
      ${renderAnswer(result)}
    </div>
  `;

  if (!assistant.parentElement) turn.append(assistant);
  scrollTurnIntoView(turn);
}

function renderAnswer(result) {
  const summary = summarizeResult(result);
  const sourceChips = (result.evidence || [])
    .slice(0, 5)
    .map((doc) => `<span class="source-chip ${escapeHtml(doc.status)}">${escapeHtml(doc.id)}</span>`)
    .join("");

  return `
    <div class="answer-stack">
      <div class="answer-hero ${summary.tone}">
        <div class="answer-hero-body">
          <p class="answer-response">${renderAnswerText(result.answer)}</p>
        </div>
        <div class="answer-hero-aside">
          <span class="answer-pill ${summary.tone}">${escapeHtml(summary.status)}</span>
          <span class="answer-verdict">${escapeHtml(summary.label)}</span>
          ${renderConfidence(summary.confidence)}
        </div>
      </div>

      <div class="answer-record">
        <p class="answer-label">RECORD</p>
        <div class="answer-grid">
          <div class="answer-card">
            <p class="answer-label">TABLE</p>
            <strong class="breakable">${softBreakIdentifier(summary.table)}</strong>
          </div>
          <div class="answer-card">
            <p class="answer-label">READINESS</p>
            <strong>${escapeHtml(summary.readiness)}</strong>
          </div>
          <div class="answer-card">
            <p class="answer-label">WATCHOUT</p>
            <strong>${escapeHtml(summary.watchout)}</strong>
          </div>
        </div>

        ${renderPartitionStrip(result.live_status)}

        <div class="source-strip">
          <p class="answer-label">EVIDENCE USED</p>
          <div class="source-chips">${sourceChips || '<span class="source-chip">none</span>'}</div>
        </div>
      </div>
    </div>
  `;
}

// Renders the raw answer prose as the headline: one line per sentence,
// [citation] tags highlighted, and any inline JSON (e.g. partition readiness)
// turned into colored chips.
function renderAnswerText(answer) {
  const raw = answer || "";

  // 1. Pull inline JSON objects out behind placeholders so escaping/splitting
  //    don't touch them.
  const chipBlocks = [];
  const working = raw.replace(/\{[^{}]*\}/g, (match) => {
    try {
      const obj = JSON.parse(match);
      const chips = Object.entries(obj)
        .map(([key, value]) => {
          const status = String(value).toLowerCase();
          return `<span class="partition-chip ${escapeHtml(status)}"><b>${escapeHtml(key)}</b>${escapeHtml(String(value))}</span>`;
        })
        .join("");
      chipBlocks.push(`<span class="inline-chips">${chips}</span>`);
      return `@@CHIP${chipBlocks.length - 1}@@`;
    } catch {
      return match;
    }
  });

  // 2. Split into sentences for scannability (break after a period, or after
  //    an inline chip block, when a new capitalized sentence follows).
  const parts = working
    .split(/(?<=\.|@@)\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 3. Escape, highlight citations, restore chip placeholders — per line.
  return parts
    .map((part) => {
      let html = escapeHtml(part).replace(/\[([^\]]+)\]/g, '<span class="answer-cite">[$1]</span>');
      html = html.replace(/@@CHIP(\d+)@@/g, (_, i) => chipBlocks[Number(i)]);
      return `<span class="answer-line">${html}</span>`;
    })
    .join("");
}

function summarizeResult(result) {
  const answer = result.answer || "";
  const liveStatus = result.live_status;
  const conf = typeof result.confidence === "number" ? result.confidence : null;
  const recommendsLegacy = /finance\.daily_revenue/.test(answer) && !/finance\.fct_net_revenue_v2/.test(answer);
  const table = recommendsLegacy
    ? "finance.daily_revenue"
    : (answer.match(/finance\.fct_net_revenue_v2/)?.[0] || answer.match(/finance\.[a-z0-9_]+/i)?.[0] || "No table recommendation");
  const hasCurrency = /local currency|convert/i.test(answer);
  const needsLiveCheck = /freshness policy/i.test(answer);

  // Live check resolved → readiness is the headline.
  if (liveStatus && liveStatus.complete) {
    return {
      tone: "ready",
      status: "READY",
      label: "Ready, with caveats",
      table,
      readiness: "Expected partitions complete",
      watchout: "Still not proof of FX or all quality checks",
      confidence: conf,
    };
  }
  if (liveStatus) {
    return {
      tone: "not-ready",
      status: "NOT READY",
      label: "Correct table, blocked by live state",
      table,
      readiness: "Live check failed — a partition is incomplete",
      watchout: "Do not trust yesterday's data yet",
      confidence: conf,
    };
  }

  // No live check yet — quality depends on what retrieval surfaced.
  if (recommendsLegacy) {
    return {
      tone: "not-ready",
      status: "RISKY",
      label: "Confidently wrong — trusts a deprecated source",
      table,
      readiness: "Claims ready without any check",
      watchout: "Deprecated table + hallucinated freshness",
      confidence: conf,
    };
  }
  if (needsLiveCheck) {
    return {
      tone: "unknown",
      status: "NEEDS LIVE CHECK",
      label: "Right table; readiness needs a live check",
      table,
      readiness: "Freshness policy requires a live check",
      watchout: hasCurrency ? "Convert local currency before EU totals" : "Verify readiness before use",
      confidence: conf,
    };
  }
  return {
    tone: "unknown",
    status: "GROUNDED",
    label: "Right table; readiness unverified",
    table,
    readiness: "No live check ran",
    watchout: hasCurrency ? "Convert local currency before EU totals" : "Verify version and applicability",
    confidence: conf,
  };
}

function renderConfidence(conf) {
  if (typeof conf !== "number") return "";
  const band = conf < 40 ? "not-ready" : conf < 70 ? "unknown" : "ready";
  return `
    <div class="confidence ${band}">
      <span class="confidence-label">CONFIDENCE</span>
      <span class="confidence-track"><i style="width:${Math.max(0, Math.min(100, conf))}%"></i></span>
      <b class="confidence-num">${conf}</b>
    </div>
  `;
}

function renderPartitionStrip(status) {
  if (!status) return "";
  const chips = Object.entries(status.partitions || {})
    .map(([country, value]) => `<span class="partition-chip ${escapeHtml(value)}"><b>${escapeHtml(country)}</b>${escapeHtml(value)}</span>`)
    .join("");
  return `
    <div class="partition-strip">
      <p class="answer-label">LIVE PARTITIONS · ${escapeHtml(status.business_date)}</p>
      <div class="partition-chips">${chips}</div>
    </div>
  `;
}

function appendErrorBubble(turn, message) {
  const assistant = turn.querySelector(".pending-row") || document.createElement("div");
  assistant.className = "bubble-row assistant reveal-row";
  assistant.innerHTML = `
    <div class="bubble assistant not-ready reveal-content">
      <p class="bubble-kicker">RESPONSE</p>
      <p class="bubble-text">${escapeHtml(message)}</p>
    </div>
  `;
  if (!assistant.parentElement) turn.append(assistant);
  scrollTurnIntoView(turn);
}

function scrollTurnIntoView(turn) {
  // small pause before the scroll begins, so it doesn't drag off immediately
  window.setTimeout(() => {
    animateScroll(el.chat, Math.max(turn.offsetTop - 6, 0), 1600);
  }, 700);
}

// Smoothly scrolls `node` to `targetTop` over `duration` ms (ease-in-out).
// Higher duration = slower drag.
let scrollAnimId = null;
function animateScroll(node, targetTop, duration) {
  if (scrollAnimId !== null) {
    cancelAnimationFrame(scrollAnimId);
    scrollAnimId = null;
  }
  const startTop = node.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    node.scrollTop = targetTop;
    return;
  }
  const startTime = performance.now();
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    node.scrollTop = startTop + distance * easeInOut(progress);
    if (progress < 1) {
      scrollAnimId = requestAnimationFrame(tick);
    } else {
      scrollAnimId = null;
    }
  };
  scrollAnimId = requestAnimationFrame(tick);
}

function answerTone(result) {
  return summarizeResult(result).tone;
}

function describeMode(result) {
  const disabled = result.disabled?.length ? `, disabled: ${result.disabled.join(", ")}` : "";
  const trace = result.trace || [];
  const retrieval = trace.some((line) => line.startsWith("index:")) ? " · indexed" : "";
  const rerank = trace.some((line) => line.startsWith("rerank:")) ? " + reranked" : "";
  return `${result.mode}${retrieval}${rerank}${disabled}`;
}

function describePayload(payload) {
  const disabled = payload.disabled?.length ? `, disabled: ${payload.disabled.join(", ")}` : "";
  const mutation = payload.set_de ? `, DE=${payload.set_de}` : "";
  return `${payload.mode}${disabled}${mutation}`;
}

function renderLive(status) {
  el.partitions.innerHTML = "";
  el.partitions.classList.add("panel-refresh");
  window.setTimeout(() => el.partitions.classList.remove("panel-refresh"), 260);
  el.readiness.className = "readiness";

  if (!status) {
    el.readiness.textContent = "UNKNOWN";
    el.readiness.classList.add("unknown");
    el.liveNote.textContent = "No live check was performed.";
    return;
  }

  el.readiness.textContent = status.complete ? "READY" : "NOT READY";
  el.readiness.classList.add(status.complete ? "ready" : "not-ready");

  Object.entries(status.partitions || {}).forEach(([country, value]) => {
    const item = document.createElement("div");
    item.className = `partition ${value}`;
    item.innerHTML = `<span>${country}</span><strong>${value}</strong>`;
    el.partitions.append(item);
  });

  el.liveNote.textContent = status.note || `Checked ${status.business_date}`;
}

function renderTrace(trace) {
  el.trace.innerHTML = "";
  el.trace.classList.add("panel-refresh");
  window.setTimeout(() => el.trace.classList.remove("panel-refresh"), 260);
  if (!trace.length) {
    const item = document.createElement("li");
    item.textContent = "No trace returned.";
    el.trace.append(item);
    return;
  }
  trace.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    el.trace.append(item);
  });
}

function renderEvidence(docs) {
  el.evidence.innerHTML = "";
  el.evidence.classList.add("panel-refresh");
  window.setTimeout(() => el.evidence.classList.remove("panel-refresh"), 260);
  docs.forEach((doc, index) => {
    const card = document.createElement("div");
    card.className = "evidence-card";
    const preview = (doc.text || "").replace(/^# .*\n\n/, "").replace(/\s+/g, " ").trim();
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <div>
        <p class="doc-title">${escapeHtml(doc.id)} · ${escapeHtml(doc.title)}</p>
        <p class="doc-meta">${escapeHtml(doc.status)} · ${escapeHtml(doc.region)} · ${escapeHtml(doc.environment)} · ${escapeHtml(doc.access)}</p>
        <p class="doc-text">${escapeHtml(preview.slice(0, 210))}${preview.length > 210 ? "..." : ""}</p>
      </div>
      <div class="doc-kind">${escapeHtml(doc.kind)}</div>
    `;
    el.evidence.append(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function softBreakIdentifier(value) {
  return escapeHtml(value).replaceAll("_", "_<wbr>").replaceAll(".", ".<wbr>");
}

el.steps.forEach((step) => {
  step.addEventListener("click", async () => {
    selectStep(step.dataset.step);
    try {
      await runDemo(requestForSelected());
    } catch (error) {
      setStatus(error.message, "var(--red)");
    }
  });
});

el.copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(el.rawJson.textContent);
  setStatus("Copied JSON", "var(--lime)");
});

el.evalToggle.addEventListener("change", (event) => {
  setEvalOn(event.target.checked);
});

async function resetDemoState() {
  const payload = {
    mode: "live",
    disabled: [],
    question: el.question.value.trim(),
    date: el.date.value.trim() || "2026-10-09",
    backend: "offline",
    reset: true,
    set_de: "incomplete",
  };
  const response = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Reset failed");
  state.lastResult = data.result;
  el.modeBadge.textContent = "reset";
  renderLive(data.result.live_status);
  renderTrace(data.result.trace || []);
  renderEvidence(data.result.evidence || []);
  el.rawJson.textContent = JSON.stringify(data.result, null, 2);
}

el.clearChatBtn.addEventListener("click", async () => {
  el.chat.innerHTML = '<div class="empty-chat">Click a stage button to add the question and response.</div>';
  selectStep("naive");
  setStatus("Resetting...", "var(--amber)");
  try {
    await resetDemoState();
    setStatus("Chat cleared and demo reset", "var(--lime)");
  } catch (error) {
    setStatus(error.message, "var(--red)");
  }
});
selectStep("naive");
