import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/I551270/Downloads/rag-truth-demo";
const SKILL_DIR = "/Users/I551270/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations";
const RUNTIME_PYTHON = "/Users/I551270/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const TMP_DIR = path.join(workspaceDir, ".codex-build-rag-truth", "rendered");
const FINAL_PPTX = path.join(workspaceDir, "conference-deck", "rag-truth-data-stack-conference-v3.pptx");
const CANDIDATE = path.join(workspaceDir, ".codex-finalizer", "rag-truth-candidate.pptx");

const W = 1280;
const H = 720;
const EMU = "12192000,6858000";
const FONT = "Arial";

const C = {
  bg: "#02030A",
  panel: "#07111E",
  panel2: "#0A0D19",
  grid: "#111827",
  cyan: "#00E5FF",
  magenta: "#FF2BD6",
  lime: "#A6FF00",
  amber: "#FFD166",
  violet: "#8A5CFF",
  red: "#FF3B5F",
  white: "#F8FAFC",
  muted: "#93A4B8",
  dim: "#546070",
};

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function pos(left, top, width, height) {
  return { left, top, width, height };
}

function textbox(slide, text, p, style = {}) {
  const s = slide.shapes.add({
    geometry: "textbox",
    position: p,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  s.text = text;
  s.text.style = {
    typeface: FONT,
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    color: style.color ?? C.white,
    lineSpacing: style.lineSpacing ?? 1.05,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    wrap: "square",
    insets: style.insets ?? 0,
  };
  return s;
}

function box(slide, p, options = {}) {
  return slide.shapes.add({
    geometry: options.geometry ?? "roundRect",
    position: p,
    fill: options.fill ?? C.panel,
    line: { style: options.lineStyle ?? "solid", fill: options.line ?? C.cyan, width: options.width ?? 1.4 },
    borderRadius: options.radius ?? "rounded-lg",
  });
}

function label(slide, text, p, color = C.cyan, size = 16) {
  const b = box(slide, p, { fill: "#040812", line: color, width: 1.1, radius: "rounded-md" });
  const t = textbox(slide, text, { left: p.left + 10, top: p.top + 8, width: p.width - 20, height: p.height - 12 }, {
    fontSize: size,
    bold: true,
    color,
    alignment: "center",
    verticalAlignment: "middle",
  });
  return { b, t };
}

function node(slide, title, body, p, color = C.cyan, fill = C.panel) {
  const n = box(slide, p, { fill, line: color, width: 1.6, radius: "rounded-lg" });
  textbox(slide, title, pos(p.left + 18, p.top + 16, p.width - 36, 28), {
    fontSize: 19,
    bold: true,
    color,
  });
  textbox(slide, body, pos(p.left + 18, p.top + 50, p.width - 36, p.height - 62), {
    fontSize: 15,
    color: C.white,
    lineSpacing: 1.12,
  });
  return n;
}

function connect(slide, a, b, color = C.cyan, fromSide = "right", toSide = "left", dashed = false) {
  return slide.shapes.connect(a, b, {
    kind: "elbow",
    fromSide,
    toSide,
    line: { style: dashed ? "dashed" : "solid", fill: color, width: 2 },
    tail: { type: "arrow", width: "med", length: "med" },
  });
}

function footer(slide, num) {
  textbox(slide, String(num).padStart(2, "0"), pos(1138, 656, 70, 28), {
    fontSize: 14,
    color: C.dim,
    bold: true,
    alignment: "right",
  });
}

function title(slide, eyebrow, headline, sub, num) {
  textbox(slide, eyebrow, pos(72, 54, 560, 28), { fontSize: 13, bold: true, color: C.cyan });
  textbox(slide, headline, pos(72, 86, 880, 96), { fontSize: 40, bold: true, color: C.white, lineSpacing: 0.96 });
  if (sub) textbox(slide, sub, pos(72, 188, 860, 52), { fontSize: 19, color: C.muted, lineSpacing: 1.18 });
  footer(slide, num);
}

function addGrid(slide) {
  slide.background.fill = C.bg;
  for (let x = 0; x <= W; x += 80) {
    slide.shapes.add({ geometry: "connector", kind: "straight", position: pos(x, 0, 0, H), line: { fill: C.grid, width: 0.35 } });
  }
  for (let y = 0; y <= H; y += 80) {
    slide.shapes.add({ geometry: "connector", kind: "straight", position: pos(0, y, W, 0), line: { fill: C.grid, width: 0.35 } });
  }
}

function addNotes(slide, lines) {
  slide.speakerNotes.text = lines.join("\n");
}

function codeBlock(slide, text, p, accent = C.lime) {
  box(slide, p, { fill: "#030712", line: accent, width: 1.2, radius: "rounded-md" });
  textbox(slide, text, pos(p.left + 20, p.top + 18, p.width - 40, p.height - 34), {
    fontSize: 15,
    color: C.white,
    lineSpacing: 1.12,
  });
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

// 1
{
  const slide = presentation.slides.add();
  addGrid(slide);
  textbox(slide, "DATA STACK CONFERENCE", pos(76, 78, 500, 28), { fontSize: 14, bold: true, color: C.cyan });
  textbox(slide, "Where RAG truth gets lost", pos(76, 146, 760, 124), { fontSize: 56, bold: true, color: C.white, lineSpacing: 0.92 });
  textbox(slide, "A live demo of stale docs, missing context, runtime state, and the checks that keep answers honest.", pos(80, 302, 680, 72), { fontSize: 22, color: C.muted, lineSpacing: 1.18 });
  const a = node(slide, "Docs", "contracts, guides, Slack, incidents", pos(790, 120, 250, 96), C.cyan, "#06111C");
  const b = node(slide, "Retriever", "ranked evidence with traces", pos(908, 282, 250, 96), C.violet, "#0B0A1D");
  const c = node(slide, "Live state", "partition readiness from SQLite", pos(764, 446, 272, 96), C.lime, "#071608");
  connect(slide, a, b, C.cyan, "bottom", "top");
  connect(slide, b, c, C.lime, "bottom", "top");
  textbox(slide, "demo included", pos(82, 608, 260, 34), { fontSize: 18, bold: true, color: C.lime });
  footer(slide, 1);
  addNotes(slide, ["Sources: README_BG.md, PRESENTER_BG.md, scripts/demo.py."]);
}

// 2
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "SETUP", "One question contains two different risks", "The answer must identify the right table and decide whether yesterday's data can be trusted.", 2);
  const q = node(slide, "User question", "Which table should I use for EU net revenue, and can I trust yesterday's data?", pos(90, 288, 360, 130), C.white, "#080B15");
  const m = node(slide, "Meaning", "The metric definition lives in historical documents.", pos(620, 238, 280, 118), C.cyan, "#06111C");
  const n = node(slide, "Now", "Readiness lives in operational state.", pos(620, 430, 280, 118), C.lime, "#071608");
  connect(slide, q, m, C.cyan);
  connect(slide, q, n, C.lime);
  textbox(slide, "A good RAG answer needs both paths.", pos(940, 328, 210, 78), { fontSize: 27, bold: true, color: C.white, lineSpacing: 1.02 });
  addNotes(slide, ["Sources: README_BG.md, PRESENTER_BG.md."]);
}

// 3
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "IMPLEMENTATION", "The demo stack keeps every decision inspectable", "Each run returns an answer, retrieved evidence, live status, and a trace of the safeguards that fired.", 3);
  const docs = node(slide, "Synthetic corpus", "16 docs with contracts, legacy guides, incidents, snapshots, and Slack messages", pos(70, 306, 210, 154), C.cyan, "#06111C");
  const manifest = node(slide, "Manifest", "region, environment, status, access, kind", pos(316, 306, 190, 154), C.violet, "#0B0A1D");
  const retr = node(slide, "Retriever", "BM25 offline or MiniLM plus cross encoder", pos(542, 306, 204, 154), C.amber, "#141006");
  const policy = node(slide, "Authority", "contract beats migration, policy, incident, Slack", pos(784, 306, 202, 154), C.magenta, "#160715");
  const live = node(slide, "Live check", "fixed SQL reads partition readiness", pos(1024, 306, 190, 154), C.lime, "#071608");
  connect(slide, docs, manifest, C.cyan);
  connect(slide, manifest, retr, C.violet);
  connect(slide, retr, policy, C.amber);
  connect(slide, policy, live, C.lime);
  textbox(slide, "Answer", pos(1024, 485, 140, 30), { fontSize: 20, bold: true, color: C.white });
  addNotes(slide, ["Sources: scripts/demo.py, data/manifest.json."]);
}

// 4
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FAILURE 1", "Naive retrieval treats stale guidance like current truth", "BM25 can rank an old guide and a historical Slack shortcut above the contract that should govern the answer.", 4);
  const rows = [
    ["01_legacy", "deprecated guide", "finance.daily_revenue", C.red],
    ["07_slack_old", "deprecated Slack", "finance.daily_revenue", C.red],
    ["04_metric", "active contract", "definition only", C.amber],
    ["02_contract", "active contract", "canonical table", C.cyan],
  ];
  rows.forEach((r, i) => {
    const y = 282 + i * 72;
    box(slide, pos(92, y, 920, 54), { fill: i < 2 ? "#16070C" : "#06111C", line: r[3], width: 1.4, radius: "rounded-md" });
    textbox(slide, `#${i + 1}`, pos(110, y + 13, 42, 24), { fontSize: 18, bold: true, color: r[3] });
    textbox(slide, r[0], pos(172, y + 12, 156, 28), { fontSize: 20, bold: true, color: C.white });
    textbox(slide, r[1], pos(350, y + 14, 210, 24), { fontSize: 17, color: C.muted });
    textbox(slide, r[2], pos(612, y + 12, 270, 28), { fontSize: 19, bold: i < 2, color: r[3] });
  });
  textbox(slide, "Wrong-looking evidence can still sound confident.", pos(84, 596, 700, 36), { fontSize: 28, bold: true, color: C.magenta });
  addNotes(slide, ["Sources: data/example_naive.json, documents/01_legacy.md, documents/07_slack_old.md, documents/02_contract.md."]);
}

// 5
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FIX 1", "Scope and authority turn retrieval into evidence", "The improved path filters to EU, prod, active, internal sources, expands the query, then orders by source authority.", 5);
  const q = node(slide, "Question", "EU net revenue table and readiness", pos(82, 318, 170, 120), C.white, "#080B15");
  const f = node(slide, "Metadata filter", "EU, prod, active, internal", pos(306, 248, 190, 116), C.cyan, "#06111C");
  const r = node(slide, "Query expansion", "contract, VAT, refunds, currency, completeness", pos(544, 248, 220, 116), C.violet, "#0B0A1D");
  const a = node(slide, "Authority policy", "contract first, Slack last", pos(812, 248, 206, 116), C.magenta, "#160715");
  const out = node(slide, "Scoped evidence", "02_contract and 04_metric lead the answer", pos(546, 466, 260, 118), C.lime, "#071608");
  connect(slide, q, f, C.cyan);
  connect(slide, f, r, C.violet);
  connect(slide, r, a, C.magenta);
  connect(slide, a, out, C.lime, "bottom", "right");
  textbox(slide, "The trace proves which safeguards ran.", pos(848, 482, 260, 58), { fontSize: 25, bold: true, color: C.white, lineSpacing: 1.05 });
  addNotes(slide, ["Sources: scripts/demo.py, data/example_context.json."]);
}

// 6
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FAILURE 2", "Correct definitions still leave readiness unknown", "Context mode identifies the canonical table, but it cannot prove that yesterday's partitions finished.", 6);
  const contract = node(slide, "Historical evidence", "finance.fct_net_revenue_v2\nlocal currency\nVAT and refunds handled", pos(120, 300, 330, 178), C.cyan, "#06111C");
  const ans = node(slide, "Answer", "Use the v2 table. Current readiness is UNKNOWN because no live check ran.", pos(800, 300, 330, 178), C.amber, "#141006");
  connect(slide, contract, ans, C.amber);
  label(slide, "missing runtime proof", pos(496, 354, 252, 48), C.amber, 19);
  textbox(slide, "Docs can explain meaning. They cannot certify today's pipeline state.", pos(180, 560, 880, 48), { fontSize: 29, bold: true, color: C.white, alignment: "center" });
  addNotes(slide, ["Sources: data/example_context.json, PRESENTER_BG.md."]);
}

// 7
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FIX 2", "Live evidence gates the answer", "The live mode keeps the contract answer, then checks the operational partition table for the requested business date.", 7);
  const sql = node(slide, "Parameterized SQL", "asset = finance.fct_net_revenue_v2\nbusiness_date = 2026-10-09", pos(84, 278, 312, 142), C.lime, "#071608");
  const t1 = label(slide, "DE incomplete", pos(520, 254, 230, 56), C.red, 20).b;
  const t2 = label(slide, "FR complete", pos(520, 354, 230, 56), C.lime, 20).b;
  const t3 = label(slide, "PL complete", pos(520, 454, 230, 56), C.lime, 20).b;
  const gate = node(slide, "Readiness gate", "complete = false\nanswer says NOT ready", pos(898, 332, 260, 130), C.red, "#16070C");
  connect(slide, sql, t1, C.red);
  connect(slide, sql, t2, C.lime);
  connect(slide, sql, t3, C.lime);
  connect(slide, t1, gate, C.red);
  connect(slide, t2, gate, C.lime);
  connect(slide, t3, gate, C.lime);
  textbox(slide, "The response changes only when state changes.", pos(82, 582, 840, 40), { fontSize: 29, bold: true, color: C.white });
  addNotes(slide, ["Sources: data/example_live.json, scripts/demo.py, data/operations.sqlite."]);
}

// 8
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FAILURE 3", "A small context cut can remove the condition that matters", "The ablation truncates each document after the first sentence. That can hide currency, refunds, and completeness requirements.", 8);
  const doc = box(slide, pos(92, 260, 480, 230), { fill: "#06111C", line: C.cyan, width: 1.3, radius: "rounded-lg" });
  textbox(slide, "Full contract", pos(122, 286, 240, 30), { fontSize: 22, bold: true, color: C.cyan });
  textbox(slide, "Canonical asset: finance.fct_net_revenue_v2.\nDaily net revenue excludes VAT and subtracts refunds.\nAmounts are in local currency.\nCompleteness must be checked separately.", pos(122, 334, 390, 112), { fontSize: 18, color: C.white, lineSpacing: 1.18 });
  const cut = box(slide, pos(712, 260, 480, 230), { fill: "#160715", line: C.magenta, width: 1.3, radius: "rounded-lg" });
  textbox(slide, "Truncated context", pos(742, 286, 280, 30), { fontSize: 22, bold: true, color: C.magenta });
  textbox(slide, "Canonical asset: finance.fct_net_revenue_v2.", pos(742, 356, 360, 38), { fontSize: 20, color: C.white, lineSpacing: 1.15 });
  connect(slide, doc, cut, C.magenta);
  textbox(slide, "The table survives. The safety conditions disappear.", pos(170, 560, 940, 42), { fontSize: 30, bold: true, color: C.white, alignment: "center" });
  addNotes(slide, ["Sources: scripts/demo.py ablation behavior, documents/02_contract.md."]);
}

// 9
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "FAILURE 4", "A polished demo can hide the missing evaluation", "The starter kit proves the control flow. It does not claim retrieval quality, groundedness, latency, or cost improvement.", 9);
  const table = slide.tables.add({
    rows: 5,
    columns: 3,
    left: 106,
    top: 272,
    width: 980,
    height: 262,
    values: [
      ["Check", "Demo covers", "Real evaluation needs"],
      ["Retrieval", "Inspectable evidence", "Labelled query set"],
      ["Grounding", "Cited synthetic docs", "Answer faithfulness scoring"],
      ["Abstention", "Unknown readiness path", "False confidence tests"],
      ["Operations", "SQLite state change", "Latency and cost tracking"],
    ],
  });
  table.styleOptions = { headerRow: true, bandedRows: false };
  table.borders.assign({ style: "solid", fill: C.violet, width: 0.8 });
  for (let c = 0; c < 3; c++) {
    table.getCell(0, c).fill = "#160715";
    table.getCell(0, c).text.style = { typeface: FONT, fontSize: 17, bold: true, color: C.magenta, alignment: "left" };
  }
  for (let r = 1; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      table.getCell(r, c).fill = r % 2 ? "#07111E" : "#050816";
      table.getCell(r, c).text.style = { typeface: FONT, fontSize: 16, color: c === 2 ? C.lime : C.white, alignment: "left" };
    }
  }
  textbox(slide, "A demo earns attention. Measurement earns trust.", pos(146, 578, 900, 40), { fontSize: 30, bold: true, color: C.white, alignment: "center" });
  addNotes(slide, ["Sources: README_BG.md limitations and check_demo.py description."]);
}

// 10
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "DEMO RUNBOOK", "Five commands show the failure and the fix", "The demo is short enough for the stage, with JSON outputs ready as a fallback.", 10);
  const steps = [
    ["1", "naive", "old guide can rank high"],
    ["2", "context", "contract wins, readiness unknown"],
    ["3", "live", "DE incomplete blocks trust"],
    ["4", "set complete", "DE flips the answer"],
    ["5", "disable live", "readiness becomes unknown again"],
  ];
  const stepDots = [];
  steps.forEach((s, i) => {
    const x = 88 + i * 224;
    const n = label(slide, s[0], pos(x, 318, 44, 44), i === 2 ? C.red : C.cyan, 18).b;
    stepDots.push(n);
    const card = node(slide, s[1], s[2], pos(x - 18, 386, 180, 104), i === 2 ? C.red : i === 3 ? C.lime : C.cyan, i === 2 ? "#16070C" : "#06111C");
    void card;
    if (i > 0) {
      connect(slide, stepDots[i - 1], n, C.violet, "right", "left");
    }
  });
  codeBlock(slide, "python3 scripts/demo.py --mode naive --reset\npython3 scripts/demo.py --mode context\npython3 scripts/demo.py --mode live\npython3 scripts/demo.py --mode live --set-de complete\npython3 scripts/demo.py --mode live --disable live", pos(156, 518, 930, 148), C.lime);
  addNotes(slide, ["Sources: README_BG.md, PRESENTER_BG.md."]);
}

// 11
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "HARDENING PATTERN", "Truth needs a contract and a clock", "Separate stable meaning from live applicability, then make the answer name the evidence behind each part.", 11);
  const left = node(slide, "Contract plane", "schemas\nmetric definitions\nowners\nauthority", pos(180, 296, 300, 190), C.cyan, "#06111C");
  const right = node(slide, "Runtime plane", "freshness\ncoverage\nincidents\nquality gates", pos(800, 296, 300, 190), C.lime, "#071608");
  const center = node(slide, "Answer composer", "cite sources\nstate uncertainty\nblock when readiness fails", pos(490, 302, 300, 178), C.violet, "#0B0A1D");
  connect(slide, left, center, C.cyan);
  connect(slide, right, center, C.lime, "left", "right");
  label(slide, "historical meaning", pos(218, 234, 220, 42), C.cyan, 17);
  label(slide, "current state", pos(846, 234, 210, 42), C.lime, 17);
  addNotes(slide, ["Sources: scripts/demo.py, README_BG.md limitations."]);
}

// 12
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "STATE CHANGE", "No doc changed, but the answer changed", "After DE moves to complete, the same contract remains valid and the readiness decision flips.", 12);
  const before = node(slide, "Before", "DE incomplete\nFR complete\nPL complete", pos(122, 304, 300, 150), C.red, "#16070C");
  const after = node(slide, "After", "DE complete\nFR complete\nPL complete", pos(858, 304, 300, 150), C.lime, "#071608");
  const cmd = node(slide, "Mutation", "--set-de complete", pos(496, 330, 288, 98), C.violet, "#0B0A1D");
  connect(slide, before, cmd, C.violet);
  connect(slide, cmd, after, C.lime);
  textbox(slide, "This proves partition readiness only. FX and quality checks still need their own gates.", pos(182, 560, 920, 42), { fontSize: 27, bold: true, color: C.amber, alignment: "center" });
  addNotes(slide, ["Sources: PRESENTER_BG.md, README_BG.md limitations, scripts/demo.py."]);
}

// 13
{
  const slide = presentation.slides.add();
  addGrid(slide);
  title(slide, "TAKEAWAY", "RAG gets safer when uncertainty becomes visible", "The stack does not need magic. It needs scoped retrieval, source authority, live evidence, and measured failure cases.", 13);
  const a = label(slide, "Scoped retrieval", pos(142, 324, 214, 58), C.cyan, 19).b;
  const b = label(slide, "Authority policy", pos(390, 324, 214, 58), C.magenta, 19).b;
  const c = label(slide, "Live evidence", pos(638, 324, 214, 58), C.lime, 19).b;
  const d = label(slide, "Evaluation", pos(886, 324, 214, 58), C.amber, 19).b;
  connect(slide, a, b, C.cyan);
  connect(slide, b, c, C.magenta);
  connect(slide, c, d, C.lime);
  textbox(slide, "When evidence conflicts, the system should show its work before it answers.", pos(184, 476, 910, 56), { fontSize: 34, bold: true, color: C.white, alignment: "center", lineSpacing: 1.02 });
  addNotes(slide, ["Sources: full demo package in this repository."]);
}

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(CANDIDATE), { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await writeBlob(path.join(TMP_DIR, `slide-${String(index + 1).padStart(2, "0")}.png`), png);
}
const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await writeBlob(path.join(TMP_DIR, "montage.webp"), montage);

await (await PresentationFile.exportPptx(presentation)).save(CANDIDATE);

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);
await finalizePresentation({
  explicitTotalSlideCount: 13,
  requiredNativeTableOwnerSlides: [9],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath: CANDIDATE,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", EMU,
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "9",
  ],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "rag-truth-data-stack-conference-v3.validation.json"),
});

console.log(JSON.stringify({ final: FINAL_PPTX, previews: TMP_DIR }, null, 2));
