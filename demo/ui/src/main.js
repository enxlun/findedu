// Hugjuulai · сургалтын үйл ажиллагааны систем
//   TaskMind AI  — teacher → exam / homework → Inbox + graph → Begin → student does it
//   ProblemHunt  — student → reports a problem → AI sorts, routes, groups → the right people see it
//   TeacherRate  — students rate teachers anonymously → Gemma 4 checks tone, summarises → classmates read it
// Vanilla JS + GSAP; design follows the Hackum landing page.

import { STRINGS } from "./i18n.js";
import { Q, gql } from "./graphql.js";
import * as motion from "./motion.js";

// ------------------------------------------------------------------ icons
const svg = (body, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${
    fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  }>${body}</svg>`;
const SPARKLE = '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>';
const I = {
  sparkle: svg(SPARKLE, true),
  check: svg('<path d="M5 12l5 5L20 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  send: svg('<path d="M4 12l16-8-6 16-2-7z"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
  pin: svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  menu: svg('<path d="M4 8h16M4 16h16"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>', true),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  book: svg('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h6"/>'),
  exam: svg('<path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="M9 12l2 2 4-4"/>'),
  inbox: svg('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>'),
  graph: svg('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7l7.5 1M7 8l4 8M16.5 10l-3.5 6"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>'),
  quiz: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>'),
  example: svg('<path d="M4 6h16M4 12h10M4 18h7"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  reply: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>'),
  heart: svg('<path d="M12 20s-7.2-4.4-9.4-9A5.2 5.2 0 0 1 12 5.8 5.2 5.2 0 0 1 21.4 11c-2.2 4.6-9.4 9-9.4 9z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  pen: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  sort: svg('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>'),
};
const STAR = '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>';
const TRAITS = ["attendance", "notes", "fairGrades", "gradesOnTime", "clear", "homework", "extraCredit", "teamwork", "fun"];
const CAT = {
  electric: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  plumbing: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  heating: svg('<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 10v6"/>'),
  furniture: svg('<path d="M6 4v8h12V4M5 12h14v3H5zM7 15v5M17 15v5"/>'),
  it: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  cleaning: svg('<path d="M14 3l-4 8M6 13h10l-1 8H7z"/><path d="M9 17h4"/>'),
  safety: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16h.01"/>'),
  other: svg('<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>'),
};
const CATEGORIES = ["electric", "plumbing", "heating", "furniture", "it", "cleaning", "safety", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const PSTATUS = ["new", "seen", "resolved"];

// ------------------------------------------------------------------ state
const storage = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

const state = {
  lang: storage.get("hj.lang") === "en" ? "en" : "mn",
  userId: storage.get("hj.user") || "s-bold",
  route: "home",
  users: [],
  classes: [],
  inbox: null,
  progress: null,
  problems: null,
  ai: null,
  beginning: false,
  tmTab: storage.get("hj.tmTab") === "graph" ? "graph" : "inbox",
  tmSort: storage.get("hj.tmSort") === "due" ? "due" : "ai",
  tmFilter: "all",
  param: null,
  teachers: null,
  teacher: null,
  summary: null,
  trSort: storage.get("hj.trSort") || "newest",
  trQuery: "",
  phFilter: "open",
  menuOpen: false,
  mobileOpen: false,
  drawer: null,
  modal: null,
  highlight: null,
};

const $ = (s, r = document) => r.querySelector(s);
const t = (key, vars = {}) => {
  let s = STRINGS[state.lang][key] ?? STRINGS.mn[key] ?? key;
  if (typeof s !== "string") return s;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rich = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<mark class="kw">$1</mark>');
const me = () => state.users.find((u) => u._id === state.userId);
const userById = (id) => state.users.find((u) => u._id === id);
const firstName = (name = "") => name.split(" ").pop();
const initials = (name = "") =>
  name
    .replace(/\./g, "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(-2)
    .join("")
    .toUpperCase();
const avatar = (user, size = "") => `<span class="avatar ${user?.role ?? ""} ${size}" aria-hidden="true">${esc(initials(user?.name ?? "?"))}</span>`;
const pad = (n) => String(n).padStart(2, "0");
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const providerName = (p) => (p ? t(`prov_${p}`) : "");
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
/** Read-only stars, partly filled for averages like 4.3. */
const stars = (value, size = "") => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const row = svg(STAR, true).repeat(5);
  return `<span class="stars ${size}" role="img" aria-label="${v}/5"><span class="base">${row}</span><span class="fill" style="width:${(v / 5) * 100}%">${row}</span></span>`;
};
const roleLabel = (u) =>
  u.role === "teacher" ? `${t("role_teacher")} · ${u.subject}` : u.role === "student" ? `${t("role_student")} · ${u.className}` : u.title || t(`role_${u.role}`);

function dueInfo(iso, done = false) {
  const d = new Date(iso);
  const now = new Date();
  const hours = (d.getTime() - now.getTime()) / 36e5;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (!done && hours < 0) {
    const ago = -hours;
    const label = ago < 48 ? t("hoursShort", { n: Math.max(1, Math.round(ago)) }) : t("daysShort", { n: Math.round(ago / 24) });
    return { text: t("dueOverdue", { n: label }), cls: "due-hot" };
  }
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 864e5);
  if (days <= 0) return { text: t("dueToday", { t: time }), cls: done ? "" : "due-hot" };
  if (days === 1) return { text: t("dueTomorrow", { t: time }), cls: done ? "" : "due-warm" };
  return { text: t("dueInDays", { n: days }), cls: "" };
}
function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return t("justNow");
  if (m < 60) return t("minAgo", { n: m });
  if (m < 48 * 60) return t("hAgo", { n: Math.round(m / 60) });
  return t("dAgo", { n: Math.round(m / 1440) });
}
const dots = (n, max = 5) => `<span class="dots" aria-label="${n}/${max}">${"●".repeat(n)}<span class="off">${"●".repeat(Math.max(0, max - n))}</span></span>`;
const toLocalInput = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const defaultDue = (daysAhead, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return toLocalInput(d);
};
function icon3d(name, { style = "", size = 100, depth = 1, rot = 0, drag = false, hideSm = false, cls = "" } = {}) {
  return `<div class="icon3d ${drag ? "drag" : ""} ${hideSm ? "hide-sm" : ""} ${cls}" data-float data-depth="${depth}" ${drag ? 'data-drag data-cursor="drag"' : ""}
    style="${style};width:${size}px;height:${size}px" aria-hidden="true"><img src="/img/icons3d/${name}.png" alt="" draggable="false" style="rotate:${rot}deg" /></div>`;
}
const roll = (label) => `<span class="roll"><span>${esc(label)}</span><span aria-hidden="true">${esc(label)}</span></span>`;
const sourceTag = (source, model) =>
  source === "ai" ? `<span class="tag ai">${I.sparkle}${esc(t("sourceAi", { model }))}</span>` : `<span class="tag">${esc(t("sourceFallback"))}</span>`;
const typeTag = (type) => `<span class="tag ${type === "exam" ? "sun" : "brand"}">${type === "exam" ? I.exam : I.book}${esc(t(`type_${type}`))}</span>`;
const catIcon = (c, small = false) => `<span class="cat ${c} ${small ? "sm" : ""}" title="${esc(t(`cat_${c}`))}">${CAT[c] ?? CAT.other}</span>`;
const prioTag = (p) => `<span class="prio ${p}"><i></i>${esc(t(`prio_${p}`))}</span>`;
const pStatusTag = (s) => `<span class="tag ${{ new: "brand", seen: "sun", resolved: "leaf" }[s]}">${esc(t(`status_${s}`))}</span>`;
const people = (list, max = 4) =>
  `<span class="people">${list
    .slice(0, max)
    .map((p) => `<span title="${esc(p.name)}">${avatar(p, "sm")}</span>`)
    .join("")}${list.length > max ? `<span class="more">+${list.length - max}</span>` : ""}</span>`;
function pStepper(status) {
  const idx = PSTATUS.indexOf(status);
  return `<div class="stepper three ${status === "resolved" ? "done" : ""}" aria-hidden="true">${PSTATUS.map((_, i) => `<span class="${i <= idx ? "on" : ""}"></span>`).join("")}</div>
    <div class="stepper-label">${esc(t(`status_${status}`))}</div>`;
}

// ------------------------------------------------------------------ routes
const ROUTES = {
  student: ["home", "taskmind", "problemhunt", "teachers"],
  teacher: ["home", "taskmind", "problemhunt", "teachers"],
  staff: ["home", "problemhunt"],
  admin: ["home", "problemhunt", "teachers"],
};
const hashParts = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "home").split("/");
const routeFromHash = () => hashParts()[0] || "home";
const paramFromHash = () => (hashParts()[1] ? decodeURIComponent(hashParts()[1]) : null);
const allowed = (r) => (ROUTES[me()?.role] ?? ["home"]).includes(r);
const href = (r, param) => `#/${r === "home" ? "" : r}${param ? `/${encodeURIComponent(param)}` : ""}`;
const navLabel = (r) => t(r === "teachers" && me()?.role === "teacher" ? "nav_teachers_teacher" : `nav_${r}`);
const go = (r, param) => {
  if (location.hash !== href(r, param)) location.hash = href(r, param);
  else onRoute();
};

// ------------------------------------------------------------------ data
async function loadUsers() {
  const d = await gql(Q.boot);
  state.users = d.hugjuulaiUsers;
  state.classes = d.hugjuulaiClasses;
  if (!me()) state.userId = "s-bold";
}
async function loadInbox() {
  const id = state.userId;
  const d = await gql(Q.inbox, { userId: id });
  if (id === state.userId) state.inbox = d.hugjuulaiInbox;
}
async function loadProgress() {
  const id = state.userId;
  const d = await gql(Q.progress, { teacherId: id });
  if (id === state.userId) state.progress = d.hugjuulaiClassProgress;
}
async function loadProblems() {
  const id = state.userId;
  const d = await gql(Q.problems, { userId: id });
  if (id === state.userId) state.problems = d.hugjuulaiProblems;
}
async function loadAi() {
  try {
    state.ai = (await gql(Q.ai)).hugjuulaiAiStatus;
  } catch {
    state.ai = { online: false, model: "", message: "API unreachable" };
  }
  const dot = $("#ai-dot");
  if (dot) dot.outerHTML = aiDot();
}
async function loadTeachers() {
  const id = state.userId;
  const d = await gql(Q.teachers, { userId: id });
  if (id === state.userId) state.teachers = d.hugjuulaiTeachers;
}
async function loadTeacher(teacherId) {
  const id = state.userId;
  const d = await gql(Q.teacher, { userId: id, teacherId });
  if (id === state.userId) state.teacher = d.hugjuulaiTeacher;
}
/** Which teacher page the "teachers" route shows (a teacher only ever sees their own). */
const teacherPageId = () => (me()?.role === "teacher" ? me()._id : state.param);
function loadersFor(route, role) {
  const l = [];
  if (role === "student" && (route === "home" || route === "taskmind")) l.push(loadInbox());
  if (role === "teacher" && (route === "home" || route === "taskmind")) l.push(loadProgress());
  if (route === "home" || route === "problemhunt") l.push(loadProblems());
  if (route === "teachers") l.push(teacherPageId() ? loadTeacher(teacherPageId()) : loadTeachers());
  return Promise.all(l);
}

/** Problems grouped by groupId (AI merges duplicate reports). */
function problemGroups() {
  const map = new Map();
  for (const p of state.problems ?? []) {
    if (!map.has(p.groupId)) map.set(p.groupId, []);
    map.get(p.groupId).push(p);
  }
  const rank = { new: 0, seen: 1, resolved: 2 };
  return [...map.values()]
    .map((list) => {
      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const root = list.find((p) => p._id === p.groupId) ?? list[0];
      const priority = list.reduce((acc, p) => (PRIORITIES.indexOf(p.priority) > PRIORITIES.indexOf(acc) ? p.priority : acc), "low");
      return { id: root.groupId, root, reports: list, latest: list[list.length - 1], status: root.status, priority, size: root.groupSize };
    })
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) ||
        b.latest.createdAt.localeCompare(a.latest.createdAt),
    );
}
const findItem = (taskId) => state.inbox?.items.find((i) => i.task._id === taskId);
const findProblem = (id) => state.problems?.find((p) => p._id === id);

// ------------------------------------------------------------------ chrome
function aiDot() {
  const a = state.ai;
  if (!a) return `<span id="ai-dot" class="ai-dot"><span class="ai-part"><i></i>${esc(t("aiChecking"))}</span></span>`;
  const p = a.priority;
  const part = (on, label) => `<span class="ai-part ${on ? "on" : "off"}"><i></i>${esc(label)}</span>`;
  const line = (job, x) => `${t(job)}: ${providerName(x.provider)} · ${x.model} — ${x.online ? "OK" : x.message ?? ""}`;
  const tip = [line("aiHelp", a), p && p.provider !== a.provider ? line("aiPriority", p) : ""].filter(Boolean).join("\n");
  return `<span id="ai-dot" class="ai-dot" title="${esc(tip)}">${part(a.online, a.online ? t("aiOn") : t("aiOff"))}${
    p && p.provider === "digitalocean" ? part(p.online, "DigitalOcean") : ""
  }</span>`;
}
function navBadge(r) {
  const user = me();
  if (r === "taskmind" && user.role === "student" && state.inbox?.unread) return `<span class="nav-badge">${state.inbox.unread}</span>`;
  if (r === "problemhunt" && user.role !== "student" && state.problems) {
    const n = problemGroups().filter((g) => g.status === "new").length;
    return n ? `<span class="nav-badge">${n}</span>` : "";
  }
  return "";
}
function renderHeader() {
  const user = me();
  if (!user) return;
  const routes = ROUTES[user.role];
  const links = routes
    .map((r) => `<li><a href="${href(r)}" ${state.route === r ? 'aria-current="page"' : ""}>${roll(navLabel(r))}${navBadge(r)}</a></li>`)
    .join("");
  const groups = ["student", "teacher", "staff", "admin"]
    .map(
      (role) =>
        `<h6>${esc(t(`role_${role}`))}</h6>${state.users
          .filter((u) => u.role === role)
          .map(
            (u) => `<button type="button" data-action="switch-user" data-id="${u._id}" aria-current="${u._id === user._id}">
          ${avatar(u, "sm")}<span>${esc(u.name)}<small>${esc(roleLabel(u))}</small></span></button>`,
          )
          .join("")}`,
    )
    .join("");
  const scrolled = window.scrollY > 12 || state.mobileOpen;
  $("#site-header").innerHTML = `
    <nav class="navbar glass-bar" ${scrolled ? "data-scrolled" : ""} aria-label="${esc(t("menu"))}">
      <a class="brand" href="#/" data-magnetic><span class="logo">${svg(SPARKLE, true)}</span><span>Hugjuulai<small>${esc(t("brandSub"))}</small></span></a>
      <ul class="nav-links">${links}</ul>
      <div class="nav-right">
        ${aiDot()}
        <div class="lang-switch" role="group" aria-label="Language">
          <span class="knob" style="transform:translateX(${state.lang === "en" ? 100 : 0}%)"></span>
          <button type="button" data-lang="mn" aria-pressed="${state.lang === "mn"}">mn</button>
          <button type="button" data-lang="en" aria-pressed="${state.lang === "en"}">en</button>
        </div>
        <button type="button" class="user-btn" data-action="toggle-user-menu" aria-expanded="${state.menuOpen}" aria-label="${esc(t("switchUser"))}">
          ${avatar(user)}<span class="who"><b>${esc(user.name)}</b><small>${esc(roleLabel(user))}</small></span>${I.chevron}
        </button>
        <button type="button" class="btn btn-primary icon-btn menu-toggle" data-action="toggle-mobile" aria-expanded="${state.mobileOpen}" aria-label="${esc(t("menu"))}">${state.mobileOpen ? I.close : I.menu}</button>
      </div>
      ${state.menuOpen ? `<div class="user-menu glass" role="menu">${groups}</div>` : ""}
    </nav>
    ${state.mobileOpen ? `<div class="mobile-nav glass">${routes.map((r) => `<a href="${href(r)}" ${state.route === r ? 'aria-current="page"' : ""}>${esc(navLabel(r))}${navBadge(r)}</a>`).join("")}</div>` : ""}`;
}
function renderFooter() {
  const user = me();
  if (!user) return;
  $("#site-footer").innerHTML = `
    <svg class="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 70 C 240 10, 480 10, 720 50 S 1200 110, 1440 40 L1440 120 L0 120 Z" fill="#e0f1fa"/>
      <path d="M0 95 C 300 40, 560 60, 820 85 S 1260 120, 1440 75 L1440 120 L0 120 Z" fill="#ffffff"/>
    </svg>
    <div class="footer-body"><div class="container">
      <h2 data-split="words" data-split-ready="1" data-in="1">${rich(t("footerTitle"))}</h2>
      <div class="footer-cols">
        <div><a class="brand" href="#/"><span class="logo">${svg(SPARKLE, true)}</span><span>Hugjuulai<small>${esc(t("brandSub"))}</small></span></a><p>${esc(t("footerAbout"))}</p></div>
        <div><h5>${esc(t("f_modules"))}</h5><ul>${ROUTES[user.role].map((r) => `<li><a href="${href(r)}">${esc(navLabel(r))}</a></li>`).join("")}</ul></div>
        <div><h5>${esc(t("f_tech"))}</h5><ul><li><a href="https://erxes.io" target="_blank" rel="noopener" data-cursor="open">erxes</a></li><li><a href="https://ai.google.dev/gemma" target="_blank" rel="noopener" data-cursor="open">Gemma 4 · Gemini API</a></li><li><a href="https://docs.digitalocean.com/products/inference-hub/" target="_blank" rel="noopener" data-cursor="open">DigitalOcean Gradient AI</a></li></ul></div>
        <div><h5>${esc(t("f_event"))}</h5><ul><li>Hacktoberfest Hack Day</li><li>Ulaanbaatar × erxes Hub</li><li>2026.10.24</li></ul></div>
      </div>
      <div class="footer-bottom"><span>© 2026 PixelPulse · MIT</span><button type="button" class="linkish" data-action="reset-demo">${esc(t("resetDemo"))}</button></div>
    </div></div>`;
}

// ------------------------------------------------------------------ shared pieces
const statChip = ([n, label, alert]) =>
  `<div class="stat-chip glass-dark ${alert && n > 0 ? "alert" : ""}"><b data-count="${n}">${n}</b><span>${esc(label)}</span></div>`;
function pageHead({ kicker, title, lead, stats = [], actions = "", icons = "" }) {
  return `<section class="band page-head on-blue" data-parallax>
    <div class="glow" aria-hidden="true"></div><div class="dots" aria-hidden="true"></div>${icons}
    <div class="band-inner">
      <p class="kicker mask"><span data-rise>${esc(kicker)}</span></p>
      <h1 data-split="lines" data-hero>${rich(title)}</h1>
      ${lead ? `<p class="lead mask"><span data-rise>${esc(lead)}</span></p>` : ""}
      ${actions ? `<div class="cta-row">${actions}</div>` : ""}
      ${stats.length ? `<div class="stat-row">${stats.map(statChip).join("")}</div>` : ""}
    </div>
  </section>`;
}
const sectionTitle = (key, extra = "") =>
  `<h2 class="section-title" data-split="words" style="font-size:clamp(24px,2.6vw,34px)${extra}">${rich(t(key))}</h2>`;

// ------------------------------------------------------------------ view: home
const HERO_ICONS = {
  student: [["notebook", "right:9%;top:12%", 170, 8], ["rocket", "right:28%;bottom:13%", 150, -10], ["megaphone", "right:3%;top:52%", 140, 12]],
  teacher: [["calendar", "right:9%;top:12%", 170, 8], ["medal", "right:28%;bottom:13%", 150, -10], ["chat", "right:3%;top:52%", 140, 12]],
  staff: [["computer", "right:9%;top:12%", 160, 8], ["fire", "right:28%;bottom:13%", 150, -10], ["coffee", "right:3%;top:52%", 140, 12]],
  admin: [["target", "right:9%;top:12%", 170, 8], ["puzzle", "right:28%;bottom:13%", 150, -10], ["megaphone", "right:3%;top:52%", 140, 12]],
};

function homeStats(user) {
  const items = state.inbox?.items ?? [];
  const groups = problemGroups();
  if (user.role === "student") {
    return [
      [state.inbox?.unread ?? 0, t("st_unread"), true],
      [items.filter((i) => i.status !== "done").length, t("st_open")],
      [items.filter((i) => i.overdue).length, t("st_overdue"), true],
      [(state.problems ?? []).length, t("st_myReports")],
    ];
  }
  if (user.role === "teacher") {
    const flagged = new Set();
    (state.progress ?? []).forEach((r) => r.students.forEach((s) => s.status !== "done" && (s.difficulty >= 4 || s.helpRequests > 0) && flagged.add(s.userId)));
    return [
      [(state.progress ?? []).length, t("st_given")],
      [flagged.size, t("st_needsHelp"), true],
      [groups.filter((g) => g.status !== "resolved").length, t("st_forMe")],
    ];
  }
  return [
    [groups.filter((g) => g.status === "new").length, t("st_new"), true],
    [groups.filter((g) => g.status === "seen").length, t("st_seen")],
    [groups.filter((g) => g.status === "resolved").length, t("st_resolved")],
    [(state.problems ?? []).length - groups.length, t("st_grouped")],
  ];
}
function heroActions(user) {
  if (user.role === "student")
    return `<a class="btn btn-white btn-lg" href="#/taskmind" data-magnetic>${I.play}${esc(t("beginBtn"))}</a>
      <button type="button" class="btn btn-glass btn-lg" data-action="open-report" data-magnetic>${I.camera}${esc(t("reportIssue"))}</button>`;
  if (user.role === "teacher")
    return `<button type="button" class="btn btn-white btn-lg" data-action="open-add-task" data-magnetic>${I.plus}${esc(t("addTask"))}</button>
      <a class="btn btn-glass btn-lg" href="#/problemhunt" data-magnetic>${esc(t("nav_problemhunt"))}</a>`;
  return `<a class="btn btn-white btn-lg" href="#/problemhunt" data-magnetic>${esc(t("nav_problemhunt"))}${I.arrow}</a>`;
}
function viewHome(user) {
  const icons = HERO_ICONS[user.role].map(([n, pos, size, rot], i) => icon3d(n, { style: pos, size, rot, drag: true, hideSm: i !== 1, cls: i === 1 ? "m-corner" : "" })).join("");
  const words = t("rotateWords");
  const hero = `<section class="band hero on-blue" data-parallax>
    <div class="glow" aria-hidden="true"></div><div class="dots" aria-hidden="true"></div>${icons}
    <div class="band-inner">
      <p class="kicker mask"><span data-rise>${esc(t("hello", { name: firstName(user.name) }))}</span></p>
      <h1>${t("heroTitle").map((l) => `<span class="mask"><span data-rise>${esc(l)}</span></span>`).join("")}</h1>
      <p class="rotate-line mask"><span data-rise>${esc(t("rotateLead"))} <span class="rotator" data-rotator><span class="sr-only">${esc(words.join(", "))}</span>${words
        .map((w, i) => `<span data-word aria-hidden="true" ${i ? 'style="opacity:0"' : ""}>${esc(w)}</span>`)
        .join("")}</span></span></p>
      <p class="lead mask"><span data-rise>${esc(t(`lead_${user.role}`))}</span></p>
      <div class="mask" style="margin:-12px;padding:12px"><div class="cta-row" data-rise style="margin-top:16px">${heroActions(user)}</div></div>
      <div class="stat-row">${homeStats(user).map(statChip).join("")}</div>
    </div>
    <p class="drag-hint">${esc(t("dragHint"))}</p>
  </section>`;

  let quick = "";
  if (user.role === "student") {
    const plan = state.inbox?.begin;
    const next = plan?.nextTaskId ? findItem(plan.nextTaskId) : null;
    const left = next && next.status !== "done"
      ? `<a class="card next-mini" href="#/taskmind" data-tilt="3"><span class="tag ai">${I.sparkle}${esc(t("beginNext"))}</span><h3>${esc(next.task.title)}</h3><p class="muted" style="margin:0">${esc(plan.reason)}</p></a>`
      : `<div class="task-list" data-reveal>${(state.inbox?.items ?? []).filter((i) => i.status !== "done").slice(0, 3).map((i) => inboxRow(i, plan)).join("")}</div>`;
    const reports = (state.problems ?? []).slice(0, 3);
    quick = `<div class="grid-halves">
      <div><div class="row-between">${sectionTitle("homeNextTitle")}<a class="link-arrow" href="#/taskmind">${esc(t("seeAll"))}</a></div><div style="margin-top:18px">${left}</div></div>
      <div><div class="row-between">${sectionTitle("homeReportsTitle")}<a class="link-arrow" href="#/problemhunt">${esc(t("seeAll"))}</a></div>
        <div class="task-list" data-reveal style="margin-top:18px">${reports.length ? reports.map((p) => myReportCard(p, true)).join("") : `<div class="empty">${esc(t("noReports"))}</div>`}</div></div>
    </div>`;
  } else {
    const groups = problemGroups().filter((g) => g.status !== "resolved").slice(0, 3);
    const right = `<div><div class="row-between">${sectionTitle("homeForMeTitle")}<a class="link-arrow" href="#/problemhunt">${esc(t("seeAll"))}</a></div>
      <div class="task-list" data-reveal style="margin-top:18px">${groups.length ? groups.map((g) => groupCard(g, true)).join("") : `<div class="empty">${esc(t("noProblems"))}</div>`}</div></div>`;
    if (user.role === "teacher") {
      const given = (state.progress ?? []).slice(0, 3);
      quick = `<div class="grid-halves"><div><div class="row-between">${sectionTitle("homeGivenTitle")}<a class="link-arrow" href="#/taskmind">${esc(t("seeAll"))}</a></div>
        <div class="task-list" data-reveal style="margin-top:18px">${given.map((r) => givenMini(r)).join("") || `<div class="empty">${esc(t("noAssignments"))}</div>`}</div></div>${right}</div>`;
    } else quick = right;
  }

  const modIcon = { taskmind: "bulb", problemhunt: "megaphone", teachers: "star" };
  const modules = `<ul class="ruled" data-reveal>${["taskmind", "problemhunt", "teachers"]
    .map((m) => {
      const [title, desc] = t(`mod_${m}`);
      const inner = `<h3>${esc(title)}</h3><p>${esc(desc)}</p><span class="sticker" aria-hidden="true"><img src="/img/icons3d/${modIcon[m]}.png" alt="" /></span>`;
      return `<li>${allowed(m) ? `<a href="${href(m)}">${inner}</a>` : `<div class="ruled-row">${inner}</div>`}</li>`;
    })
    .join("")}</ul>`;

  const ctaKey = user.role === "student" ? "" : user.role === "teacher" ? "_teacher" : "_ops";
  const ctaBtn =
    user.role === "student"
      ? `<button type="button" class="btn btn-white btn-lg" data-action="open-report" data-magnetic>${I.camera}${esc(t("reportIssue"))}</button>`
      : user.role === "teacher"
        ? `<button type="button" class="btn btn-white btn-lg" data-action="open-add-task" data-magnetic>${I.plus}${esc(t("addTask"))}</button>`
        : `<a class="btn btn-white btn-lg" href="#/problemhunt" data-magnetic>${esc(t("nav_problemhunt"))}${I.arrow}</a>`;
  const cta = `<section class="band cta-band on-blue" data-parallax style="background:radial-gradient(120% 90% at 50% 0%,#13a3ea 0%,#0085ca 45%,#005b8c 100%)">
    <div class="dots" aria-hidden="true"></div>
    ${icon3d("rocket", { style: "left:0.5%;top:-1%", size: 120, depth: 1.3, rot: -14 })}
    ${icon3d("trophy", { style: "right:0.5%;top:-1%", size: 110, depth: 1.1, rot: 12 })}
    ${icon3d("coffee", { style: "left:1%;bottom:-2%", size: 100, depth: 1, rot: 10, hideSm: true })}
    ${icon3d("fire", { style: "right:1%;bottom:-3%", size: 100, depth: 1.2, rot: -8, hideSm: true })}
    ${icon3d("calendar", { style: "right:12%;top:16%", size: 70, depth: 0.7, hideSm: true })}
    ${icon3d("puzzle", { style: "left:9%;top:55%", size: 70, depth: 0.9, hideSm: true })}
    <div class="cta-card glass-plain">
      ${icon3d("chat", { style: "left:-30px;top:-30px", size: 70, depth: 0.5, rot: -12 })}
      ${icon3d("star", { style: "right:-26px;top:-26px", size: 62, depth: 0.6, rot: 14 })}
      <p class="kicker">${esc(t("ctaKicker"))}</p>
      <h2 data-split="words">${esc(t(`ctaTitle${ctaKey}`))}</h2>
      <p class="lead">${esc(t(`ctaLead${ctaKey}`))}</p>
      <div class="cta-row">${ctaBtn}</div>
    </div>
  </section>`;

  return `${hero}
    <section class="section"><div class="container">${quick}</div></section>
    <section class="section"><div class="container">${sectionTitle("modulesTitle", ";font-size:clamp(28px,3.6vw,46px)")}${modules}</div></section>
    ${cta}`;
}

// ------------------------------------------------------------------ TaskMind: student
/** rank: { pos, score, reason } from the AI priority order (DigitalOcean), when the Inbox is AI-sorted. */
function inboxRow(item, plan, rank = null) {
  const tk = item.task;
  const done = item.status === "done";
  const due = dueInfo(tk.dueDate, done);
  const isNext = plan?.nextTaskId === tk._id && !done;
  const status = { todo: t("statusTodo"), in_progress: t("statusDoing"), done: t("statusDone") }[item.status];
  const showRank = rank && !done;
  return `<article class="card inbox-row ${item.seen ? "" : "unread"} ${done ? "is-done" : ""} ${isNext ? "is-next" : ""}" role="button" tabindex="0"
      data-action="open-task" data-id="${tk._id}" data-flip-id="t-${tk._id}" data-cursor="open">
    <span class="udot" aria-hidden="true"></span>
    <span class="type-ic ${tk.type}">${tk.type === "exam" ? I.exam : I.book}</span>
    <div class="grow">
      <div class="row1"><h3>${esc(tk.title)}</h3>${isNext ? `<span class="tag ai">${I.sparkle}${esc(t("beginPick"))}</span>` : ""}${item.blockedBy.length ? `<span class="tag">${I.lock}${esc(t("locked"))}</span>` : ""}</div>
      <div class="meta"><span class="subject">${esc(tk.subject)}</span><span>${esc(tk.createdByName ?? "")}</span><span class="${due.cls}">${esc(due.text)}</span><span>${tk.estimatedMinutes} ${esc(t("minutesUnit"))}</span></div>
      ${showRank && rank.reason ? `<p class="rank-why">${I.sparkle}<span>${esc(rank.reason)}</span></p>` : ""}
    </div>
    <div class="side">${showRank ? `<span class="ai-score" title="${esc(t("rankScore", { n: rank.score }))}"><b>#${rank.pos}</b><span class="meter"><i style="width:${rank.score}%"></i></span><small>${rank.score}</small></span>` : ""}<span class="status-pill ${item.status}">${esc(status)}</span></div>
  </article>`;
}

/** Inbox order: AI priority (from the latest Begin run on DigitalOcean) or due date; done last. */
function sortInbox(list, plan) {
  const doneLast = (a, b) => Number(a.status === "done") - Number(b.status === "done");
  const byDue = (a, b) => a.task.dueDate.localeCompare(b.task.dueDate);
  const ranking = plan?.ranking ?? [];
  if (state.tmSort !== "ai" || !ranking.length) return [...list].sort((a, b) => doneLast(a, b) || byDue(a, b)).map((item) => ({ item, rank: null }));
  const pos = new Map(ranking.map((r, i) => [r.taskId, { ...r, pos: i + 1 }]));
  return [...list]
    .sort((a, b) => doneLast(a, b) || (pos.get(a.task._id)?.pos ?? 999) - (pos.get(b.task._id)?.pos ?? 999) || byDue(a, b))
    .map((item) => ({ item, rank: pos.get(item.task._id) ?? null }));
}

function rankNote(plan, items) {
  const ranking = plan?.ranking ?? [];
  if (!ranking.length) {
    return `<div class="rank-note">${I.sparkle}<span>${esc(t("rankNone"))}</span><button type="button" class="btn btn-primary btn-sm" data-action="begin">${I.play}${esc(t("beginBtn"))}</button></div>`;
  }
  const ranked = new Set(ranking.map((r) => r.taskId));
  const stale = items.some((i) => i.status !== "done" && !ranked.has(i.task._id));
  const provider = plan.source === "ai" ? providerName(plan.provider) : t("prov_rule");
  return `<div class="rank-note">${I.sparkle}<span>${esc(t("rankBy", { provider, model: plan.source === "ai" ? plan.model : "—", ago: timeAgo(plan.createdAt) }))}${
    stale ? ` <b>${esc(t("rankStale"))}</b>` : ""
  }</span><button type="button" class="btn btn-ghost btn-sm" data-action="begin">${I.refresh}${esc(t("beginAgain"))}</button></div>`;
}

function beginCard(plan) {
  const icons = icon3d("rocket", { style: "right:-14px;top:-34px", size: 96, rot: 10, depth: 0.6 });
  const btn = (label = t("beginBtn")) => `<button type="button" class="btn btn-white btn-lg begin-btn" data-action="begin" data-magnetic>${I.play}${esc(label)}</button>`;
  if (state.beginning) {
    return `<div class="begin-card on-blue" data-parallax>${icons}<p class="kicker">${esc(t("beginTitle"))}</p>
      <h3 class="loading-line" style="color:#fff"><span class="spinner"></span>${esc(t("beginRunning"))}</h3>
      <div class="skeleton dark"><div></div><div style="width:80%"></div><div style="width:60%"></div></div></div>`;
  }
  if (!plan) {
    return `<div class="begin-card on-blue" data-parallax>${icons}<p class="kicker">${esc(t("beginTitle"))}</p>
      <h3>${esc(t("beginLead"))}</h3>${btn()}</div>`;
  }
  const next = plan.nextTaskId ? findItem(plan.nextTaskId) : null;
  if (!next || next.status === "done") {
    return `<div class="begin-card on-blue" data-parallax>${icons}<p class="kicker">${esc(t("beginTitle"))}</p>
      <h3>${esc(plan.nextTaskId ? t("beginStale") : t("beginNone"))}</h3>${btn()}</div>`;
  }
  const tk = next.task;
  const due = dueInfo(tk.dueDate);
  return `<div class="begin-card on-blue" data-parallax>${icons}
    <div class="row-between begin-top"><p class="kicker">${esc(t("beginNext"))}</p><span class="tag glass-tag" title="${esc(plan.source === "ai" ? `${t("aiOn")} · ${plan.model}` : plan.model)}">${plan.source === "ai" ? I.sparkle : ""}${esc(plan.source === "ai" ? providerName(plan.provider) : t("sourceFallback"))}</span></div>
    <h3 class="next-title">${esc(tk.title)}</h3>
    <div class="meta on-blue-meta">${typeTag(tk.type)}<span>${esc(tk.subject)}</span><span>${esc(due.text)}</span><span>${tk.estimatedMinutes} ${esc(t("minutesUnit"))}</span></div>
    <p class="why">${I.sparkle}<span>${esc(plan.reason)}</span></p>
    ${plan.firstStep ? `<div class="first-step"><b>${esc(t("beginFirstStep"))}</b><span>${esc(plan.firstStep)}</span></div>` : ""}
    <div class="cta-row" style="margin-top:18px">
      <button type="button" class="btn btn-white btn-lg" data-action="begin-start" data-id="${tk._id}" data-magnetic>${I.play}${esc(t("beginStart"))}</button>
      <button type="button" class="btn btn-glass" data-action="begin">${I.refresh}${esc(t("beginAgain"))}</button>
    </div>
    ${plan.error && plan.source !== "ai" ? `<p class="note-light">${esc(t("aiError", { err: plan.error.slice(0, 220) }))}</p>` : ""}
    ${plan.error && plan.source === "ai" ? `<p class="note-light" title="${esc(plan.error)}">${esc(t("aiFellBack", { failed: plan.error.split(":")[0], used: providerName(plan.provider) }))}</p>` : ""}
    ${plan.lang && plan.lang !== state.lang ? `<p class="note-light">${esc(t("langHint"))}</p>` : ""}
  </div>`;
}

function queueCard(plan) {
  const items = state.inbox?.items ?? [];
  const title = (id) => items.find((i) => i.task._id === id)?.task.title ?? "";
  const blocked = items
    .filter((i) => i.status !== "done" && i.blockedBy.length)
    .map((i) => ({ taskId: i.task._id, title: i.task.title, waiting: i.blockedBy.map(title) }));
  const queue = plan ? plan.queue.filter((q) => findItem(q.taskId)?.status !== "done") : [];
  return `<div class="card queue-card">
    ${
      queue.length
        ? `<h3 class="card-title">${esc(t("queueTitle"))}</h3><ol class="queue">${queue
            .map((q, i) => `<li><button type="button" data-action="open-task" data-id="${q.taskId}" data-cursor="open"><span class="qn">${i + 2}</span><span><b>${esc(q.title)}</b><small>${esc(q.reason)}</small></span></button></li>`)
            .join("")}</ol>`
        : ""
    }
    <h3 class="card-title" ${queue.length ? 'style="margin-top:20px"' : ""}>${I.lock.replace("<svg", '<svg class="inline-ic"')} ${esc(t("blockedTitle"))}</h3>
    <ul class="blocked">${blocked
      .map((b) => `<li><button type="button" data-action="open-task" data-id="${b.taskId}" data-cursor="open"><b>${esc(b.title)}</b><small>${esc(t("waitingFor", { list: b.waiting.join(", ") }))}</small></button></li>`)
      .join("") || `<li class="muted">—</li>`}</ul>
  </div>`;
}

function loadChart(items) {
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
  const open = items.filter((i) => i.status !== "done");
  const buckets = days.map((d, idx) => {
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    const list = open.filter((i) => {
      const due = new Date(i.task.dueDate);
      return (idx === 0 && due < end) || (due >= d && due < end);
    });
    return { d, minutes: list.reduce((s, i) => s + i.task.estimatedMinutes, 0), exam: list.some((i) => i.task.type === "exam"), overdue: idx === 0 && list.some((i) => i.overdue), n: list.length };
  });
  const max = Math.max(60, ...buckets.map((b) => b.minutes));
  const W = 1000;
  const H = 210;
  const bw = 96;
  const gap = (W - 40 - bw * 7) / 6;
  const names = state.lang === "mn" ? ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const bars = buckets
    .map((b, i) => {
      const h = Math.round((b.minutes / max) * 130);
      const x = 20 + i * (bw + gap);
      const y = 160 - h;
      const fill = b.exam ? "var(--sun)" : b.overdue ? "var(--coral)" : "var(--brand)";
      return `<g class="bar" style="--i:${i}"><rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="10" fill="${fill}" opacity="${b.minutes ? 1 : 0.25}"/>
        ${b.minutes ? `<text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" class="bar-val">${b.minutes} ${esc(t("minutesUnit"))}</text>` : ""}
        <text x="${x + bw / 2}" y="182" text-anchor="middle" class="bar-day">${esc(i === 0 ? t("dueToday", { t: "" }).trim() : names[b.d.getDay()])}</text>
        <text x="${x + bw / 2}" y="200" text-anchor="middle" class="bar-date">${pad(b.d.getMonth() + 1)}.${pad(b.d.getDate())}</text></g>`;
    })
    .join("");
  return `<svg class="load-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("graphLoad").replace(/[[\]]/g, ""))}"><line x1="10" x2="${W - 10}" y1="160.5" y2="160.5" class="axis"/>${bars}</svg>`;
}

function depGraph(items, plan) {
  const byId = new Map(items.map((i) => [i.task._id, i]));
  const depth = new Map();
  const depthOf = (id, seen = new Set()) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = byId.get(id).task.dependsOn.filter((d) => byId.has(d));
    const v = deps.length ? 1 + Math.max(...deps.map((d) => depthOf(d, seen))) : 0;
    depth.set(id, v);
    return v;
  };
  items.forEach((i) => depthOf(i.task._id));
  const maxDepth = Math.max(0, ...depth.values());
  const lanes = [...new Set([...items].sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate)).map((i) => i.task.subject))];
  const LEFT = 150;
  const COLW = 252;
  const NW = 212;
  const NH = 62;
  const ROWH = 76;
  const TOP = 46;
  const GAP = 22;
  const pos = new Map();
  let y = TOP;
  const laneMeta = [];
  for (const lane of lanes) {
    const inLane = items.filter((i) => i.task.subject === lane);
    const rows = Math.max(1, ...[...Array(maxDepth + 1)].map((_, d) => inLane.filter((i) => depth.get(i.task._id) === d).length));
    for (let d = 0; d <= maxDepth; d++) {
      inLane
        .filter((i) => depth.get(i.task._id) === d)
        .sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate))
        .forEach((i, r) => pos.set(i.task._id, { x: LEFT + d * COLW, y: y + r * ROWH }));
    }
    laneMeta.push({ lane, y, h: rows * ROWH, teacher: inLane[0]?.task.createdByName ?? "" });
    y += rows * ROWH + GAP;
  }
  const W = LEFT + (maxDepth + 1) * COLW;
  const H = y;
  const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  const edges = items
    .flatMap((i) =>
      i.task.dependsOn
        .filter((d) => pos.has(d))
        .map((d, k) => {
          const a = pos.get(d);
          const b = pos.get(i.task._id);
          const x1 = a.x + NW;
          const y1 = a.y + NH / 2;
          const x2 = b.x - 6;
          const y2 = b.y + NH / 2;
          const doneEdge = byId.get(d).status === "done";
          return `<path class="gedge ${doneEdge ? "done" : ""}" style="--i:${k}" d="M${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}" marker-end="url(#arrow${doneEdge ? "-done" : ""})"/>`;
        }),
    )
    .join("");

  const nodes = items
    .map((i, k) => {
      const p = pos.get(i.task._id);
      const blocked = i.blockedBy.length > 0 && i.status !== "done";
      const isNext = plan?.nextTaskId === i.task._id && i.status !== "done";
      const cls = ["gnode", `s-${i.status}`, blocked ? "blocked" : "", isNext ? "next" : "", i.overdue ? "overdue" : "", i.task.type].join(" ");
      const mark = i.status === "done" ? "✓" : blocked ? "–" : i.task.type === "exam" ? "★" : "•";
      const due = dueInfo(i.task.dueDate, i.status === "done");
      return `<g class="${cls}" style="--i:${k}" transform="translate(${p.x} ${p.y})" data-action="open-task" data-id="${i.task._id}" data-cursor="open" role="button" tabindex="0" aria-label="${esc(i.task.title)}">
        ${isNext ? `<rect class="halo" x="-6" y="-6" width="${NW + 12}" height="${NH + 12}" rx="20"/>` : ""}
        <rect class="box" width="${NW}" height="${NH}" rx="16"/>
        <circle class="mark-bg" cx="24" cy="${NH / 2}" r="13"/><text class="mark" x="24" y="${NH / 2 + 4.5}" text-anchor="middle">${mark}</text>
        <text class="gt" x="46" y="26">${esc(trunc(i.task.title, 22))}</text>
        <text class="gs" x="46" y="45">${esc(trunc(due.text, 26))}</text>
        ${isNext ? `<text class="gnext" x="${NW - 10}" y="-12" text-anchor="end">✦ Begin</text>` : ""}
      </g>`;
    })
    .join("");

  const lanesSvg = laneMeta
    .map((l, i) => `<g class="lane"><rect x="4" y="${l.y - 8}" width="${W - 8}" height="${l.h}" rx="18" class="${i % 2 ? "alt" : ""}"/>
      <text x="20" y="${l.y + 24}" class="lane-t">${esc(l.lane)}</text><text x="20" y="${l.y + 44}" class="lane-s">${esc(l.teacher)}</text></g>`)
    .join("");
  const cols = [...Array(maxDepth + 1)].map((_, d) => `<text x="${LEFT + d * COLW + NW / 2}" y="24" text-anchor="middle" class="col-t">${esc(t("stage", { n: d + 1 }))}</text>`).join("");

  return `<svg class="dep-graph" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t("graphDeps").replace(/[[\]]/g, ""))}">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#9fc3d8"/></marker>
      <marker id="arrow-done" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#00ab84"/></marker>
    </defs>${lanesSvg}${cols}${edges}${nodes}</svg>`;
}

function viewTmStudent() {
  const items = state.inbox?.items ?? [];
  const plan = state.inbox?.begin ?? null;
  const open = items.filter((i) => i.status !== "done");
  const head = pageHead({
    kicker: t("tmKicker"),
    title: t("tmTitle"),
    lead: t("tmLead"),
    icons: icon3d("notebook", { style: "right:6%;top:16%", size: 150, rot: 10, hideSm: true }) + icon3d("bulb", { style: "right:22%;bottom:10%", size: 110, rot: -8, depth: 0.8, hideSm: true }),
    stats: [
      [state.inbox?.unread ?? 0, t("st_unread"), true],
      [open.length, t("st_open")],
      [items.filter((i) => i.overdue).length, t("st_overdue"), true],
      [open.filter((i) => i.task.type === "exam").length, t("st_exams")],
    ],
  });
  const filters = {
    all: () => true,
    unread: (i) => !i.seen,
    exam: (i) => i.task.type === "exam",
    homework: (i) => i.task.type === "homework",
    done: (i) => i.status === "done",
  };
  const shown = sortInbox(items.filter(filters[state.tmFilter] ?? filters.all), plan);
  const sortSeg = `<div class="seg sort-seg" role="group" aria-label="${esc(t("sortLabel"))}">
    <button type="button" data-action="tm-sort" data-value="ai" aria-pressed="${state.tmSort === "ai"}">${I.sparkle}${esc(t("sort_ai"))}</button>
    <button type="button" data-action="tm-sort" data-value="due" aria-pressed="${state.tmSort === "due"}">${I.sort}${esc(t("sort_due"))}</button></div>`;
  const tabs = `<div class="seg big" role="tablist">
    <button type="button" role="tab" data-action="tm-tab" data-value="inbox" aria-pressed="${state.tmTab === "inbox"}">${I.inbox}${esc(t("tabInbox"))}${state.inbox?.unread ? ` <span class="nav-badge">${state.inbox.unread}</span>` : ""}</button>
    <button type="button" role="tab" data-action="tm-tab" data-value="graph" aria-pressed="${state.tmTab === "graph"}">${I.graph}${esc(t("tabGraph"))}</button></div>`;
  const body =
    state.tmTab === "graph"
      ? `<div class="stack-gap">
          <div class="card graph-card"><h3 class="card-title" data-split="words">${rich(t("graphLoad"))}</h3><p class="muted">${esc(t("graphLoadLead"))}</p>${loadChart(items)}</div>
          <div class="card graph-card"><h3 class="card-title" data-split="words">${rich(t("graphDeps"))}</h3><p class="muted">${esc(t("graphDepsLead"))}</p>
            <div class="graph-scroll">${depGraph(items, plan)}</div>
            <div class="legend" style="margin-top:12px"><span><i style="background:var(--leaf)"></i>${esc(t("legend_done"))}</span><span><i style="background:var(--sun)"></i>${esc(t("legend_doing"))}</span>
              <span><i style="background:var(--brand)"></i>${esc(t("legend_todo"))}</span><span><i style="background:#c3d3de"></i>${esc(t("legend_blocked"))}</span><span><i style="background:linear-gradient(90deg,#13a3ea,#00ab84)"></i>${esc(t("legend_next"))}</span></div>
          </div></div>`
      : `<div class="filters" style="margin-bottom:14px"><div class="chips">${Object.keys(filters)
          .map((f) => `<button type="button" class="chip" data-action="tm-filter" data-value="${f}" aria-pressed="${state.tmFilter === f}">${esc(t(`f_${f}`))} <span class="n">${items.filter(filters[f]).length}</span></button>`)
          .join("")}</div>${sortSeg}</div>
        ${state.tmSort === "ai" ? rankNote(plan, items) : ""}
        <div class="task-list" data-reveal>${shown.length ? shown.map(({ item, rank }) => inboxRow(item, plan, rank)).join("") : `<div class="empty">${esc(t("noTasks"))}</div>`}</div>`;
  return `${head}<section class="section-sm"><div class="container">
    <div class="begin-grid">${beginCard(plan)}${queueCard(plan)}</div>
    <div class="tm-bar">${tabs}</div>
    ${body}
  </div></section>`;
}

// ------------------------------------------------------------------ TaskMind: teacher
function givenMini(r) {
  const due = dueInfo(r.task.dueDate);
  return `<a class="card given-mini" href="#/taskmind" data-tilt="3">
    <div class="row-between" style="align-items:center">${typeTag(r.task.type)}<span class="tag brand">${esc(t("doneOf", { done: r.done, total: r.total }))}</span></div>
    <h3 class="task-title" style="margin-top:8px">${esc(r.task.title)}</h3>
    <div class="meta"><span class="${due.cls}">${esc(due.text)}</span>${r.helpRequests ? `<span>${esc(t("helpRequests", { n: r.helpRequests }))}</span>` : ""}</div>
  </a>`;
}
function viewTmTeacher(user) {
  const rows = state.progress ?? [];
  const flagged = new Set();
  rows.forEach((r) => r.students.forEach((s) => s.status !== "done" && (s.difficulty >= 4 || s.helpRequests > 0) && flagged.add(s.userId)));
  const head = pageHead({
    kicker: t("tmKicker"),
    title: t("ttTitle"),
    lead: t("ttLead"),
    actions: `<button type="button" class="btn btn-white btn-lg" data-action="open-add-task" data-magnetic>${I.plus}${esc(t("addTask"))}</button>`,
    icons: icon3d("calendar", { style: "right:7%;top:16%", size: 150, rot: 8, hideSm: true }) + icon3d("send", { style: "right:24%;bottom:12%", size: 100, rot: -10, depth: 0.8, hideSm: true }),
    stats: [
      [rows.length, t("st_given")],
      [rows.filter((r) => r.task.type === "exam").length, t("f_exam")],
      [flagged.size, t("st_needsHelp"), true],
    ],
  });
  const titleOf = (id) => rows.find((r) => r.task._id === id)?.task.title ?? "";
  const statusLabel = { todo: t("statusTodo"), in_progress: t("statusDoing"), done: t("statusDone") };
  const cards = rows
    .map((r) => {
      const due = dueInfo(r.task.dueDate);
      const pct = (n) => (r.total ? (n / r.total) * 100 : 0);
      const blockedN = r.students.filter((s) => s.blocked).length;
      const flags = r.students
        .filter((s) => s.status !== "done")
        .map((s) => {
          const why = [];
          if (s.difficulty >= 4) why.push(t("why_stuck"));
          if (s.helpRequests > 0) why.push(t("why_help", { n: s.helpRequests }));
          if (s.blocked) why.push(t("why_blocked"));
          return why.length ? `<div>${esc(s.name)}: ${esc(why.join(", "))}</div>` : "";
        })
        .filter(Boolean);
      return `<article class="card" data-tilt="2">
        <div class="card-top">${typeTag(r.task.type)}
          <span><span class="tag brand">${esc(t("doneOf", { done: r.done, total: r.total }))}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete-task" data-id="${r.task._id}" aria-label="${esc(t("delete"))}">${I.trash}</button></span></div>
        <h3 class="task-title" style="margin-top:10px">${esc(r.task.title)}</h3>
        <div class="meta"><span class="subject">${esc(r.task.subject)}</span><span>${esc(r.className ?? "")}</span><span class="${due.cls}">${esc(due.text)}</span><span>${r.task.estimatedMinutes} ${esc(t("minutesUnit"))}</span></div>
        ${r.task.dependsOn.length ? `<p class="dep-line">${I.lock.replace("<svg", '<svg class="inline-ic"')} ${esc(t("dependsShort", { list: r.task.dependsOn.map(titleOf).filter(Boolean).join(", ") }))}</p>` : ""}
        <div class="stack"><span class="s-done" style="width:${pct(r.done)}%"></span><span class="s-doing" style="width:${pct(r.inProgress)}%"></span><span class="s-todo" style="width:${pct(r.todo)}%"></span></div>
        <div class="legend"><span><i style="background:var(--leaf)"></i>${esc(t("statusDone"))} ${r.done}</span><span><i style="background:var(--sun)"></i>${esc(t("statusDoing"))} ${r.inProgress}</span>
          <span><i style="background:#d6e2ea"></i>${esc(t("statusTodo"))} ${r.todo}</span>${r.avgDifficulty != null ? `<span>${esc(t("avgDifficulty", { n: r.avgDifficulty }))}</span>` : ""}
          ${r.helpRequests ? `<span>${esc(t("helpRequests", { n: r.helpRequests }))}</span>` : ""}${blockedN ? `<span>${esc(t("blockedStudents", { n: blockedN }))}</span>` : ""}</div>
        <div class="attention ${flags.length ? "" : "ok"}"><b>${esc(t("needsAttention"))}</b>${flags.length ? flags.join("") : esc(t("nobodyStuck"))}</div>
        <details><summary>${esc(t("students"))} (${r.total})</summary>${r.students
          .map((s) => `<div class="student-row"><span>${esc(s.name)}${s.blocked ? ` ${I.lock.replace("<svg", '<svg class="inline-ic"')}` : ""}</span>${dots(s.difficulty)}<span class="status-pill ${s.status}">${esc(statusLabel[s.status])}</span></div>`)
          .join("")}</details>
      </article>`;
    })
    .join("");
  return `${head}<section class="section-sm"><div class="container">
    ${rows.length ? `<div class="grid-3" data-reveal style="grid-template-columns:repeat(auto-fill,minmax(330px,1fr))">${cards}</div>` : `<div class="empty">${esc(t("noAssignments"))}</div>`}
  </div></section>`;
}

// ------------------------------------------------------------------ ProblemHunt
function myReportCard(p, mini = false) {
  const others = p.groupSize - 1;
  const lastNote = [...p.history].reverse().find((h) => h.note);
  return `<article class="card issue-card ${mini ? "mini" : ""}" role="button" tabindex="0" data-action="open-problem" data-id="${p._id}" data-flip-id="p-${p._id}" data-cursor="view" ${mini ? "" : 'data-tilt="4"'}>
    <div class="top">${catIcon(p.category)}<span class="num">#${p.number}</span><span class="spacer"></span>${prioTag(p.priority)}</div>
    <h3>${esc(p.title)}</h3>
    <div class="loc">${I.pin}<span>${esc(p.location)}</span></div>
    ${mini ? "" : pStepper(p.status)}
    ${!mini && others > 0 ? `<p class="group-note">${esc(t("groupedOthers", { n: others }))}</p>` : ""}
    ${!mini && lastNote ? `<p class="reply-note">${I.reply}<span><b>${esc(lastNote.byName ?? "")}:</b> ${esc(lastNote.note)}</span></p>` : ""}
    <div class="foot"><span class="who">${esc(t("seenBy"))} ${people(p.audience)}</span>${mini ? pStepStatus(p.status) : `<span>${esc(timeAgo(p.createdAt))}</span>`}</div>
  </article>`;
}
const pStepStatus = (s) => pStatusTag(s);

function groupCard(g, mini = false) {
  const r = g.root;
  return `<article class="card issue-card group-card ${g.size > 1 ? "stacked" : ""} ${mini ? "mini" : ""}" role="button" tabindex="0" data-action="open-problem" data-id="${r._id}" data-flip-id="g-${g.id}" data-cursor="view" ${mini ? "" : 'data-tilt="4"'}>
    <div class="top">${catIcon(r.category)}<span class="num">#${r.number}</span>${g.size > 1 ? `<span class="tag ai">${esc(t("reportsCount", { n: g.size }))}</span>` : ""}<span class="spacer"></span>${prioTag(g.priority)}</div>
    <h3>${esc(r.title)}</h3>
    <div class="loc">${I.pin}<span>${esc(r.location)}</span></div>
    ${mini ? "" : pStepper(g.status)}
    <div class="foot"><span class="who">${people(r.audience)}</span>${mini ? pStatusTag(g.status) : `<span>${esc(timeAgo(g.latest.createdAt))}</span>`}</div>
  </article>`;
}

function viewProblemhunt(user) {
  if (user.role === "student") {
    const mine = state.problems ?? [];
    const head = pageHead({
      kicker: t("phKicker"),
      title: t("phTitle_student"),
      lead: t("phLead_student"),
      actions: `<button type="button" class="btn btn-white btn-lg" data-action="open-report" data-magnetic>${I.camera}${esc(t("reportIssue"))}</button>`,
      icons: icon3d("megaphone", { style: "right:7%;top:16%", size: 160, rot: -8, hideSm: true }) + icon3d("puzzle", { style: "right:24%;bottom:12%", size: 100, rot: 10, depth: 0.8, hideSm: true }),
      stats: [
        [mine.length, t("st_myReports")],
        [mine.filter((p) => p.status === "seen").length, t("st_seen")],
        [mine.filter((p) => p.status === "resolved").length, t("st_resolved")],
      ],
    });
    return `${head}<section class="section-sm"><div class="container">
      ${sectionTitle("myReports")}
      ${mine.length ? `<div class="grid-3" data-reveal style="margin-top:18px">${mine.map((p) => myReportCard(p)).join("")}</div>` : `<div class="empty" style="margin-top:18px"><img src="/img/icons3d/star.png" alt="" />${esc(t("noReports"))}</div>`}
    </div></section>`;
  }
  const groups = problemGroups();
  const filters = {
    open: (g) => g.status !== "resolved",
    new: (g) => g.status === "new",
    seen: (g) => g.status === "seen",
    resolved: (g) => g.status === "resolved",
    all: () => true,
  };
  const shown = groups.filter(filters[state.phFilter] ?? filters.open);
  const isAdmin = user.role === "admin";
  const head = pageHead({
    kicker: t("phKicker"),
    title: t(isAdmin ? "phTitle_admin" : "phTitle_ops"),
    lead: t(isAdmin ? "phLead_admin" : "phLead_ops"),
    icons: icon3d(isAdmin ? "target" : "computer", { style: "right:7%;top:14%", size: 160, rot: 8, hideSm: true }) + icon3d("megaphone", { style: "right:25%;bottom:10%", size: 110, rot: -10, depth: 0.8, hideSm: true }),
    stats: [
      [groups.filter((g) => g.status === "new").length, t("st_new"), true],
      [groups.filter((g) => g.status === "seen").length, t("st_seen")],
      [groups.filter((g) => g.status === "resolved").length, t("st_resolved")],
      [(state.problems ?? []).length - groups.length, t("st_grouped")],
    ],
  });
  const chips = Object.keys(filters)
    .map((f) => `<button type="button" class="chip" data-action="ph-filter" data-value="${f}" aria-pressed="${state.phFilter === f}">${esc(t(`fs_${f}`))} <span class="n">${groups.filter(filters[f]).length}</span></button>`)
    .join("");
  return `${head}<section class="section-sm"><div class="container">
    <div class="filters"><div class="chips">${chips}</div><span class="count-live" aria-live="polite">${esc(t("countShown", { n: shown.length }))}</span></div>
    ${shown.length ? `<div class="grid-3" data-reveal>${shown.map((g) => groupCard(g)).join("")}</div>` : `<div class="empty"><img src="/img/icons3d/trophy.png" alt="" />${esc(t("noProblems"))}</div>`}
  </div></section>`;
}

// ------------------------------------------------------------------ TeacherRate
function teacherCard(tc) {
  const search = [tc.name, tc.subject, ...tc.courses].join(" ").toLowerCase();
  return `<a class="card teacher-card" href="${href("teachers", tc._id)}" data-tilt="3" data-cursor="open" data-search="${esc(search)}">
    <div class="tc-top">${avatar({ name: tc.name, role: "teacher" }, "lg")}<div class="grow"><h3>${esc(tc.name)}</h3><small>${esc(tc.subject ?? "")}</small></div></div>
    <div class="stars-row">${stars(tc.rating ?? 0)}${tc.rating != null ? `<b>${tc.rating.toFixed(1)}</b>` : ""}<span>${esc(tc.reviewCount ? t("reviewsN", { n: tc.reviewCount }) : t("noRatings"))}</span></div>
    ${tc.topTraits.length ? `<div class="trait-tags">${tc.topTraits.map((k) => `<span class="tag leaf">${I.check}${esc(t(`trait_${k}`))}</span>`).join("")}</div>` : ""}
    <p class="courses">${tc.courses.map(esc).join(" · ")}</p>
  </a>`;
}

function viewTeacherList(user) {
  const list = state.teachers ?? [];
  const total = list.reduce((n, x) => n + x.reviewCount, 0);
  const head = pageHead({
    kicker: t("trKicker"),
    title: t("trTitle"),
    lead: t(user.role === "admin" ? "trLead_admin" : "trLead"),
    icons: icon3d("star", { style: "right:7%;top:14%", size: 150, rot: 10, hideSm: true }) + icon3d("medal", { style: "right:25%;bottom:10%", size: 110, rot: -8, depth: 0.8, hideSm: true }),
    stats: [
      [list.length, t("st_teachers")],
      [total, t("st_reviews")],
    ],
  });
  const q = state.trQuery.trim().toLowerCase();
  const match = (tc) => !q || [tc.name, tc.subject, ...tc.courses].join(" ").toLowerCase().includes(q);
  return `${head}<section class="section-sm"><div class="container">
    <div class="filters">
      <label class="search-bar">${I.search}<input id="teacher-search" type="search" autocomplete="off" placeholder="${esc(t("trSearch"))}" value="${esc(state.trQuery)}" aria-label="${esc(t("trSearch"))}" /></label>
      <span class="count-live" id="teacher-count" aria-live="polite">${esc(t("trCount", { n: list.filter(match).length }))}</span>
    </div>
    <div class="grid-3" data-reveal id="teacher-grid">${list.map((tc) => teacherCard(tc).replace('class="card teacher-card"', `class="card teacher-card"${match(tc) ? "" : " hidden"}`)).join("")}</div>
    <div class="empty" id="teacher-empty" ${list.some(match) ? "hidden" : ""}>${esc(t("trNone"))}</div>
  </div></section>`;
}

function traitBars(stats) {
  return `<div class="trait-grid">${stats
    .map((st) => {
      const n = st.yes + st.no;
      const pct = n ? Math.round((st.yes / n) * 100) : 0;
      return `<div class="trait-bar ${n ? "" : "empty"}" title="${esc(`${t("yes")} ${st.yes} · ${t("no")} ${st.no}`)}">
        <span class="y" style="width:${pct}%"></span><span class="l">${esc(t(`trait_${st.key}`))}</span><small>${n ? `${pct}%` : esc(t("noAnswers"))}</small></div>`;
    })
    .join("")}</div>
    <div class="legend" style="margin-top:12px"><span><i style="background:#9fe6cf"></i>${esc(t("yes"))}</span><span><i style="background:var(--coral-tint)"></i>${esc(t("no"))}</span></div>`;
}

function starBars(counts) {
  const max = Math.max(1, ...counts);
  return `<div class="star-bars">${[5, 4, 3, 2, 1]
    .map((n) => `<div><span>${n}${svg(STAR, true)}</span><span class="bar"><span style="width:${(counts[n - 1] / max) * 100}%"></span></span><b>${counts[n - 1]}</b></div>`)
    .join("")}</div>`;
}

function summaryCard() {
  const sm = state.summary;
  const body = !sm || sm.loading
    ? `<div class="loading-line"><span class="spinner"></span>${esc(t("summaryLoading"))}</div><div class="skeleton"><div></div><div style="width:85%"></div><div style="width:70%"></div></div>`
    : sm.error && !sm.data
      ? `<p class="note-warn">${esc(t("error", { err: sm.error }))}</p>`
      : (() => {
          const d = sm.data;
          const list = (key, items, cls) => (items.length ? `<h4>${esc(t(key))}</h4><ul class="bullets ${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
          return `<p class="summary-overview">${esc(d.overview)}</p>${list("summaryPros", d.pros, "pros")}${list("summaryCons", d.cons, "cons")}${list("summaryTips", d.tips, "tips")}
            ${d.error && d.source !== "ai" ? `<p class="note-warn">${esc(t("aiError", { err: d.error.slice(0, 200) }))}</p>` : ""}
            <div class="row-between" style="margin-top:14px;align-items:center">${sourceTag(d.source, d.model)}<button type="button" class="btn btn-ghost btn-sm" data-action="summary-refresh">${I.refresh}${esc(t("summaryRefresh"))}</button></div>`;
        })();
  return `<div class="card ai-summary" id="tr-summary"><h3 class="card-title">${I.sparkle.replace("<svg", '<svg class="inline-ic sparkle-ic"')} ${esc(t("summaryTitle"))}</h3>${body}</div>`;
}

function reviewCard(r, user) {
  const admin = user.role === "admin";
  const answered = r.traits.length
    ? `<div class="rv-traits">${r.traits.map((a) => `<span class="${a.value ? "yes" : "no"}">${a.value ? I.check : I.close}${esc(t(`trait_${a.key}`))}</span>`).join("")}</div>`
    : "";
  return `<article class="card review-card ${r.mine ? "mine" : ""}" data-id="${r._id}" data-flip-id="rv-${r._id}">
    <div class="rv-top"><span class="course-pill">${esc(r.subject)}</span>${r.mine ? `<span class="tag brand">${esc(t("yourReview"))}</span>` : ""}
      ${admin && r.authorName ? `<span class="tag">${esc(t("byAuthor", { name: r.authorName }))}</span>` : ""}${admin && r.flagged ? `<span class="tag coral">${esc(t("flaggedTag"))}</span>` : ""}</div>
    <div class="rv-date">${esc(fmtDate(r.createdAt))}</div>
    ${r.text ? `<p class="rv-text">${esc(r.text)}</p>` : ""}
    ${answered}
    <div class="rv-foot">
      <button type="button" class="like" data-action="like-review" data-id="${r._id}" aria-pressed="${r.liked}" ${user.role === "student" ? "" : "disabled"} aria-label="${esc(t("like"))}">${I.heart}<span>${r.likes}</span></button>
      <span class="spacer"></span>${stars(r.rating, "sm")}
      ${r.mine || admin ? `<button type="button" class="btn btn-ghost btn-sm icon-only" data-action="delete-review" data-id="${r._id}" aria-label="${esc(t("delete"))}">${I.trash}</button>` : ""}
    </div>
  </article>`;
}

function sortedReviews(list) {
  const by = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    liked: (a, b) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt),
    high: (a, b) => b.rating - a.rating || b.likes - a.likes,
    low: (a, b) => a.rating - b.rating || b.likes - a.likes,
  };
  return [...list].sort(by[state.trSort] ?? by.newest);
}

function viewTeacherProfile(user) {
  const p = state.teacher;
  if (!p) return `<div class="container section"><div class="empty">${esc(t("noReviews"))}</div></div>`;
  const tc = p.teacher;
  const likes = p.reviews.reduce((n, r) => n + r.likes, 0);
  const own = user.role === "teacher";
  const head = `<section class="band page-head teacher-head on-blue" data-parallax>
    <div class="glow" aria-hidden="true"></div><div class="dots" aria-hidden="true"></div>
    ${icon3d("star", { style: "right:7%;top:14%", size: 140, rot: 12, hideSm: true })}${icon3d("notebook", { style: "right:24%;bottom:8%", size: 100, rot: -10, depth: 0.8, hideSm: true })}
    <div class="band-inner">
      <p class="kicker mask"><span data-rise>${own ? esc(t("nav_teachers_teacher")) : `<a class="back-link" href="${href("teachers")}">${I.back}${esc(t("allTeachers"))}</a>`}</span></p>
      <h1 data-split="lines" data-hero>${esc(tc.name)}</h1>
      <p class="lead mask"><span data-rise>${esc([tc.subject, own ? t("trLead_teacher") : ""].filter(Boolean).join(" · "))}</span></p>
      <div class="rating-big mask"><span data-rise>${stars(tc.rating ?? 0, "lg")}<b>${tc.rating != null ? `<span data-count="${tc.rating}" data-decimals="1">${tc.rating.toFixed(1)}</span>/5` : esc(t("noRatings"))}</b></span></div>
      <div class="cta-row">
        ${p.canReview ? `<button type="button" class="btn btn-white btn-lg" data-action="open-review" data-magnetic>${I.pen}${esc(t("writeReview"))}</button>` : ""}
        <button type="button" class="btn btn-glass btn-lg" data-action="share-teacher" data-magnetic>${I.share}${esc(t("share"))}</button>
      </div>
      <div class="stat-row">${[
        [p.reviews.length, t("st_reviews")],
        [likes, t("st_likes")],
      ]
        .map(statChip)
        .join("")}</div>
    </div>
  </section>`;
  const sortSel = `<label class="sort-select"><span class="sr-only">${esc(t("sortLabel"))}</span><select id="review-sort">${["newest", "liked", "high", "low"]
    .map((k) => `<option value="${k}" ${state.trSort === k ? "selected" : ""}>${esc(t(`sort_${k}`))}</option>`)
    .join("")}</select>${I.chevron}</label>`;
  const reviews = sortedReviews(p.reviews);
  return `${head}<section class="section-sm"><div class="container"><div class="tr-grid">
    <div class="stack-gap">
      <div class="card"><h3 class="card-title" data-split="words">${rich(t("traitsTitle"))}</h3><div style="margin-top:16px">${traitBars(p.traits)}</div>
        <h4 class="mini-head">${esc(t("starsTitle"))}</h4>${starBars(p.ratingCounts)}</div>
      ${summaryCard()}
      <div class="card"><h3 class="card-title">${esc(t("coursesTitle"))}</h3><ul class="course-list">${tc.courses.map((c) => `<li>${I.book}${esc(c)}</li>`).join("")}</ul></div>
    </div>
    <div>
      <div class="row-between reviews-head">${sectionTitle("reviewsTitle", ";font-size:clamp(26px,3vw,38px)")}${sortSel}</div>
      <div class="review-list" data-reveal>${reviews.length ? reviews.map((r) => reviewCard(r, user)).join("") : `<div class="empty"><img src="/img/icons3d/chat.png" alt="" />${esc(t("noReviews"))}</div>`}</div>
    </div>
  </div></div></section>`;
}

const viewTeachers = (user) => (teacherPageId() ? viewTeacherProfile(user) : viewTeacherList(user));

/** Loads (or reuses) Gemma 4's summary of the open teacher page, then redraws only that card. */
async function ensureSummary({ regenerate = false } = {}) {
  const id = state.teacher?.teacher._id;
  if (state.route !== "teachers" || !id || !teacherPageId()) return;
  const key = `${id}:${state.lang}:${state.teacher.reviews.length}`;
  if (!regenerate && state.summary?.key === key && (state.summary.loading || state.summary.data)) return;
  state.summary = { key, loading: true, data: null };
  const paint = () => {
    const el = $("#tr-summary");
    if (el) el.outerHTML = summaryCard();
  };
  paint();
  try {
    const d = (await gql(Q.teacherSummary, { userId: state.userId, teacherId: id, lang: state.lang, regenerate })).hugjuulaiTeacherSummary;
    if (state.summary?.key !== key) return;
    state.summary = { key, loading: false, data: d };
  } catch (e) {
    if (state.summary?.key !== key) return;
    state.summary = { key, loading: false, data: null, error: e.message };
  }
  paint();
  motion.staggerIn(document.querySelectorAll("#tr-summary > *, #tr-summary li"));
}

const viewTaskmind = (user) => (user.role === "teacher" ? viewTmTeacher(user) : viewTmStudent(user));
const VIEWS = { home: viewHome, taskmind: viewTaskmind, problemhunt: viewProblemhunt, teachers: viewTeachers };

// ------------------------------------------------------------------ render
function renderView({ entrance = false } = {}) {
  const user = me();
  if (!user) return;
  const view = $("#view");
  view.innerHTML = (VIEWS[state.route] ?? viewHome)(user);
  motion.enhance(view, { entrance });
  if (state.route === "teachers") ensureSummary();
  if (state.highlight) {
    const el = view.querySelector(`[data-id="${state.highlight}"]`);
    if (el) {
      el.classList.add("hl");
      motion.pulse(el);
      setTimeout(() => el.classList.remove("hl"), 2400);
    }
    state.highlight = null;
  }
}
function renderAll({ entrance = false } = {}) {
  document.documentElement.lang = state.lang;
  renderHeader();
  renderFooter();
  renderView({ entrance });
}
async function onRoute() {
  const user = me();
  if (!user) return;
  let route = routeFromHash();
  if (!VIEWS[route] || !allowed(route)) {
    route = "home";
    history.replaceState(null, "", "#/");
  }
  state.route = route;
  state.param = route === "home" ? null : paramFromHash();
  state.menuOpen = false;
  state.mobileOpen = false;
  closeDrawer();
  try {
    await loadersFor(route, user.role);
  } catch (e) {
    toast(t("error", { err: e.message }));
  }
  window.scrollTo(0, 0);
  renderAll({ entrance: true });
  $("#view").focus({ preventScroll: true });
}

// ------------------------------------------------------------------ overlays
function openOverlay() {
  $("#backdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeOverlay() {
  if (!state.drawer && !state.modal) {
    $("#backdrop").hidden = true;
    document.body.style.overflow = "";
  }
}
function closeDrawer() {
  state.drawer = null;
  const el = $("#drawer");
  el.hidden = true;
  el.innerHTML = "";
  closeOverlay();
}
function closeModal() {
  state.modal = null;
  const el = $("#modal");
  el.hidden = true;
  el.innerHTML = "";
  closeOverlay();
}

// ------------------------------------------------------------------ drawer: task (student)
function renderTaskDrawer({ animate = false } = {}) {
  const d = state.drawer;
  const item = findItem(d.taskId);
  if (!item) return closeDrawer();
  const el = $("#drawer");
  const typed = $("#ask-input")?.value ?? "";
  const scroll = el.querySelector(".drawer-body")?.scrollTop ?? 0;
  const tk = item.task;
  const due = dueInfo(tk.dueDate, item.status === "done");
  const g = d.guide;
  const items = state.inbox.items;
  const titleOf = (id) => items.find((i) => i.task._id === id);
  const depList = (ids) =>
    ids
      .map((id) => titleOf(id))
      .filter(Boolean)
      .map((i) => `<li><button type="button" data-action="open-task" data-id="${i.task._id}" data-cursor="open"><span class="dep-mark ${i.status}">${i.status === "done" ? I.check : ""}</span>${esc(i.task.title)}<small>${esc(dueInfo(i.task.dueDate, i.status === "done").text)}</small></button></li>`)
      .join("");
  const st = (s, label) => `<button type="button" data-action="set-status" data-value="${s}" aria-pressed="${item.status === s}">${esc(t(label))}</button>`;
  const diff = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= item.difficulty ? "on" : ""}" data-action="set-diff" data-n="${n}" aria-label="${esc(t("difficulty"))} ${n}"></button>`).join("");

  let guide;
  if (d.loading) {
    guide = `<div class="loading-line"><span class="spinner"></span>${esc(t("drawerLoading"))}</div><div class="skeleton"><div></div><div style="width:80%"></div><div style="width:92%"></div></div>`;
  } else if (g) {
    const doneCount = item.stepsDone.filter((i) => i < g.steps.length).length;
    guide = `<p style="margin:0 0 10px">${esc(g.overview)}</p>
      <div class="bar"><span style="width:${g.steps.length ? (doneCount / g.steps.length) * 100 : 0}%"></span></div>
      <p class="faint" style="margin:0 0 10px;font-weight:800;font-size:13px">${esc(t("stepsProgress", { done: doneCount, total: g.steps.length }))}</p>
      <ol class="steps" data-stagger>${g.steps
        .map((s, i) => {
          const on = item.stepsDone.includes(i);
          return `<li><label class="step ${on ? "checked" : ""}"><input type="checkbox" data-action="toggle-step" data-idx="${i}" ${on ? "checked" : ""} />
            <span><b>${i + 1}. ${esc(s.title)}</b><span class="d">${esc(s.detail)}</span></span><span class="m">${s.minutes} ${esc(t("minutesUnit"))}</span></label></li>`;
        })
        .join("")}</ol>
      ${g.tips.length ? `<h4>${esc(t("tips"))}</h4><ul class="bullets">${g.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${g.checkUnderstanding.length ? `<h4>${esc(t("selfCheck"))}</h4><ul class="bullets">${g.checkUnderstanding.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${g.error && g.source !== "ai" ? `<p class="note-warn">${esc(t("aiErrorGuide", { err: g.error }))}</p>` : ""}
      <div class="row-between" style="margin-top:16px;align-items:center">${sourceTag(g.source, g.model)}<button type="button" class="btn btn-ghost btn-sm" data-action="regenerate">${I.refresh}${esc(t("regenerate"))}</button></div>`;
  } else guide = `<p class="note-warn">${esc(t("error", { err: d.error || "?" }))}</p>`;

  const chat = item.chat.map((c) => `<div class="bubble q">${esc(c.q)}</div><div class="bubble a">${esc(c.a)}</div>`).join("");
  const pending = d.asking ? `<div class="bubble q">${esc(d.asking)}</div><div class="bubble a"><span class="loading-line" style="margin:0"><span class="spinner"></span>${esc(t("thinking"))}</span></div>` : "";
  const blockedNote = item.blockedBy.length && item.status !== "done"
    ? `<p class="lock-note">${I.lock}<span>${esc(t("waitingFor", { list: item.blockedBy.map((id) => titleOf(id)?.task.title ?? "").join(", ") }))}</span></p>`
    : "";

  el.innerHTML = `<div class="drawer-head"><div style="flex:1;min-width:0">
      <div class="meta" style="margin:0">${typeTag(tk.type)}<span class="subject">${esc(tk.subject)}</span><span class="${due.cls}">${esc(due.text)}</span></div>
      <h3>${esc(tk.title)}</h3></div>
      <button type="button" class="icon-btn" data-action="close-drawer" aria-label="${esc(t("close"))}">${I.close}</button></div>
    <div class="drawer-body">
      ${blockedNote}
      ${tk.description ? `<p style="margin:0 0 12px">${esc(tk.description)}</p>` : ""}
      <div class="meta" style="margin:0 0 14px"><span>${esc(tk.createdByName ?? "")}</span><span>${tk.estimatedMinutes} ${esc(t("minutesUnit"))}</span><span title="${esc(t("weight"))}">${dots(tk.weight)}</span></div>
      <div class="task-actions" style="margin:0"><div class="seg" role="group">${st("todo", "statusTodo")}${st("in_progress", "statusDoing")}${st("done", "statusDone")}</div>
        <span class="diff">${esc(t("difficulty"))}<span class="diff-dots">${diff}</span></span></div>
      ${tk.dependsOn.length ? `<h4>${esc(t("dependsOnTitle"))}</h4><ul class="deps">${depList(tk.dependsOn)}</ul>` : ""}
      ${item.unlocks.length ? `<h4>${esc(t("unlocksTitle"))}</h4><ul class="deps">${depList(item.unlocks)}</ul>` : ""}
      <h4>${esc(t("steps"))}</h4>${guide}
      <h4>${esc(t("helpTitle"))}</h4><p class="note">${esc(t("helpNote"))}</p>
      <div class="chips help-chips">
        <button type="button" class="chip" data-action="help" data-key="explain" ${d.asking ? "disabled" : ""}>${I.bulb}${esc(t("help_explain"))}</button>
        <button type="button" class="chip" data-action="help" data-key="example" ${d.asking ? "disabled" : ""}>${I.example}${esc(t("help_example"))}</button>
        <button type="button" class="chip" data-action="help" data-key="quiz" ${d.asking ? "disabled" : ""}>${I.quiz}${esc(t("help_quiz"))}</button>
      </div>
      <div class="chat" style="margin-top:12px">${chat}${pending}</div>
      <form id="ask-form" class="ask"><input id="ask-input" type="text" maxlength="500" autocomplete="off" placeholder="${esc(t("askPlaceholder"))}" ${d.asking ? "disabled" : ""} />
        <button type="submit" class="btn btn-primary icon-btn" style="width:46px;height:46px" ${d.asking ? "disabled" : ""} aria-label="${esc(t("send"))}">${I.send}</button></form>
    </div>`;
  el.hidden = false;
  openOverlay();
  if (typed && !d.asking) $("#ask-input").value = typed;
  el.querySelector(".drawer-body").scrollTop = scroll;
  if (animate) motion.drawerIn(el);
}

async function openTask(taskId, { regenerate = false, start = false } = {}) {
  const item = findItem(taskId);
  if (!item) return;
  const cached = item.guide && item.guide.lang === state.lang && item.guide.source === "ai";
  const wasOpen = state.drawer?.kind === "task";
  state.drawer = { kind: "task", taskId, guide: cached && !regenerate ? item.guide : null, loading: !cached || regenerate, asking: null };
  renderTaskDrawer({ animate: !wasOpen });
  // Opening marks it read; Begin's "Start" also moves it to in progress.
  if (!item.seen || (start && item.status === "todo")) {
    gql(Q.update, { userId: state.userId, taskId, seen: true, ...(start && item.status === "todo" ? { status: "in_progress" } : {}) })
      .then(async () => {
        await loadInbox();
        renderHeader();
        renderView();
        if (state.drawer?.taskId === taskId) renderTaskDrawer();
      })
      .catch(() => undefined);
  }
  if (cached && !regenerate) return;
  try {
    const g = (await gql(Q.guide, { userId: state.userId, taskId, lang: state.lang, regenerate })).hugjuulaiTaskGuide;
    const fresh = findItem(taskId);
    if (fresh) {
      fresh.guide = g;
      fresh.stepsDone = [];
    }
    if (state.drawer?.taskId === taskId) {
      state.drawer.guide = g;
      state.drawer.loading = false;
      renderTaskDrawer();
      motion.staggerIn($("#drawer").querySelectorAll(".steps > li"));
    }
  } catch (e) {
    if (state.drawer?.taskId === taskId) {
      state.drawer.loading = false;
      state.drawer.error = e.message;
      renderTaskDrawer();
    }
  }
}

async function ask(question) {
  const d = state.drawer;
  if (!d || d.asking) return;
  d.asking = question;
  renderTaskDrawer();
  const body0 = $("#drawer .drawer-body");
  body0.scrollTop = body0.scrollHeight;
  try {
    const turn = (await gql(Q.ask, { userId: state.userId, taskId: d.taskId, q: question, lang: state.lang })).hugjuulaiTaskAsk;
    const item = findItem(d.taskId);
    if (item) item.chat = [...item.chat, turn];
  } catch (e) {
    toast(t("error", { err: e.message }));
  } finally {
    if (state.drawer === d) {
      d.asking = null;
      renderTaskDrawer();
      const body = $("#drawer .drawer-body");
      body.scrollTop = body.scrollHeight;
      motion.staggerIn($("#drawer").querySelectorAll(".chat > :nth-last-child(-n+2)"));
    }
  }
}

// ------------------------------------------------------------------ drawer: problem
function renderProblemDrawer({ animate = false } = {}) {
  const d = state.drawer;
  const p = findProblem(d.problemId);
  if (!p) return closeDrawer();
  const user = me();
  const el = $("#drawer");
  const scroll = el.querySelector(".drawer-body")?.scrollTop ?? 0;
  const typedReply = $("#reply-input")?.value ?? "";
  const ops = user.role !== "student";
  const group = (state.problems ?? []).filter((x) => x.groupId === p.groupId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const root = group.find((x) => x._id === x.groupId) ?? p;
  const shown = ops ? root : p;

  const hist = shown.history
    .map((h) => {
      const label = h.action === "reported" ? t("ev_reported") : h.action === "grouped" ? t("ev_grouped") : h.action === "note" ? t("ev_note") : t("ev_status", { s: t(`status_${h.status}`) });
      return `<li class="${h.status === "resolved" ? "resolved" : ""}">${esc(label)}${h.byName ? ` · ${esc(h.byName)}` : ""}<small>${esc(timeAgo(h.at))}</small>${h.note ? `<q>${esc(h.note)}</q>` : ""}</li>`;
    })
    .join("");
  const aiCard = `<div class="ai-card"><div class="row-between" style="align-items:center"><b>${esc(t("aiDecided"))}</b>${sourceTag(shown.ai.source, shown.ai.model)}</div>
    <div class="meta" style="margin:10px 0">${catIcon(shown.category, true)}<span>${esc(t(`cat_${shown.category}`))}</span>${prioTag(shown.priority)}</div>
    <p>${esc(shown.ai.reason)}</p>
    <div class="who-list"><span class="faint" style="font-weight:800;font-size:12.5px">${esc(t("sentTo"))}</span>${shown.audience
      .map((a) => `<span class="person">${avatar(a, "sm")}<span>${esc(a.role === "admin" ? `${a.name} · ${t("forAdmin")}` : `${a.name}${a.title ? ` · ${a.title}` : ""}`)}</span></span>`)
      .join("")}</div></div>`;

  let actions = "";
  if (ops) {
    const sBtn = (s, label, cls) => `<button type="button" class="btn ${cls}" data-action="ph-status" data-value="${s}" ${root.status === s ? "disabled" : ""}>${label}</button>`;
    actions = `<div class="cta-row" style="margin-top:14px">
      ${root.status === "resolved" ? sBtn("new", `${I.refresh}${esc(t("reopen"))}`, "btn-ghost") : `${sBtn("seen", `${I.eye}${esc(t("markSeen"))}`, "btn-tint")}${sBtn("resolved", `${I.check}${esc(t("markResolved"))}`, "btn-leaf")}`}
    </div>
    <h4>${esc(t("replyTitle"))}</h4>
    <form id="reply-form" class="ask"><input id="reply-input" type="text" maxlength="400" placeholder="${esc(t("replyPh"))}" />
      <button type="submit" class="btn btn-primary icon-btn" style="width:46px;height:46px" aria-label="${esc(t("replySend"))}">${I.send}</button></form>`;
  }
  const reports = ops
    ? `<h4>${esc(t("reportsInGroup"))} · ${group.length}</h4><div class="reports">${group
        .map(
          (r) => `<div class="report"><div class="row-between" style="align-items:center"><b>#${r.number} · ${esc(r.title)}</b><small class="faint">${esc(timeAgo(r.createdAt))}</small></div>
            ${r.description ? `<p>${esc(r.description)}</p>` : ""}
            <small class="faint">${esc(r.reporterName ?? t("anonymousName"))} · ${esc(r.location)} · ${esc(t(`prio_${r.urgency}`))}</small>
            ${r.photo ? `<img class="issue-photo" src="${esc(r.photo)}" alt="" />` : ""}</div>`,
        )
        .join("")}</div>`
    : "";

  el.innerHTML = `<div class="drawer-head">${catIcon(shown.category)}<div style="flex:1;min-width:0">
      <div class="meta" style="margin:0"><span class="num faint" style="font-weight:800">#${shown.number}</span>${pStatusTag(shown.status)}${prioTag(shown.priority)}${group.length > 1 ? `<span class="tag ai">${esc(t("reportsCount", { n: group.length }))}</span>` : ""}</div>
      <h3>${esc(shown.title)}</h3></div>
      <button type="button" class="icon-btn" data-action="close-drawer" aria-label="${esc(t("close"))}">${I.close}</button></div>
    <div class="drawer-body" data-stagger>
      ${!ops && p.photo ? `<img class="issue-photo" src="${esc(p.photo)}" alt="" />` : ""}
      ${!ops && p.description ? `<p style="margin:0 0 12px">${esc(p.description)}</p>` : ""}
      <div class="meta" style="margin:0 0 12px"><span class="loc">${I.pin}${esc(shown.location)}</span><span>${esc(timeAgo(shown.createdAt))}</span></div>
      ${pStepper(shown.status)}
      ${!ops && p.groupSize > 1 ? `<p class="group-note">${esc(t("groupedOthers", { n: p.groupSize - 1 }))}</p>` : ""}
      <div style="margin-top:14px">${aiCard}</div>
      ${actions}
      ${reports}
      <h4>${esc(t("history"))}</h4><ul class="history">${hist}</ul>
    </div>`;
  el.hidden = false;
  openOverlay();
  if (typedReply) $("#reply-input").value = typedReply;
  el.querySelector(".drawer-body").scrollTop = scroll;
  if (animate) motion.drawerIn(el);
}
function openProblem(id) {
  state.drawer = { kind: "problem", problemId: id };
  renderProblemDrawer({ animate: true });
}

// ------------------------------------------------------------------ modals
function renderModal() {
  const m = state.modal;
  const el = $("#modal");
  if (!m) return closeModal();
  const user = me();
  let html = "";
  const closeBtn = `<button type="button" class="icon-btn" data-action="close-modal" aria-label="${esc(t("close"))}" style="position:relative;z-index:2">${I.close}</button>`;
  if (m.kind === "report" && m.phase === "working") {
    html = `<div class="working">${icon3d("megaphone", { style: "position:relative;margin:0 auto", size: 120, rot: 8 })}
      <div class="loading-line" style="justify-content:center;margin-top:18px"><span class="spinner"></span>${esc(t("classifying"))}</div>
      <div class="skeleton" style="max-width:360px;margin:12px auto 0"><div></div><div style="width:70%"></div></div></div>`;
  } else if (m.kind === "report" && m.phase === "done") {
    const r = m.result;
    const p = r.problem;
    html = `${icon3d("trophy", { style: "right:70px;top:8px", size: 72, rot: 10, depth: 0.5, hideSm: true })}
      <div class="modal-head"><div><h3>${esc(t("reportedTitle", { n: p.number }))}</h3><p>${esc(t("reportedLead"))}</p></div>${closeBtn}</div>
      <div class="ai-card result">
        <div class="row-between" style="align-items:center"><b>${esc(t("aiDecided"))}</b>${sourceTag(p.ai.source, p.ai.model)}</div>
        <div class="meta" style="margin:12px 0">${catIcon(p.category, true)}<span><b>${esc(t(`cat_${p.category}`))}</b></span>${prioTag(p.priority)}</div>
        <p>${esc(p.ai.reason)}</p>
        ${r.grouped ? `<p class="group-note" style="margin:0 0 12px">${esc(t("groupedWith", { n: r.groupNumber, size: r.groupSize }))}</p>` : ""}
        <div class="who-list"><span class="faint" style="font-weight:800;font-size:12.5px">${esc(t("sentTo"))}</span>${p.audience
          .map((a) => `<span class="person">${avatar(a, "sm")}<span>${esc(a.role === "admin" ? `${a.name} · ${t("forAdmin")}` : `${a.name}${a.title ? ` · ${a.title}` : ""}`)}</span></span>`)
          .join("")}</div>
        ${p.ai.error ? `<p class="note-warn">${esc(t("aiError", { err: p.ai.error }))}</p>` : ""}
      </div>
      <div class="form-actions" style="margin-top:18px"><button type="button" class="btn btn-primary btn-lg" data-action="report-done" data-id="${p._id}">${I.check}${esc(t("ok"))}</button></div>`;
  } else if (m.kind === "report") {
    const cats = ["auto", ...CATEGORIES]
      .map((c) => `<button type="button" class="chip" data-action="pick" data-group="category" data-value="${c}" aria-pressed="${m.category === c}">${c === "auto" ? I.sparkle : CAT[c]}${esc(t(`cat_${c}`))}</button>`)
      .join("");
    const urg = PRIORITIES.map((p) => `<button type="button" class="chip" data-action="pick" data-group="urgency" data-value="${p}" aria-pressed="${m.urgency === p}">${esc(t(`prio_${p}`))}</button>`).join("");
    html = `${icon3d("megaphone", { style: "right:70px;top:8px", size: 72, rot: 12, depth: 0.5, hideSm: true })}
      <div class="modal-head"><div><h3>${esc(t("reportTitle"))}</h3><p>${esc(t("reportLead"))}</p></div>${closeBtn}</div>
      <form id="report-form" class="form">
        <label class="field">${esc(t("fIssueTitle"))}<input type="text" name="title" required maxlength="160" placeholder="${esc(t("fIssueTitlePh"))}" value="${esc(m.values?.title ?? "")}" /></label>
        <div class="form-row">
          <label class="field">${esc(t("fBuilding"))}<select name="building">${t("buildings").map((b) => `<option ${m.values?.building === b ? "selected" : ""}>${esc(b)}</option>`).join("")}</select></label>
          <label class="field">${esc(t("fRoom"))}<input type="text" name="room" maxlength="60" placeholder="${esc(t("fRoomPh"))}" value="${esc(m.values?.room ?? "")}" /></label>
        </div>
        <label class="field">${esc(t("fIssueDesc"))}<textarea name="description" rows="3" maxlength="1500">${esc(m.values?.description ?? "")}</textarea></label>
        <div class="field">${esc(t("fCategory"))}<div class="chips">${cats}</div></div>
        <div class="field">${esc(t("fUrgency"))}<div class="chips">${urg}</div></div>
        <label class="photo-drop" data-cursor="view">${m.photo ? `<img src="${m.photo}" alt="" />` : I.camera}<span>${esc(m.photo ? t("fPhotoChange") : t("fPhoto"))}</span>
          <input type="file" accept="image/*" capture="environment" id="photo-input" hidden /></label>
        <label class="switch"><input type="checkbox" name="anonymous" ${m.anonymous ? "checked" : ""} /><span class="track"></span><span>${esc(t("anonymous"))}<small>${esc(t("anonymousHint"))}</small></span></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t("cancel"))}</button>
          <button type="submit" class="btn btn-primary btn-lg">${I.send}${esc(t("send"))}</button></div>
      </form>`;
  } else if (m.kind === "review" && m.phase === "checking") {
    html = `<div class="working">${icon3d("chat", { style: "position:relative;margin:0 auto", size: 110, rot: -8 })}
      <div class="loading-line" style="justify-content:center;margin-top:18px"><span class="spinner"></span>${esc(t("checkingTone"))}</div>
      <div class="skeleton" style="max-width:360px;margin:12px auto 0"><div></div><div style="width:70%"></div></div></div>`;
  } else if (m.kind === "review" && m.phase === "flagged") {
    const c = m.check;
    html = `<div class="modal-head"><div><h3>${rich(t("toneFlagged"))}</h3><p>${esc(t("toneLead"))}</p></div>${closeBtn}</div>
      <div class="ai-card result">
        <div class="row-between" style="align-items:center"><b>${esc(c.note || t("toneLead"))}</b>${sourceTag(c.source, c.model)}</div>
        <blockquote class="tone-quote">${esc(m.text)}</blockquote>
        ${c.suggestion ? `<h4 class="mini-head" style="margin-top:14px">${esc(t("toneSuggestion"))}</h4><blockquote class="tone-quote better">${esc(c.suggestion)}</blockquote>` : ""}
      </div>
      <div class="form-actions" style="margin-top:18px">
        <button type="button" class="btn btn-ghost" data-action="post-anyway">${esc(t("postAnyway"))}</button>
        <button type="button" class="btn btn-tint" data-action="edit-review">${I.pen}${esc(t("editMine"))}</button>
        ${c.suggestion ? `<button type="button" class="btn btn-primary btn-lg" data-action="use-suggestion">${I.sparkle}${esc(t("useSuggestion"))}</button>` : ""}
      </div>`;
  } else if (m.kind === "review") {
    const courses = m.courses.map((c) => `<button type="button" class="chip" data-action="pick" data-group="subject" data-value="${esc(c)}" aria-pressed="${m.subject === c}">${I.book}${esc(c)}</button>`).join("");
    const starBtns = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-action="rate" data-n="${n}" aria-pressed="${n <= m.rating}" aria-label="${n}/5">${svg(STAR, true)}</button>`).join("");
    const tri = TRAITS.map(
      (k) => `<div class="tri"><span>${esc(t(`trait_${k}`))}</span><div class="seg" role="group">
        <button type="button" data-action="trait" data-key="${k}" data-value="yes" aria-pressed="${m.traits[k] === true}">${esc(t("yes"))}</button>
        <button type="button" data-action="trait" data-key="${k}" data-value="no" aria-pressed="${m.traits[k] === false}">${esc(t("no"))}</button></div></div>`,
    ).join("");
    html = `${icon3d("star", { style: "right:70px;top:6px", size: 70, rot: 12, depth: 0.5, hideSm: true })}
      <div class="modal-head"><div><h3>${esc(t("reviewTitle", { name: m.teacherName }))}</h3><p>${esc(t("reviewLead"))}</p></div>${closeBtn}</div>
      <form id="review-form" class="form">
        <div class="field">${esc(t("fCourse"))}<div class="chips">${courses}</div></div>
        <div class="field">${esc(t("fStars"))}<div class="star-input" role="group" aria-label="${esc(t("fStars"))}">${starBtns}<b class="star-val">${m.rating ? `${m.rating}/5` : ""}</b></div></div>
        <div class="field">${esc(t("fTraits"))}<div class="tri-grid">${tri}</div></div>
        <label class="field">${esc(t("fText"))}<textarea name="text" rows="4" maxlength="1500" placeholder="${esc(t("fTextPh"))}">${esc(m.text)}</textarea></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t("cancel"))}</button>
          <button type="submit" class="btn btn-primary btn-lg">${I.send}${esc(t("send"))}</button></div>
      </form>`;
  } else if (m.kind === "add-task") {
    const mine = (state.progress ?? []).map((r) => r.task);
    const classes = state.classes.map((c) => `<option value="${c._id}" ${c._id === user.classId ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    const deps = mine.length
      ? mine.map((tk) => `<button type="button" class="chip" data-action="toggle-dep" data-id="${tk._id}" aria-pressed="${m.deps.includes(tk._id)}">${tk.type === "exam" ? I.exam : I.book}${esc(tk.title)}</button>`).join("")
      : `<span class="faint">${esc(t("fDependsNone"))}</span>`;
    const exam = m.type === "exam";
    html = `${icon3d("send", { style: "right:70px;top:8px", size: 70, rot: 10, depth: 0.5, hideSm: true })}
      <div class="modal-head"><div><h3>${esc(t("addTaskTitle"))}</h3><p>${esc(t("addTaskLead"))}</p></div>${closeBtn}</div>
      <form id="task-form" class="form">
        <div class="field">${esc(t("fType"))}<div class="seg big" role="group">
          <button type="button" data-action="pick-type" data-value="homework" aria-pressed="${!exam}">${I.book}${esc(t("type_homework"))}</button>
          <button type="button" data-action="pick-type" data-value="exam" aria-pressed="${exam}">${I.exam}${esc(t("type_exam"))}</button></div></div>
        <label class="field">${esc(t("fTitle"))}<input type="text" name="title" required maxlength="200" /></label>
        <label class="field">${esc(t("fDesc"))}<textarea name="description" rows="2" maxlength="2000"></textarea></label>
        <div class="form-row">
          <label class="field">${esc(t("fSubject"))}<input type="text" name="subject" maxlength="60" value="${esc(user.subject ?? "")}" /></label>
          <label class="field">${esc(t("fClass"))}<select name="classId">${classes}</select></label>
        </div>
        <div class="form-row">
          <label class="field">${esc(t("fDue"))}<input type="datetime-local" name="dueDate" required value="${defaultDue(exam ? 5 : 2, 9)}" /></label>
          <label class="field">${esc(t("fMinutes"))}<input type="number" name="estimatedMinutes" min="5" max="600" step="5" value="${exam ? 45 : 30}" /></label>
        </div>
        <label class="field" style="max-width:50%">${esc(t("fWeight"))}<select name="weight">${[1, 2, 3, 4, 5].map((w) => `<option ${w === (exam ? 5 : 3) ? "selected" : ""}>${w}</option>`).join("")}</select></label>
        <div class="field">${esc(t("fDepends"))}<div class="chips">${deps}</div></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">${esc(t("cancel"))}</button>
          <button type="submit" class="btn btn-primary btn-lg">${I.send}${esc(t("sendToClass"))}</button></div>
      </form>`;
  }
  const wasHidden = el.hidden;
  el.innerHTML = html;
  el.hidden = false;
  openOverlay();
  if (wasHidden) {
    motion.modalIn(el);
    el.querySelector("input[name=title]")?.focus();
  } else motion.fadeIn(el.firstElementChild);
}
function openReview() {
  const tc = state.teacher?.teacher;
  if (!tc) return;
  closeDrawer();
  state.modal = { kind: "review", phase: "form", teacherId: tc._id, teacherName: tc.name, courses: tc.courses, subject: tc.courses[0], rating: 0, traits: {}, text: "" };
  renderModal();
}
async function submitReview(force = false) {
  const m = state.modal;
  if (!m || m.kind !== "review") return;
  const box = $("#review-form textarea[name=text]");
  if (box) m.text = box.value.trim();
  if (!m.rating) return toast(t("needStars"));
  m.phase = "checking";
  renderModal();
  try {
    const doc = {
      teacherId: m.teacherId,
      subject: m.subject,
      rating: m.rating,
      text: m.text,
      traits: Object.entries(m.traits).map(([key, value]) => ({ key, value })),
    };
    const r = (await gql(Q.reviewSubmit, { userId: state.userId, doc, lang: state.lang, force })).hugjuulaiReviewSubmit;
    if (!r.posted) {
      m.check = r.check;
      m.phase = "flagged";
      renderModal();
      motion.staggerIn($("#modal").querySelectorAll(".ai-card > *"));
      return;
    }
    closeModal();
    toast(t("reviewPosted"), "star");
    state.trSort = "newest";
    state.summary = null;
    state.highlight = r.review._id;
    await loadTeacher(m.teacherId);
    renderView();
  } catch (e) {
    m.phase = "form";
    renderModal();
    toast(t("error", { err: e.message }));
  }
}
async function openModal(kind) {
  closeDrawer();
  if (kind === "add-task" && !state.progress) await loadProgress().catch(() => undefined);
  state.modal = { kind, phase: "form", category: "auto", urgency: "medium", anonymous: false, photo: null, type: "homework", deps: [] };
  renderModal();
}
async function readPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 900 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
const reportValues = () => {
  const form = $("#report-form");
  if (!form) return {};
  const f = new FormData(form);
  return { title: f.get("title"), building: f.get("building"), room: f.get("room"), description: f.get("description") };
};

// ------------------------------------------------------------------ toast
function toast(message, icon) {
  const el = $("#toast");
  el.innerHTML = `${icon ? `<img src="/img/icons3d/${icon}.png" alt="" />` : ""}<span>${esc(message)}</span>`;
  el.hidden = false;
  motion.toastIn(el);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

// ------------------------------------------------------------------ actions
async function updateTask(taskId, patch) {
  try {
    await gql(Q.update, { userId: state.userId, taskId, ...patch });
    const flip = motion.flipState();
    await loadInbox();
    renderHeader();
    renderView();
    motion.flipFrom(flip);
    if (state.drawer?.kind === "task") renderTaskDrawer();
  } catch (e) {
    toast(t("error", { err: e.message }));
  }
}
async function runBegin() {
  if (state.beginning) return;
  state.beginning = true;
  renderView();
  try {
    const plan = (await gql(Q.begin, { userId: state.userId, lang: state.lang })).hugjuulaiBegin;
    await loadInbox();
    state.inbox.begin = plan;
  } catch (e) {
    toast(t("error", { err: e.message }));
  }
  state.beginning = false;
  const flip = motion.flipState();
  renderView();
  motion.flipFrom(flip);
  motion.staggerIn(document.querySelectorAll(".begin-card > *, .queue-card li"));
}
async function refreshProblems({ flip = true } = {}) {
  const state0 = flip ? motion.flipState() : null;
  await loadProblems();
  renderHeader();
  renderView();
  motion.flipFrom(state0);
  if (state.drawer?.kind === "problem") renderProblemDrawer();
}
async function switchLang(lang) {
  if (lang === state.lang) return;
  const knob = $(".lang-switch .knob");
  if (knob) knob.style.transform = `translateX(${lang === "en" ? 100 : 0}%)`;
  await new Promise((r) => setTimeout(r, window.matchMedia(motion.MQ.reduce).matches ? 0 : 280));
  state.lang = lang;
  storage.set("hj.lang", lang);
  renderAll({ entrance: true });
  if (state.drawer?.kind === "task") renderTaskDrawer();
  if (state.drawer?.kind === "problem") renderProblemDrawer();
  if (state.modal) renderModal();
}

// ------------------------------------------------------------------ events
const modalBusy = () => ["working", "checking"].includes(state.modal?.phase);
async function shareLink() {
  const url = location.href;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: document.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(t("linkCopied"), "send");
  } catch {
    // Clipboard API needs https or localhost; on a LAN address fall back to a hidden field.
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast(t("linkCopied"), "send");
    } catch {
      toast(url);
    }
    ta.remove();
  }
}
async function reloadTeacherPage({ flip = true } = {}) {
  const f = flip ? motion.flipState() : null;
  await loadTeacher(state.teacher.teacher._id);
  renderView();
  motion.flipFrom(f);
}

document.addEventListener("click", async (e) => {
  const langBtn = e.target.closest("[data-lang]");
  if (langBtn) return switchLang(langBtn.dataset.lang);
  if (e.target.id === "backdrop") {
    if (!modalBusy()) closeModal();
    closeDrawer();
    return;
  }
  if (state.menuOpen && !e.target.closest(".user-menu, [data-action=toggle-user-menu]")) {
    state.menuOpen = false;
    renderHeader();
  }
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case "toggle-user-menu":
      state.menuOpen = !state.menuOpen;
      renderHeader();
      if (state.menuOpen) motion.staggerIn(document.querySelectorAll(".user-menu > *"));
      break;
    case "toggle-mobile":
      state.mobileOpen = !state.mobileOpen;
      renderHeader();
      break;
    case "switch-user":
      state.userId = id;
      storage.set("hj.user", id);
      state.menuOpen = false;
      state.inbox = null;
      state.progress = null;
      state.problems = null;
      state.teachers = null;
      state.teacher = null;
      state.summary = null;
      state.tmFilter = "all";
      state.phFilter = "open";
      closeModal();
      if (allowed(state.route)) onRoute();
      else go("home");
      break;
    case "open-report":
      openModal("report");
      break;
    case "open-add-task":
      openModal("add-task");
      break;
    case "close-modal":
      if (!modalBusy()) closeModal();
      break;
    case "close-drawer":
      closeDrawer();
      break;
    case "pick":
      state.modal[el.dataset.group] = el.dataset.value;
      el.parentElement.querySelectorAll("[data-action=pick]").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
      break;
    case "pick-type": {
      state.modal.type = el.dataset.value;
      el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
      const f = $("#task-form");
      const exam = state.modal.type === "exam";
      f.estimatedMinutes.value = exam ? 45 : 30;
      f.weight.value = exam ? "5" : "3";
      f.dueDate.value = defaultDue(exam ? 5 : 2, 9);
      break;
    }
    case "toggle-dep": {
      const deps = state.modal.deps;
      state.modal.deps = deps.includes(id) ? deps.filter((x) => x !== id) : [...deps, id];
      el.setAttribute("aria-pressed", String(state.modal.deps.includes(id)));
      break;
    }
    case "begin":
      runBegin();
      break;
    case "begin-start":
      openTask(id, { start: true });
      break;
    case "open-task":
      openTask(id);
      break;
    case "set-status":
      updateTask(state.drawer.taskId, { status: el.dataset.value });
      break;
    case "set-diff":
      updateTask(state.drawer.taskId, { difficulty: Number(el.dataset.n) });
      break;
    case "regenerate":
      if (state.drawer?.kind === "task") openTask(state.drawer.taskId, { regenerate: true });
      break;
    case "help":
      ask(t(`help_${el.dataset.key}_q`));
      break;
    case "tm-tab":
      state.tmTab = el.dataset.value;
      storage.set("hj.tmTab", state.tmTab);
      renderView();
      break;
    case "tm-sort": {
      const flip = motion.flipState();
      state.tmSort = el.dataset.value;
      storage.set("hj.tmSort", state.tmSort);
      renderView();
      motion.flipFrom(flip);
      break;
    }
    case "open-review":
      openReview();
      break;
    case "rate": {
      state.modal.rating = Number(el.dataset.n);
      el.parentElement.querySelectorAll("[data-action=rate]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.n) <= state.modal.rating)));
      el.parentElement.querySelector(".star-val").textContent = `${state.modal.rating}/5`;
      break;
    }
    case "trait": {
      const k = el.dataset.key;
      const v = el.dataset.value === "yes";
      const tr = state.modal.traits;
      if (tr[k] === v) delete tr[k];
      else tr[k] = v;
      el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(tr[k] === (b.dataset.value === "yes"))));
      break;
    }
    case "use-suggestion":
      state.modal.text = state.modal.check.suggestion;
      submitReview(true);
      break;
    case "post-anyway":
      submitReview(true);
      break;
    case "edit-review":
      state.modal.phase = "form";
      renderModal();
      $("#review-form textarea")?.focus();
      break;
    case "like-review": {
      const r = state.teacher?.reviews.find((x) => x._id === id);
      if (r) {
        // optimistic
        r.liked = !r.liked;
        r.likes += r.liked ? 1 : -1;
        el.setAttribute("aria-pressed", String(r.liked));
        el.querySelector("span").textContent = r.likes;
        if (r.liked) motion.pulse(el);
      }
      gql(Q.reviewLike, { userId: state.userId, reviewId: id }).catch((err) => toast(t("error", { err: err.message })));
      break;
    }
    case "delete-review":
      if (!confirm(t("confirmDeleteReview"))) return;
      try {
        await gql(Q.reviewDelete, { userId: state.userId, reviewId: id });
        state.summary = null;
        toast(t("reviewDeleted"));
        await reloadTeacherPage();
      } catch (err) {
        toast(t("error", { err: err.message }));
      }
      break;
    case "share-teacher":
      shareLink();
      break;
    case "summary-refresh":
      ensureSummary({ regenerate: true });
      break;
    case "tm-filter": {
      const flip = motion.flipState();
      state.tmFilter = el.dataset.value;
      renderView();
      motion.flipFrom(flip);
      break;
    }
    case "ph-filter": {
      const flip = motion.flipState();
      state.phFilter = el.dataset.value;
      renderView();
      motion.flipFrom(flip);
      break;
    }
    case "open-problem":
      openProblem(id);
      break;
    case "ph-status": {
      const pid = state.drawer?.problemId;
      if (!pid) break;
      try {
        await gql(Q.status, { userId: state.userId, problemId: pid, status: el.dataset.value });
        toast(t("statusUpdated"), el.dataset.value === "resolved" ? "trophy" : "rocket");
        await refreshProblems();
      } catch (err) {
        toast(t("error", { err: err.message }));
      }
      break;
    }
    case "report-done": {
      closeModal();
      state.highlight = id;
      if (state.route === "problemhunt" || state.route === "home") {
        await refreshProblems();
      } else go("problemhunt");
      break;
    }
    case "delete-task":
      if (!confirm(t("confirmDelete"))) return;
      try {
        await gql(Q.removeTask, { userId: state.userId, taskId: id });
        await loadProgress();
        renderView();
      } catch (err) {
        toast(t("error", { err: err.message }));
      }
      break;
    case "reset-demo":
      await gql(Q.reset);
      closeDrawer();
      closeModal();
      state.inbox = null;
      state.problems = null;
      state.progress = null;
      state.teachers = null;
      state.teacher = null;
      state.summary = null;
      await loadUsers();
      await onRoute();
      toast(t("resetDone"), "star");
      break;
    default:
      break;
  }
});

document.addEventListener("change", async (e) => {
  const target = e.target;
  if (target.id === "review-sort") {
    const flip = motion.flipState();
    state.trSort = target.value;
    storage.set("hj.trSort", state.trSort);
    renderView();
    motion.flipFrom(flip);
    $("#review-sort")?.focus();
    return;
  }
  if (target.matches("[data-action=toggle-step]") && state.drawer?.kind === "task") {
    const item = findItem(state.drawer.taskId);
    const idx = Number(target.dataset.idx);
    const set = new Set(item.stepsDone);
    if (target.checked) set.add(idx);
    else set.delete(idx);
    item.stepsDone = [...set].sort((a, b) => a - b);
    renderTaskDrawer();
    updateTask(item.task._id, { stepsDone: item.stepsDone });
  } else if (target.id === "photo-input" && target.files?.[0]) {
    try {
      state.modal.values = reportValues();
      state.modal.photo = await readPhoto(target.files[0]);
      renderModal();
    } catch (err) {
      toast(t("error", { err: err.message }));
    }
  } else if (target.name === "anonymous" && state.modal) {
    state.modal.anonymous = target.checked;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id !== "teacher-search") return;
  state.trQuery = e.target.value;
  const q = state.trQuery.trim().toLowerCase();
  let n = 0;
  document.querySelectorAll("#teacher-grid .teacher-card").forEach((c) => {
    const ok = !q || c.dataset.search.includes(q);
    c.hidden = !ok;
    if (ok) n++;
  });
  const count = $("#teacher-count");
  if (count) count.textContent = t("trCount", { n });
  const empty = $("#teacher-empty");
  if (empty) empty.hidden = n > 0;
});

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    if (form.id === "ask-form") {
      const input = $("#ask-input");
      const q = input.value.trim();
      if (q) {
        input.value = "";
        await ask(q);
      }
    } else if (form.id === "reply-form") {
      const input = $("#reply-input");
      const note = input.value.trim();
      if (note && state.drawer?.problemId) {
        input.value = "";
        await gql(Q.note, { userId: state.userId, problemId: state.drawer.problemId, note });
        toast(t("replied"), "chat");
        await refreshProblems({ flip: false });
      }
    } else if (form.id === "task-form") {
      const f = new FormData(form);
      const doc = {
        type: state.modal.type,
        title: String(f.get("title") || "").trim(),
        description: String(f.get("description") || "").trim(),
        subject: String(f.get("subject") || "").trim(),
        classId: String(f.get("classId") || ""),
        dueDate: new Date(String(f.get("dueDate"))).toISOString(),
        estimatedMinutes: Number(f.get("estimatedMinutes")) || 30,
        weight: Number(f.get("weight")) || 3,
        dependsOn: state.modal.deps,
      };
      await gql(Q.addTask, { userId: state.userId, doc });
      closeModal();
      const cls = state.classes.find((c) => c._id === doc.classId)?.name ?? "";
      toast(t("assignedClass", { cls }), "send");
      await loadProgress();
      if (state.route === "taskmind") renderView();
      else go("taskmind");
    } else if (form.id === "review-form") {
      await submitReview(false);
    } else if (form.id === "report-form") {
      const m = state.modal;
      const f = new FormData(form);
      const room = String(f.get("room") || "").trim();
      const doc = {
        title: String(f.get("title") || "").trim(),
        description: String(f.get("description") || "").trim(),
        location: [String(f.get("building") || ""), room].filter(Boolean).join(" · "),
        urgency: m.urgency,
        anonymous: Boolean(f.get("anonymous")),
        ...(m.category !== "auto" ? { category: m.category } : {}),
        ...(m.photo ? { photo: m.photo } : {}),
      };
      m.values = reportValues();
      m.phase = "working";
      renderModal();
      try {
        m.result = (await gql(Q.report, { userId: state.userId, doc, lang: state.lang })).hugjuulaiProblemReport;
        m.phase = "done";
        renderModal();
        motion.staggerIn($("#modal").querySelectorAll(".ai-card > *"));
      } catch (err) {
        m.phase = "form";
        renderModal();
        throw err;
      }
    }
  } catch (err) {
    toast(t("error", { err: err.message }));
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state.modal && !modalBusy()) closeModal();
    else if (state.drawer) closeDrawer();
    else if (state.menuOpen) {
      state.menuOpen = false;
      renderHeader();
    }
  }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[role=button][data-action]")) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
window.addEventListener(
  "scroll",
  () => {
    const nav = $(".navbar");
    if (!nav) return;
    if (window.scrollY > 12 || state.mobileOpen) nav.setAttribute("data-scrolled", "");
    else nav.removeAttribute("data-scrolled");
  },
  { passive: true },
);
window.addEventListener("hashchange", onRoute);

// ------------------------------------------------------------------ boot
(async () => {
  try {
    await loadUsers();
    motion.initCursor();
    await onRoute();
  } catch (e) {
    // The page is newer than the running server (it was started before an update).
    const stale = /Cannot query field|Unknown argument|Unknown type/.test(e.message);
    $("#view").innerHTML = `<div class="container section"><div class="empty">${esc(t(stale ? "error_stale" : "error", { err: e.message }))}</div></div>`;
  }
  loadAi();
  setInterval(loadAi, 30000);
})();
