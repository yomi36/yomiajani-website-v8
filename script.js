// `projects` is defined by the generated projects-data.js, loaded
// before this file. Each entry: { slug, title, year, category, image, ratio }

const grid = document.getElementById("projectsGrid");
const projectsSection = document.querySelector(".projects");
const contactSection = document.getElementById("contact");
const watermark = document.querySelector(".projects-watermark");
const watermarkFactor = 0.045; // slower, independent drift vs. the cover items
const items = [];
let mode = null; // "scatter" | "stacked"
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouchDevice = window.matchMedia("(hover: none)").matches;

function buildItems(){
  const frag = document.createDocumentFragment();

  projects.forEach((p) => {
    const item = document.createElement("a");
    item.href = `works/${p.slug}/index.html`;
    item.className = "project-item";

    item.innerHTML = `
      <span class="project-cover">
        <img class="project-cover-art" src="${p.image}" alt="${p.title}" loading="lazy">
        <span class="project-badge">VIEW</span>
      </span>
      <span class="project-caption">
        <span>${p.title}</span>
        <span>${p.year}</span>
      </span>
    `;

    const cover = item.querySelector(".project-cover");
    cover.style.aspectRatio = String(p.ratio);
    item.ratio = p.ratio;

    frag.appendChild(item);
    items.push(item);
  });

  grid.appendChild(frag);
}

// ------------------------------------------------------------------
// Freeform scatter layout — a jittered masonry: items are bin-packed
// into loose columns (shortest column gets the next item, like normal
// masonry) but with randomized width, horizontal jitter, and vertical
// gap so nothing lines up into a strict grid.
// ------------------------------------------------------------------
function layoutScatter(){
  const containerWidth = grid.clientWidth;
  const colCount = containerWidth < 900 ? 2 : 3;
  const gutter = 56;
  const colWidth = (containerWidth - gutter * (colCount - 1)) / colCount;
  const colHeights = new Array(colCount).fill(0);

  // One drift speed per column (not per item) — items sharing a column
  // always move together, so vertical gaps between them can't close up
  // into an overlap. Speeds are spread evenly across a wider range (with
  // a little jitter) so neighboring columns read as clearly different,
  // rather than being purely random and sometimes landing close together.
  const spread = 0.22;
  const colFactors = Array.from({ length: colCount }, (_, i) => {
    if (reduceMotion) return 0;
    const base = colCount === 1 ? 0 : (i / (colCount - 1) - 0.5) * 2 * spread;
    return base + (Math.random() * 0.06 - 0.03);
  });

  // Shuffle render order slightly so the same title doesn't always land
  // in the same column on repeated layouts.
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  order.forEach((i) => {
    const item = items[i];
    const col = colHeights.indexOf(Math.min(...colHeights));

    const widthPct = 0.58 + Math.random() * 0.32; // 58%–90% of column width — bigger minimum, still varied
    const width = colWidth * widthPct;
    const leftover = colWidth - width;

    // Bias the outermost columns toward their outer edge so the grid
    // visibly spans the same width as the header/video above it, while
    // inner columns keep a fully organic random jitter.
    let jitter;
    if (col === 0){
      jitter = leftover * (Math.random() * 0.3); // hugs the left edge
    } else if (col === colCount - 1){
      jitter = leftover * (0.7 + Math.random() * 0.3); // hugs the right edge
    } else {
      jitter = leftover * (Math.random() * 0.7);
    }

    const left = col * (colWidth + gutter) + jitter;
    const gap = 110 + Math.random() * 130; // generous vertical whitespace between covers
    const top = colHeights[col] + (colHeights[col] === 0 ? 0 : gap);

    item.style.width = `${width}px`;
    item.style.left = `${left}px`;
    item.style.top = `${top}px`;
    item.style.transform = "";

    const coverHeight = width / item.ratio;
    const captionHeight = 30;
    item.baseTop = top;
    item.baseHeight = coverHeight + captionHeight;
    item.parallaxFactor = colFactors[col];
    colHeights[col] = top + coverHeight + captionHeight;
  });

  grid.style.height = `${Math.max(...colHeights)}px`;
}

function layoutStacked(){
  items.forEach((item, i) => {
    const widthPct = 78 + Math.random() * 18; // 78%–96% of the column width — some variance instead of a flat 100%
    const pushRight = i % 2 === 0;
    item.style.width = `${widthPct}%`;
    item.style.left = "";
    item.style.top = "";
    item.style.marginLeft = pushRight ? "auto" : "0";
    item.style.marginRight = pushRight ? "0" : "auto";
    item.style.transform = "";
  });
  grid.style.height = "";
}

function applyLayout(){
  const wide = window.innerWidth >= 560;
  const nextMode = wide ? "scatter" : "stacked";
  if (nextMode === mode && nextMode === "stacked") return;
  mode = nextMode;
  grid.classList.toggle("scatter", mode === "scatter");
  grid.classList.toggle("stacked", mode === "stacked");
  if (mode === "scatter") layoutScatter(); else layoutStacked();
}

buildItems();
applyLayout();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applyLayout, 150);
});

// ------------------------------------------------------------------
// Scroll parallax — recompute each item's offset from the viewport
// center on every frame while scrolling, so drift is bounded and
// self-correcting rather than accumulating over a long page.
// ------------------------------------------------------------------
let ticking = false;

function updateParallax(){
  const viewportCenter = window.innerHeight / 2;

  // Watermark drifts on its own, slower and independent of the
  // items/layout mode, so it moves at a visibly different speed.
  if (watermark && !reduceMotion){
    const wRect = watermark.getBoundingClientRect();
    const wDistance = viewportCenter - (wRect.top + wRect.height / 2);

    // In the final stretch of the projects section, add a deliberate
    // upward lift so the watermark visibly rises as the section ends —
    // a cue that you're about to leave it, rather than it just sitting
    // still until the section quietly runs out underneath it.
    let exitLift = 0;
    if (contactSection){
      const contactRect = contactSection.getBoundingClientRect();
      // Start lifting once Get in touch's top edge is about to enter the
      // viewport from below, reach full lift once it's well into view.
      const triggerStart = window.innerHeight * 1.4;
      const triggerEnd = window.innerHeight * 0.4;
      const progress = Math.min(Math.max((triggerStart - contactRect.top) / (triggerStart - triggerEnd), 0), 1);
      exitLift = -progress * 280;
    }

    watermark.style.transform = `translateY(${wDistance * watermarkFactor + exitLift}px)`;
  }

  // Touch devices have no hover — instead, whichever cover is closest
  // to the viewport center gets the same color-reveal/zoom treatment.
  // Runs regardless of layout mode (scatter or single-column stacked).
  if (isTouchDevice){
    let closestItem = null;
    let closestDist = Infinity;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const dist = Math.abs(viewportCenter - (rect.top + rect.height / 2));
      if (dist < closestDist){ closestDist = dist; closestItem = item; }
    });
    items.forEach((item) => item.classList.toggle("in-focus", item === closestItem));
  }

  if (mode !== "scatter" || reduceMotion){ ticking = false; return; }
  const gridTop = grid.getBoundingClientRect().top;
  const maxShift = window.innerHeight * 0.5;
  items.forEach((item) => {
    const itemViewportTop = gridTop + item.baseTop;
    const distance = viewportCenter - (itemViewportTop + item.baseHeight / 2);
    const clamped = Math.max(Math.min(distance, maxShift), -maxShift);
    item.style.transform = `translateY(${clamped * item.parallaxFactor}px)`;
  });
  ticking = false;
}

window.addEventListener("scroll", () => {
  if (!ticking){
    requestAnimationFrame(updateParallax);
    ticking = true;
  }
}, { passive: true });

updateParallax();

// ------------------------------------------------------------------
// Mobile nav toggle
// ------------------------------------------------------------------
const navToggle = document.getElementById("navToggle");
const navLinks = document.querySelector(".nav-links");
navToggle?.addEventListener("click", () => navLinks.classList.toggle("open"));
navLinks?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => navLinks.classList.remove("open")));
