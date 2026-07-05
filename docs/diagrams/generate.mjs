#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
//
// Deterministic generator for the /docs Excalidraw diagrams.
//
// Why a generator instead of hand-drawn files?
//   - Zero-dependency Node, matching the kit's own ethos.
//   - Deterministic output (fixed seeds + timestamp) => clean git diffs when
//     a diagram changes, instead of a fully-rewritten binary-ish blob.
//   - The .excalidraw files it emits are ordinary Excalidraw scenes: open them
//     at https://excalidraw.com or with the VS Code "Excalidraw" extension and
//     edit by hand. If you prefer to keep this script as the source of truth,
//     edit here and re-run `node docs/diagrams/generate.mjs`.
//
// Emits (next to this file):
//   01-system-map.excalidraw       — what this codebase is & what it does
//   02-evolution-journey.excalidraw — v0.1.0 -> now: AI-native -> spec+loop
//   03-engineering-loop.excalidraw  — the steady-state closed development loop

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const UPDATED = 1751500000000; // fixed timestamp -> deterministic files

// Excalidraw default palette (stroke + soft background pairs).
const C = {
  blue:   { s: '#1971c2', b: '#a5d8ff' },
  green:  { s: '#2f9e44', b: '#b2f2bb' },
  yellow: { s: '#f08c00', b: '#ffec99' },
  red:    { s: '#e03131', b: '#ffc9c9' },
  violet: { s: '#6741d9', b: '#d0bfff' },
  cyan:   { s: '#0c8599', b: '#99e9f2' },
  gray:   { s: '#495057', b: '#e9ecef' },
  ink:    { s: '#1e1e1e', b: 'transparent' },
};

class Diagram {
  constructor() {
    this.els = [];
    this._seed = 1000;
    this._id = 0;
    this.byId = new Map();
  }
  seed() { return (this._seed += 7); }
  uid(p) { return `${p}-${++this._id}`; }

  push(el) { this.els.push(el); this.byId.set(el.id, el); return el; }

  base(type, extra) {
    return {
      id: this.uid(type), type,
      angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
      fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
      roughness: 1, opacity: 100, groupIds: [], frameId: null,
      roundness: null, seed: this.seed(), version: 1, versionNonce: this.seed(),
      isDeleted: false, boundElements: [], updated: UPDATED, link: null,
      locked: false, ...extra,
    };
  }

  // A rounded/sharp rectangle with an optional centred, container-bound label.
  box(x, y, w, h, label, opts = {}) {
    const {
      color = C.blue, fontSize = 16, sharp = false, strokeWidth = 2,
      strokeStyle = 'solid', textColor, fontFamily = 1, opacity = 100,
    } = opts;
    const rect = this.push(this.base('rectangle', {
      x, y, width: w, height: h,
      strokeColor: color.s, backgroundColor: color.b,
      strokeWidth, strokeStyle, opacity,
      roundness: sharp ? null : { type: 3 },
    }));
    if (label != null) {
      this.boundText(rect, label, { fontSize, color: textColor || '#1e1e1e', fontFamily });
    }
    return rect;
  }

  boundText(container, text, opts = {}) {
    const { fontSize = 16, color = '#1e1e1e', fontFamily = 1, align = 'center' } = opts;
    const lineHeight = 1.25;
    const lines = String(text).split('\n');
    const th = Math.round(lines.length * fontSize * lineHeight);
    const tw = Math.min(
      container.width - 12,
      Math.round(Math.max(...lines.map((l) => l.length)) * fontSize * 0.56),
    );
    const t = this.push(this.base('text', {
      x: Math.round(container.x + container.width / 2 - tw / 2),
      y: Math.round(container.y + container.height / 2 - th / 2),
      width: tw, height: th, strokeColor: color,
      text, fontSize, fontFamily, textAlign: align, verticalAlign: 'middle',
      containerId: container.id, originalText: text, lineHeight,
      baseline: Math.round(fontSize * 0.9),
    }));
    container.boundElements = [...(container.boundElements || []), { type: 'text', id: t.id }];
    return t;
  }

  // Free-standing text (titles, captions, legend rows).
  text(x, y, text, opts = {}) {
    const { fontSize = 20, color = '#1e1e1e', align = 'left', fontFamily = 1, bold } = opts;
    const lineHeight = 1.25;
    const lines = String(text).split('\n');
    const th = Math.round(lines.length * fontSize * lineHeight);
    const tw = Math.round(Math.max(...lines.map((l) => l.length)) * fontSize * 0.56);
    return this.push(this.base('text', {
      x, y, width: tw, height: th, strokeColor: color,
      strokeWidth: bold ? 4 : 2,
      text, fontSize, fontFamily, textAlign: align, verticalAlign: 'top',
      containerId: null, originalText: text, lineHeight,
      baseline: Math.round(fontSize * 0.9),
    }));
  }

  // A large, low-emphasis backdrop panel (drawn first so it sits behind).
  panel(x, y, w, h, color, opts = {}) {
    return this.base('rectangle', {
      x, y, width: w, height: h,
      strokeColor: color.s, backgroundColor: color.b,
      fillStyle: 'solid', strokeStyle: opts.strokeStyle || 'solid',
      strokeWidth: 1, opacity: opts.opacity ?? 22, roundness: { type: 3 },
    });
  }

  static edgePoint(box, tx, ty, gap = 6) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return [cx, cy];
    const hw = box.width / 2, hh = box.height / 2;
    const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    const len = Math.hypot(dx, dy);
    return [cx + dx * s + (dx / len) * gap, cy + dy * s + (dy / len) * gap];
  }

  arrow(from, to, opts = {}) {
    const {
      color = C.gray.s, dashed = false, label, both = false, strokeWidth = 2,
    } = opts;
    const fc = [from.x + from.width / 2, from.y + from.height / 2];
    const tc = [to.x + to.width / 2, to.y + to.height / 2];
    const [sx, sy] = Diagram.edgePoint(from, tc[0], tc[1]);
    const [ex, ey] = Diagram.edgePoint(to, fc[0], fc[1]);
    const a = this.push(this.base('arrow', {
      x: sx, y: sy, width: ex - sx, height: ey - sy,
      strokeColor: color, strokeWidth,
      strokeStyle: dashed ? 'dashed' : 'solid',
      roundness: { type: 2 },
      points: [[0, 0], [ex - sx, ey - sy]],
      lastCommittedPoint: null,
      startBinding: { elementId: from.id, focus: 0, gap: 6 },
      endBinding: { elementId: to.id, focus: 0, gap: 6 },
      startArrowhead: both ? 'arrow' : null, endArrowhead: 'arrow',
    }));
    from.boundElements = [...(from.boundElements || []), { type: 'arrow', id: a.id }];
    to.boundElements = [...(to.boundElements || []), { type: 'arrow', id: a.id }];
    if (label) {
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const lineHeight = 1.25;
      const tw = Math.round(label.length * 13 * 0.56);
      const t = this.push(this.base('text', {
        x: Math.round(mx - tw / 2), y: Math.round(my - 8),
        width: tw, height: Math.round(13 * lineHeight), strokeColor: color,
        text: label, fontSize: 13, fontFamily: 1, textAlign: 'center',
        verticalAlign: 'middle', containerId: a.id, originalText: label,
        lineHeight, baseline: 12,
      }));
      a.boundElements = [...(a.boundElements || []), { type: 'text', id: t.id }];
    }
    return a;
  }

  // A free poly-line arrow through explicit absolute points (for the loop cycle).
  polyArrow(pts, opts = {}) {
    const { color = C.gray.s, dashed = false, strokeWidth = 2.5 } = opts;
    const [ox, oy] = pts[0];
    return this.push(this.base('arrow', {
      x: ox, y: oy,
      width: Math.max(...pts.map((p) => p[0])) - ox,
      height: Math.max(...pts.map((p) => p[1])) - oy,
      strokeColor: color, strokeWidth,
      strokeStyle: dashed ? 'dashed' : 'solid',
      roundness: { type: 2 },
      points: pts.map(([x, y]) => [x - ox, y - oy]),
      lastCommittedPoint: null, startBinding: null, endBinding: null,
      startArrowhead: null, endArrowhead: 'arrow',
    }));
  }

  toScene() {
    return {
      type: 'excalidraw', version: 2,
      source: 'ai-fication-kit/docs/diagrams/generate.mjs',
      elements: this.els,
      appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
      files: {},
    };
  }

  // A dependency-free SVG preview so the diagrams render in GitHub / any browser
  // without Excalidraw. Deliberately plain (no hand-drawn font, straight lines);
  // the .excalidraw file remains the editable source.
  toSVG() {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rects = this.els.filter((e) => e.type === 'rectangle');
    const arrows = this.els.filter((e) => e.type === 'arrow');
    const texts = this.els.filter((e) => e.type === 'text');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of this.els) {
      // Consider both corners: arrows can carry negative width/height (they run
      // left/up), so e.x+width may be smaller than e.x. Min/max over both ends.
      const x2 = e.x + (e.width || 0), y2 = e.y + (e.height || 0);
      minX = Math.min(minX, e.x, x2); minY = Math.min(minY, e.y, y2);
      maxX = Math.max(maxX, e.x, x2); maxY = Math.max(maxY, e.y, y2);
    }
    const pad = 24;
    const vb = `${Math.floor(minX - pad)} ${Math.floor(minY - pad)} ${Math.ceil(maxX - minX + 2 * pad)} ${Math.ceil(maxY - minY + 2 * pad)}`;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
    out.push(`<rect x="${Math.floor(minX - pad)}" y="${Math.floor(minY - pad)}" width="${Math.ceil(maxX - minX + 2 * pad)}" height="${Math.ceil(maxY - minY + 2 * pad)}" fill="#ffffff"/>`);
    out.push('<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>');
    for (const e of rects) {
      const op = (e.opacity ?? 100) / 100;
      const rx = e.roundness ? 12 : 0;
      out.push(`<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${rx}" fill="${e.backgroundColor}" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}" ${e.strokeStyle === 'dashed' ? 'stroke-dasharray="8 6"' : ''} opacity="${op}"/>`);
    }
    for (const a of arrows) {
      const pts = a.points.map(([px, py]) => `${a.x + px},${a.y + py}`).join(' ');
      out.push(`<polyline points="${pts}" fill="none" stroke="${a.strokeColor}" stroke-width="${a.strokeWidth}" ${a.strokeStyle === 'dashed' ? 'stroke-dasharray="7 6"' : ''} marker-end="url(#ah)" ${a.startArrowhead === 'arrow' ? 'marker-start="url(#ah)"' : ''}/>`);
    }
    const arrowIds = new Set(arrows.map((a) => a.id));
    for (const t of texts) {
      const lineH = t.fontSize * t.lineHeight;
      const lines = t.text.split('\n');
      const anchor = t.textAlign === 'center' ? 'middle' : 'start';
      const tx = t.textAlign === 'center' ? t.x + t.width / 2 : t.x;
      const weight = t.strokeWidth >= 4 ? '700' : '400';
      // Arrow labels: paint a white gap behind the text so the line doesn't
      // strike through it (Excalidraw breaks the stroke around bound labels).
      if (arrowIds.has(t.containerId)) {
        out.push(`<rect x="${Math.round(t.x - 3)}" y="${Math.round(t.y - 1)}" width="${Math.round(t.width + 6)}" height="${Math.round(lines.length * lineH + 2)}" fill="#ffffff"/>`);
      }
      lines.forEach((ln, i) => {
        const ty = t.y + t.fontSize * 0.95 + i * lineH;
        out.push(`<text x="${Math.round(tx)}" y="${Math.round(ty)}" font-size="${t.fontSize}" font-weight="${weight}" text-anchor="${anchor}" fill="${t.strokeColor}">${esc(ln)}</text>`);
      });
    }
    out.push('</svg>');
    return out.join('\n');
  }
}

/* ------------------------------------------------------------------ */
/* Diagram 1 — System map: what this codebase is & what it does        */
/* ------------------------------------------------------------------ */
function systemMap() {
  const d = new Diagram();
  d.text(40, 24, 'ai-fication-kit — System Map', { fontSize: 30, bold: true });
  d.text(40, 66, 'A zero-dependency Node CLI that stamps a provenance-tracked ai/ knowledge layer into any legacy repo —', { fontSize: 15, color: '#495057' });
  d.text(40, 88, 'so an AI agent reads a trusted, human-verified map instead of re-crawling and guessing.', { fontSize: 15, color: '#495057' });

  // --- Left: the kit / CLI ---
  d.els.unshift(d.panel(30, 130, 300, 470, C.gray));
  d.text(48, 142, 'THE KIT  (this repo)', { fontSize: 15, bold: true, color: '#495057' });
  const cli = d.box(60, 176, 240, 56, 'install.mjs\nCLI — dispatch only, no logic', { color: C.gray, fontSize: 14 });

  // three producer lanes
  const detA = d.box(48, 260, 264, 120,
    'DETERMINISTIC scripts  (no LLM)\n\norient · indepth · maturity\nverify · drift · status/doctor · update',
    { color: C.green, fontSize: 13 });
  const infA = d.box(48, 400, 264, 96,
    'MODEL INFERENCE  (AI agent)\n\n/cold-start · /create-feature-catalog\neverything it writes = [inferred]',
    { color: C.violet, fontSize: 13 });
  const humA = d.box(48, 516, 264, 70,
    'HUMAN  (the trust boundary)\nthe audit — set Stability,\nflip [inferred] → [verified]',
    { color: C.yellow, fontSize: 13 });
  d.arrow(cli, detA, { color: C.gray.s, label: 'runs' });
  // (the inference lane is driven by the AI agent's slash commands, not the CLI)

  // --- Center: the ai/ knowledge layer (the product) ---
  d.els.unshift(d.panel(400, 150, 360, 450, C.blue));
  d.text(420, 162, 'ai/  — the shared knowledge layer', { fontSize: 16, bold: true, color: '#1971c2' });
  const profile = d.box(420, 200, 320, 52, 'ai/repo-profile.json  ·  repo-indepth.json\ndeterministic machine-readable facts', { color: C.cyan, fontSize: 13 });
  const guide = d.box(420, 268, 320, 78, 'ai/guide/\nMODULE_MAP · ARCHITECTURE · FEATURE_MAP\nPROJECT_OVERVIEW · CONVENTIONS', { color: C.blue, fontSize: 13 });
  const analysis = d.box(420, 362, 320, 66, 'ai/analysis/\nFEATURE_CATALOG · diagrams ·\naudit reports (maturity / drift / verify)', { color: C.blue, fontSize: 13 });
  const lab = d.box(420, 444, 320, 88, 'ai/lab/\nspecs · decisions (ADRs) · reviews ·\nevaluations · ROADMAP · WORKLOG', { color: C.blue, fontSize: 13 });
  d.text(420, 548, 'Every ai/ claim ships [inferred]; only the human audit', { fontSize: 12, color: '#495057' });
  d.text(420, 566, 'flips it to [verified]. Agents are forbidden to self-certify.', { fontSize: 12, color: '#495057' });

  // scripts + agent write into the layer; human gates it
  d.arrow(detA, profile, { color: C.green.s, label: 'writes facts' });
  d.arrow(infA, guide, { color: C.violet.s, label: 'drafts [inferred]' });
  d.arrow(humA, lab, { color: C.yellow.s, label: 'verifies', dashed: true });
  // guards
  const guards = d.box(420, 150, 320, 0); // placeholder not used
  d.els.pop(); d.byId.delete(guards.id);

  // --- Right: consumers ---
  d.els.unshift(d.panel(820, 200, 300, 340, C.red));
  d.text(838, 212, 'WHO READS THE MAP', { fontSize: 15, bold: true, color: '#e03131' });
  const agents = d.box(838, 250, 264, 96, 'Any AI coding agent\nClaude Code · Cursor · Copilot ·\nCodex · Antigravity\n(reads the same maps)', { color: C.red, fontSize: 13 });
  const team = d.box(838, 372, 264, 74, 'New teammates\nfastest onboarding doc —\nwhat is safe to touch & why', { color: C.red, fontSize: 13 });
  const guard = d.box(838, 470, 264, 52, 'verify + drift (CI)\nkeep the map honest as code moves', { color: C.green, fontSize: 13 });
  d.arrow(guide, agents, { color: C.red.s, label: 'read on demand' });
  d.arrow(lab, team, { color: C.red.s });
  d.arrow(guard, analysis, { color: C.green.s, label: 'audits', dashed: true });

  // legend
  d.text(40, 620, 'green = deterministic (no LLM)    violet = agent inference ([inferred])    yellow = human ([verified])    blue = the ai/ product', { fontSize: 12, color: '#868e96' });
  return d;
}

/* ------------------------------------------------------------------ */
/* Diagram 2 — The journey: AI-native -> spec + loop engineering       */
/* ------------------------------------------------------------------ */
function evolutionJourney() {
  const d = new Diagram();
  d.text(40, 24, 'The journey since v0.1.0', { fontSize: 30, bold: true });
  d.text(40, 66, 'How ai-fication-kit grew from "make a legacy repo AI-native" into "spec + closed-loop engineering".', { fontSize: 15, color: '#495057' });

  // Two era backdrops
  d.els.unshift(d.panel(30, 150, 560, 430, C.blue));
  d.els.unshift(d.panel(610, 150, 540, 430, C.violet));
  d.text(48, 160, 'ERA 1 — AI-NATIVE MAPPING', { fontSize: 16, bold: true, color: '#1971c2' });
  d.text(48, 182, 'stop the agent from guessing: give it a trusted map', { fontSize: 13, color: '#495057' });
  d.text(628, 160, 'ERA 2 — SPEC + LOOP ENGINEERING', { fontSize: 16, bold: true, color: '#6741d9' });
  d.text(628, 182, 'once the map is trusted, make every change a disciplined loop', { fontSize: 13, color: '#495057' });

  // version cards
  const v010 = d.box(56, 220, 250, 150,
    'v0.1.0  ·  2026-06-25\nFirst public release\n\n• orient / install / shazam\n• /cold-start drafts the map\n• verify + drift keep it honest\n• dual-mode (legacy + modern)\n• [inferred] → [verified]',
    { color: C.blue, fontSize: 13 });
  const v011 = d.box(324, 220, 240, 150,
    'v0.1.1 & v0.1.2\n2026-06-30\n\n• review-agent-config\n• indepth deep analysis\n• check-repo-maturity (11 checks)\n• drift CI (ai-check.yml)\n• automation-bias lessons',
    { color: C.blue, fontSize: 13 });
  const v020 = d.box(628, 220, 250, 150,
    'v0.2.0  ·  2026-07-03\nHardening + reach\n\n• Node-only, zero-dep\n• hash re-runs + child-lock\n  (protect [verified] work)\n• Copilot + Antigravity native\n• deterministic release gate',
    { color: C.violet, fontSize: 13 });
  const unrel = d.box(896, 220, 238, 150,
    'Unreleased\nThe engineering loop\n\n• Spec→…→Record loop\n• /fix-bug + /review-change\n• WORKLOG ledger (verified)\n• ROADMAP lifecycle trace\n• shazam update mode',
    { color: C.violet, fontSize: 13 });

  // timeline arrows
  d.arrow(v010, v011, { color: C.blue.s, strokeWidth: 3 });
  d.arrow(v011, v020, { color: C.gray.s, strokeWidth: 3, label: 'the pivot' });
  d.arrow(v020, unrel, { color: C.violet.s, strokeWidth: 3 });

  // Bottom: the shift, stated
  const from = d.box(56, 420, 508, 130,
    'THE OLD MINDSET  —  "AI-native"\n\nGoal: an agent that does not re-crawl or hallucinate.\nDeliverable: a compact, human-verified ai/ map.\nWin condition: the agent edits the right module and\nrespects what is frozen.',
    { color: C.blue, fontSize: 13, textColor: '#1e1e1e' });
  const to = d.box(628, 420, 506, 130,
    'THE NEW MINDSET  —  "spec + loop"\n\nGoal: every unit of work is spec-first and reviewed.\nDeliverable: durable artifacts per change (spec, ADR,\nreview, eval, WORKLOG row).\nWin condition: the loop stays honest — reproduce before\nfix, review in fresh context, ledger cannot rot.',
    { color: C.violet, fontSize: 13, textColor: '#1e1e1e' });
  d.arrow(from, to, { color: C.red.s, strokeWidth: 3, label: 'evangelised' });

  d.text(40, 596, 'The map was never the destination — it was the precondition. Trust in the map is what makes spec-driven, closed-loop agent engineering safe.', { fontSize: 13, color: '#868e96' });
  return d;
}

/* ------------------------------------------------------------------ */
/* Diagram 3 — The engineering loop (steady state)                     */
/* ------------------------------------------------------------------ */
function engineeringLoop() {
  const d = new Diagram();
  d.text(40, 24, 'The engineering loop', { fontSize: 30, bold: true });
  d.text(40, 66, 'The steady state after the map is trusted. Every feature or bugfix runs the same closed loop; each stage leaves a durable artifact in ai/lab/.', { fontSize: 15, color: '#495057' });

  const cx = 585, cy = 400, r = 210;
  const stages = [
    { t: 'SPEC', sub: 'specification-driven\nai/lab/specs/SPEC_* · BUGFIX_*\ngate: no code before the human OKs it', c: C.blue },
    { t: 'DECIDE', sub: 'decision records\nai/lab/decisions/ADR_*\ngate: non-obvious choices written down', c: C.cyan },
    { t: 'IMPLEMENT', sub: 'surgical diffs\n/add-feature · /fix-bug · /implement-spec\ngate: Stability — frozen/? needs approval', c: C.green },
    { t: 'REVIEW', sub: 'review-driven — fresh context\nai/lab/reviews/REVIEW_*\ngate: never the implementing session', c: C.yellow },
    { t: 'EVALUATE', sub: 'evaluation-driven\nai/lab/evaluations/EVAL_*\nwhat went well / poorly, audit cost', c: C.red },
    { t: 'RECORD', sub: 'memory\none row in ai/lab/WORKLOG.md\nlinks spec ↔ review ↔ eval ↔ commits', c: C.violet },
  ];
  const boxes = [];
  const n = stages.length;
  stages.forEach((s, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n; // start at top
    const bx = cx + r * Math.cos(ang) - 130;
    const by = cy + r * Math.sin(ang) - 55;
    const b = d.box(Math.round(bx), Math.round(by), 260, 110, `${i + 1}. ${s.t}\n${s.sub}`, { color: s.c, fontSize: 13 });
    boxes.push(b);
  });
  // connect around the cycle with curved poly-arrows between edges
  for (let i = 0; i < n; i++) {
    const a = boxes[i], b = boxes[(i + 1) % n];
    d.arrow(a, b, { color: C.gray.s, strokeWidth: 2.5 });
  }

  // center hub
  const hub = d.box(cx - 120, cy - 62, 240, 124,
    'ONE UNIT OF WORK\nfeature added or bug fixed\n\nmirrors how the kit thinks:\nai/guide = semantic memory\nai/lab = episodic memory\nWORKLOG = the episodic index',
    { color: C.gray, fontSize: 12 });

  // Three honesty properties
  d.els.unshift(d.panel(30, 660, 1110, 110, C.gray));
  d.text(48, 672, 'THREE PROPERTIES KEEP THE LOOP HONEST', { fontSize: 15, bold: true, color: '#495057' });
  d.box(48, 700, 350, 56, 'Reviewer ≠ implementer\nreview runs in a fresh session and re-runs the suites', { color: C.yellow, fontSize: 12 });
  d.box(410, 700, 350, 56, 'Reproduction before fix\na failing regression test proves the bug is understood', { color: C.red, fontSize: 12 });
  d.box(772, 700, 350, 56, 'The ledger cannot rot\nverify --strict checks every WORKLOG artifact path', { color: C.green, fontSize: 12 });

  return d;
}

/* ------------------------------------------------------------------ */
const files = [
  ['01-system-map.excalidraw', systemMap()],
  ['02-evolution-journey.excalidraw', evolutionJourney()],
  ['03-engineering-loop.excalidraw', engineeringLoop()],
];
for (const [name, d] of files) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(d.toScene(), null, 2) + '\n');
  const svgName = name.replace(/\.excalidraw$/, '.svg');
  writeFileSync(join(OUT_DIR, svgName), d.toSVG() + '\n');
  console.log(`wrote ${name} + ${svgName}  (${d.els.length} elements)`);
}
