// Motion layer, modelled on the Hackum landing page (src/motion + components/motion there):
// masked line/word reveals (SplitText), staggered card entrances, count-ups, a rotating word,
// floating + draggable 3D icons with mouse parallax, pointer tilt with a blue shine,
// a dot + ring cursor with magnetic buttons, and Flip for cards that move between columns.
// Everything respects prefers-reduced-motion; touch devices get reveals only.

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const SplitText = window.SplitText;
const Flip = window.Flip;
const Draggable = window.Draggable;
export const hasGsap = Boolean(gsap && ScrollTrigger);
if (hasGsap) gsap.registerPlugin(ScrollTrigger, ...[SplitText, Flip, Draggable].filter(Boolean));

export const DUR = { fast: 0.35, base: 0.6, slow: 0.9 };
export const EASE = { text: "power4.out", ui: "power3.out", pop: "back.out(1.7)", float: "sine.inOut" };
export const STAGGER = { words: 0.04, lines: 0.08, cards: 0.06 };
export const MQ = {
  full: "(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
};
const REVEAL_START = "top 88%";

const fontsReady = () => (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
const prefersMotion = () => window.matchMedia(MQ.motion).matches;

const markReady = (root) => {
  root.querySelectorAll("[data-split]").forEach((el) => {
    el.dataset.splitReady = "1";
    el.dataset.in = "1";
  });
};

let viewMM = null;

/**
 * Wire up motion for a freshly rendered view. `entrance` plays the reveal choreography
 * (route changes); without it the view is only made interactive (state updates).
 */
export function enhance(root, { entrance = false } = {}) {
  if (!hasGsap) return markReady(root);
  viewMM?.revert();
  viewMM = gsap.matchMedia();
  viewMM.add({ full: MQ.full, motion: MQ.motion, reduce: MQ.reduce }, (ctx) => {
    const { full, motion } = ctx.conditions;
    const cleanups = [];
    const splits = [];

    // --- text: masked line / word reveals ------------------------------------------------
    root.querySelectorAll("[data-split]").forEach((el) => {
      if (!motion || !entrance || !SplitText) {
        el.dataset.splitReady = "1";
        el.dataset.in = "1";
        return;
      }
      const mode = el.dataset.split;
      const hero = el.hasAttribute("data-hero");
      fontsReady().then(() => {
        if (!el.isConnected) return;
        const split = SplitText.create(el, {
          type: mode === "lines" || mode === "fade" ? "lines" : "words",
          mask: mode === "lines" ? "lines" : mode === "words" ? "words" : undefined,
          autoSplit: true,
          aria: "auto",
          onSplit(self) {
            el.dataset.splitReady = "1";
            const st = hero ? undefined : { trigger: el, start: REVEAL_START, once: true };
            const mark = () => {
              el.dataset.in = "1";
            };
            if (mode === "lines") {
              return gsap.from(self.lines, { yPercent: 110, duration: DUR.slow, ease: EASE.text, stagger: STAGGER.lines, scrollTrigger: st, onComplete: mark, delay: hero ? 0.15 : 0 });
            }
            if (mode === "fade") {
              return gsap.from(self.lines, { y: 18, opacity: 0, duration: DUR.base, ease: EASE.ui, stagger: 0.06, scrollTrigger: st, onComplete: mark });
            }
            if (mode === "scrub") {
              mark();
              return gsap.from(self.words, { opacity: 0.18, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 45%", scrub: true } });
            }
            return gsap.from(self.words, { yPercent: 110, duration: DUR.base, ease: EASE.text, stagger: STAGGER.words, scrollTrigger: st, onComplete: mark });
          },
        });
        splits.push(split);
      });
    });

    // --- hero lines rise from their masks, then the 3D icons pop in -------------------------
    const rise = root.querySelectorAll("[data-rise]");
    const icons = [...root.querySelectorAll("[data-float]")];
    if (motion && entrance && rise.length) {
      gsap.set(rise, { yPercent: 110, opacity: 0 });
      gsap.set(icons, { scale: 0, opacity: 0 });
      fontsReady().then(() => {
        gsap.timeline({ defaults: { ease: EASE.text } })
          .to(rise, { yPercent: 0, opacity: 1, duration: DUR.slow, stagger: STAGGER.lines })
          .to(icons, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2.2)", stagger: 0.07 }, "-=0.5");
      });
    } else if (motion && entrance && icons.length) {
      gsap.from(icons, { scale: 0, opacity: 0, duration: 0.7, ease: EASE.pop, stagger: 0.06, delay: 0.2 });
    }

    // --- idle float + mouse-depth parallax ---------------------------------------------------
    if (motion) {
      icons.forEach((el, i) => {
        const img = el.firstElementChild;
        if (!img) return;
        gsap.to(img, { y: i % 2 ? 12 : -12, rotation: i % 3 ? 5 : -5, duration: 2.6 + (i % 4) * 0.5, ease: EASE.float, yoyo: true, repeat: -1 });
      });
    }
    if (full) {
      root.querySelectorAll("[data-parallax]").forEach((zone) => {
        const movers = [...zone.querySelectorAll("[data-float]")]
          .filter((el) => !el.hasAttribute("data-drag"))
          .map((el) => ({
            d: Number(el.dataset.depth || 1),
            x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3" }),
            y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3" }),
          }));
        if (!movers.length) return;
        const onMove = (e) => {
          const b = zone.getBoundingClientRect();
          const nx = (e.clientX - b.left) / b.width - 0.5;
          const ny = (e.clientY - b.top) / b.height - 0.5;
          movers.forEach((m) => {
            m.x(nx * 40 * m.d);
            m.y(ny * 30 * m.d);
          });
        };
        zone.addEventListener("pointermove", onMove);
        cleanups.push(() => zone.removeEventListener("pointermove", onMove));
      });
    }

    // --- draggable stickers (hero icons) -------------------------------------------------------
    if (Draggable) {
      let z = 10;
      root.querySelectorAll("[data-drag]").forEach((el) => {
        const [d] = Draggable.create(el, {
          bounds: el.closest(".band") || root,
          onPress() {
            gsap.set(this.target, { zIndex: ++z });
            gsap.to(this.target, { scale: 1.08, duration: 0.2 });
          },
          onRelease() {
            gsap.to(this.target, { scale: 1, duration: 0.3, ease: "back.out(3)" });
          },
        });
        cleanups.push(() => d.kill());
      });
    }

    // --- staggered card entrances ---------------------------------------------------------------
    if (motion && entrance) {
      root.querySelectorAll("[data-reveal]").forEach((group) => {
        const items = [...group.children];
        if (!items.length) return;
        gsap.set(items, { y: 36, opacity: 0 });
        ScrollTrigger.batch(items, {
          start: "top 94%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { y: 0, opacity: 1, duration: DUR.base, ease: EASE.ui, stagger: STAGGER.cards, overwrite: true, clearProps: "transform,opacity" }),
        });
      });
    }

    // --- count-ups -------------------------------------------------------------------------------
    if (motion && entrance) {
      root.querySelectorAll("[data-count]").forEach((el) => {
        const end = Number(el.dataset.count) || 0;
        const dec = Number(el.dataset.decimals) || 0;
        const o = { v: 0 };
        el.textContent = (0).toFixed(dec);
        gsap.to(o, { v: end, duration: 1.2, ease: "power2.out", delay: 0.5, onUpdate: () => { el.textContent = o.v.toFixed(dec); } });
      });
    }

    // --- rotating word ---------------------------------------------------------------------------
    if (motion) {
      root.querySelectorAll("[data-rotator]").forEach((rot) => {
        const words = [...rot.querySelectorAll("[data-word]")];
        if (words.length < 2) return;
        gsap.set(words, { transformPerspective: 600, transformOrigin: "50% 60%" });
        gsap.set(words.slice(1), { yPercent: 100, rotationX: -50, opacity: 0 });
        const tl = gsap.timeline({ repeat: -1, delay: entrance ? 1.4 : 0.6 });
        words.forEach((w, i) => {
          const next = words[(i + 1) % words.length];
          tl.to(w, { yPercent: -100, rotationX: 50, opacity: 0, duration: 0.75, ease: "power3.inOut" }, "+=1.7")
            .fromTo(next, { yPercent: 100, rotationX: -50, opacity: 0 }, { yPercent: 0, rotationX: 0, opacity: 1, duration: 0.75, ease: "power3.inOut", immediateRender: false }, "<0.1");
        });
      });
    }

    // --- tilt + shine ----------------------------------------------------------------------------
    if (full) {
      root.querySelectorAll("[data-tilt]").forEach((el) => {
        const max = Number(el.dataset.tilt) || 5;
        let shine = el.querySelector(":scope > .shine");
        if (!shine) {
          shine = document.createElement("span");
          shine.className = "shine";
          shine.setAttribute("aria-hidden", "true");
          el.appendChild(shine);
        }
        gsap.set(el, { transformPerspective: 900 });
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" });
        const move = (e) => {
          const b = el.getBoundingClientRect();
          const px = (e.clientX - b.left) / b.width;
          const py = (e.clientY - b.top) / b.height;
          ry((px - 0.5) * 2 * max);
          rx(-(py - 0.5) * 2 * max);
          shine.style.setProperty("--mx", `${px * 100}%`);
          shine.style.setProperty("--my", `${py * 100}%`);
        };
        const enter = () => gsap.to(shine, { opacity: 1, duration: 0.3 });
        const leave = () => {
          rx(0);
          ry(0);
          gsap.to(shine, { opacity: 0, duration: 0.4 });
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerenter", enter);
        el.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerenter", enter);
          el.removeEventListener("pointerleave", leave);
        });
      });
    }

    if (entrance) fontsReady().then(() => ScrollTrigger.refresh());
    return () => {
      cleanups.forEach((fn) => fn());
      splits.forEach((s) => s.revert());
    };
  });
}

/** Capture positions of [data-flip-id] cards before a re-render. */
export const flipState = () => (hasGsap && Flip && prefersMotion() ? Flip.getState("[data-flip-id]") : null);

/** Animate cards from their captured positions to where the new render put them. */
export function flipFrom(state) {
  if (!state) return;
  Flip.from(state, {
    targets: "[data-flip-id]",
    duration: 0.65,
    ease: "power3.inOut",
    absolute: true,
    stagger: 0.02,
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: EASE.ui }),
  });
}

export function drawerIn(el) {
  if (!hasGsap || !prefersMotion()) return;
  gsap.fromTo(el, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: EASE.ui, clearProps: "transform" });
  staggerIn(el.querySelectorAll("[data-stagger] > *"));
}

export function modalIn(el) {
  if (!hasGsap || !prefersMotion()) return;
  gsap.fromTo(el, { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: EASE.ui, clearProps: "opacity,scale,y" });
  gsap.from(el.querySelectorAll("[data-float]"), { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(2.2)", stagger: 0.08, delay: 0.15 });
}

export function staggerIn(nodes) {
  if (!hasGsap || !prefersMotion() || !nodes.length) return;
  gsap.from(nodes, { y: 16, opacity: 0, duration: 0.45, ease: EASE.ui, stagger: 0.05, delay: 0.1, clearProps: "transform,opacity" });
}

export function fadeIn(el) {
  if (!hasGsap || !prefersMotion()) return;
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
}

export function toastIn(el) {
  if (!hasGsap || !prefersMotion()) return;
  gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" });
  const img = el.querySelector("img");
  if (img) gsap.fromTo(img, { rotation: -20, scale: 0.4 }, { rotation: 0, scale: 1, duration: 0.6, ease: "back.out(2.5)" });
}

/** A highlighted card pulses once (e.g. a freshly reported issue). */
export function pulse(el) {
  if (!el || !hasGsap || !prefersMotion()) return;
  gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.5)" });
}

/**
 * Custom cursor: a precise dot and an eased ring (gsap.quickTo). Over interactive elements the ring grows;
 * data-cursor="view|drag|open" turns it into a filled #0085CA disc with an icon; data-magnetic leans toward
 * the pointer. Desktop hover pointers with motion only.
 */
export function initCursor() {
  if (!hasGsap) return;
  const root = document.getElementById("cursor");
  const mm = gsap.matchMedia();
  mm.add(MQ.full, () => {
    const html = document.documentElement;
    const d = root.querySelector("[data-dot]");
    const r = root.querySelector("[data-ring]");
    const icons = [...root.querySelectorAll("[data-icon]")];
    html.classList.add("has-cursor");
    gsap.set([d, r], { xPercent: -50, yPercent: -50, opacity: 0 });
    const dx = gsap.quickTo(d, "x", { duration: 0.1, ease: "power3" });
    const dy = gsap.quickTo(d, "y", { duration: 0.1, ease: "power3" });
    const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3" });
    const INTERACTIVE = "a, button, [role='button'], label, summary, select, [data-cursor]";
    let magnet = null;
    let mx = null;
    let my = null;
    let kind = null;
    let shown = false;

    const setKind = (k) => {
      if (k === kind) return;
      kind = k;
      icons.forEach((el) => gsap.to(el, { opacity: el.dataset.icon === k ? 1 : 0, scale: el.dataset.icon === k ? 1 : 0.4, duration: 0.25 }));
      if (k === "view" || k === "drag" || k === "open") {
        gsap.to(r, { width: 64, height: 64, backgroundColor: "rgba(0,133,202,0.95)", borderColor: "rgba(0,133,202,0)", duration: 0.3, ease: "power3" });
        gsap.to(d, { scale: 0, duration: 0.2 });
      } else if (k === "link") {
        gsap.to(r, { width: 52, height: 52, backgroundColor: "rgba(0,133,202,0.12)", borderColor: "rgba(0,133,202,0.55)", duration: 0.3 });
        gsap.to(d, { scale: 0.6, duration: 0.2 });
      } else {
        gsap.to(r, { width: 32, height: 32, backgroundColor: "rgba(0,133,202,0)", borderColor: "rgba(0,133,202,0.45)", duration: 0.3 });
        gsap.to(d, { scale: 1, duration: 0.2 });
      }
    };
    const pull = (v) => gsap.utils.clamp(-6, 6, v * 0.12);
    const move = (e) => {
      if (!shown) {
        shown = true;
        gsap.to([d, r], { opacity: 1, duration: 0.2, overwrite: "auto" });
      }
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
      if (magnet && mx && my) {
        const b = magnet.getBoundingClientRect();
        mx(pull(e.clientX - (b.left + b.width / 2)));
        my(pull(e.clientY - (b.top + b.height / 2)));
      }
    };
    const over = (e) => {
      const t = e.target;
      const el = t?.closest?.(INTERACTIVE);
      const k = el?.dataset?.cursor;
      setKind(k && ["view", "drag", "open"].includes(k) ? k : el ? "link" : null);
      const m = t?.closest?.("[data-magnetic]") ?? null;
      if (m !== magnet) {
        if (magnet) gsap.to(magnet, { x: 0, y: 0, duration: 0.4, ease: "power3.out", overwrite: true });
        magnet = m;
        mx = m ? gsap.quickTo(m, "x", { duration: 0.4, ease: "power3" }) : null;
        my = m ? gsap.quickTo(m, "y", { duration: 0.4, ease: "power3" }) : null;
      }
    };
    const leave = () => {
      shown = false;
      gsap.to([d, r], { opacity: 0, duration: 0.2, overwrite: "auto" });
    };
    const down = () => gsap.to(r, { scale: 0.85, duration: 0.15 });
    const up = () => gsap.to(r, { scale: 1, duration: 0.3, ease: "back.out(3)" });
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    html.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      html.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      html.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  });
}

export const scrollTop = () => window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
