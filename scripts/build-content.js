#!/usr/bin/env node
/**
 * build-content.js
 * ------------------------------------------------------------------
 * Turns /content/projects/<slug>/ folders into the site's project data.
 *
 * To add a project: make a new folder under content/projects/ named
 * whatever you want the URL slug to be (e.g. "my-new-project"), drop a
 * cover image in it named cover.jpg / cover.png / cover.webp, and add
 * a meta.txt with three lines:
 *
 *   title: My New Project
 *   year: 2026
 *   category: Research
 *
 * Then run this script (Cloudflare Pages runs it automatically on
 * every deploy as the build command). It will:
 *   1. Read every project folder
 *   2. Copy its cover image into /images/projects/
 *   3. Measure the image's real aspect ratio
 *   4. Write /projects-data.js, which the site loads at runtime
 *
 * No other files need to be touched to add, remove, or reorder a
 * project — just edit what's in /content/projects/.
 * ------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const sizeOf = require("image-size").default || require("image-size");

const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "projects");
const IMAGES_OUT_DIR = path.join(ROOT, "images", "projects");
const DATA_OUT_FILE = path.join(ROOT, "projects-data.js");
const WORKS_OUT_DIR = path.join(ROOT, "works");
const TEMPLATE_FILE = path.join(ROOT, "templates", "work-template.html");
const ABOUT_CONTENT_DIR = path.join(ROOT, "content", "about");
const ABOUT_TEMPLATE_FILE = path.join(ROOT, "templates", "about-template.html");
const ABOUT_OUT_DIR = path.join(ROOT, "about");
const ABOUT_IMAGES_OUT_DIR = path.join(ROOT, "images", "about");
const HOME_CONTENT_DIR = path.join(ROOT, "content", "home");
const INDEX_FILE = path.join(ROOT, "index.html");
const SHOWREEL_TEMPLATE_FILE = path.join(ROOT, "templates", "showreel-template.html");
const SHOWREEL_OUT_DIR = path.join(ROOT, "showreel");
const VALID_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function extractVimeoId(raw){
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/(\d{6,})/); // Vimeo IDs are numeric, 6+ digits — works whether given a raw ID or a full vimeo.com URL
  return match ? match[1] : null;
}

function buildVideoEmbedHtml(vimeoId, iframeClass, title){
  return `<iframe class="${iframeClass}" src="https://player.vimeo.com/video/${vimeoId}?background=1" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${title}"></iframe>`;
}

function parseMeta(text){
  const meta = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (key === "description"){
      // Everything from here to the end of the file is the description,
      // so descriptions can be as long as needed without extra syntax.
      meta.description = [line.slice(idx + 1).trim(), ...lines.slice(i + 1)].join("\n").trim();
      break;
    }
    meta[key] = line.slice(idx + 1).trim();
  }
  return meta;
}

function slugToTitleCase(slug){
  return slug.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function escapeHtml(str){
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildMetaRows(p){
  const rows = [];
  if (p.at) rows.push(["At", p.at]);
  if (p.with) rows.push(["With", p.with]);
  if (p.for) rows.push(["For", p.for]);
  if (p.role) rows.push(["Role", p.role]);

  let html = rows.map(([label, value]) => `
      <div class="meta-cell">
        <span class="meta-label">${escapeHtml(label)}</span>
        <span class="meta-value">${escapeHtml(value)}</span>
      </div>`).join("");

  if (p.readmore){
    html += `
      <div class="meta-cell meta-cell-link">
        <a href="${escapeHtml(p.readmore)}" target="_blank" rel="noopener">Read more &#8594;</a>
      </div>`;
  }
  return html;
}

function buildGalleryHtml(images){
  if (!images.length) return "<p class=\"work-gallery-empty\">No gallery images yet — add some to this project's /gallery folder.</p>";
  return images.map((img) => `
      <span class="work-gallery-item" data-ratio="${img.ratio}">
        <img src="${img.src}" alt="" loading="lazy">
      </span>`).join("");
}

// --- About page helpers ---

function readLines(filePath){
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function buildBioHtml(){
  const file = path.join(ABOUT_CONTENT_DIR, "bio.txt");
  if (!fs.existsSync(file)) return "";
  const paragraphs = fs.readFileSync(file, "utf8").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => `<p class="about-bio">${escapeHtml(p)}</p>`).join("\n      ");
}

function buildClientsHtml(){
  const names = readLines(path.join(ABOUT_CONTENT_DIR, "clients.txt"));
  return names.map((n, i) => {
    const isLast = i === names.length - 1;
    const dot = isLast ? "" : ' <span class="dot">&middot;</span>';
    return `<span class="client-item">${escapeHtml(n)}${dot}</span>`;
  }).join(" ");
}

function buildRoleEntriesHtml(filename){
  const lines = readLines(path.join(ABOUT_CONTENT_DIR, filename));
  return lines.map((line) => {
    const [role, org, date] = line.split("|").map((s) => (s || "").trim());
    return `<div class="about-entry"><span class="role">${escapeHtml(role)}</span><span class="org">${escapeHtml(org)}</span><span class="date">${escapeHtml(date)}</span></div>`;
  }).join("\n      ");
}

function buildExhibitionsHtml(){
  const lines = readLines(path.join(ABOUT_CONTENT_DIR, "exhibitions.txt"));
  return lines.map((line) => {
    const [title, org, year, url] = line.split("|").map((s) => (s || "").trim());
    const titleHtml = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`
      : escapeHtml(title);
    return `<div class="about-entry"><span class="role">${titleHtml}</span><span class="org">${escapeHtml(org)}</span><span class="date">${escapeHtml(year)}</span></div>`;
  }).join("\n      ");
}

function buildHomepageVideo(){
  const file = path.join(HOME_CONTENT_DIR, "showreel.txt");
  if (!fs.existsSync(file)){
    console.warn("No content/home/showreel.txt found — homepage video left as-is.");
    return;
  }
  const id = extractVimeoId(fs.readFileSync(file, "utf8"));
  if (!id){
    console.warn("Could not find a Vimeo ID in content/home/showreel.txt — homepage video left as-is.");
    return;
  }
  if (!fs.existsSync(INDEX_FILE)) return;
  const html = fs.readFileSync(INDEX_FILE, "utf8");
  const pattern = /src="https:\/\/player\.vimeo\.com\/video\/[^"]*"/;
  if (!pattern.test(html)){
    console.warn("Could not find the showreel <iframe> in index.html to update.");
    return;
  }
  const updated = html.replace(pattern, `src="https://player.vimeo.com/video/${id}?background=1"`);
  fs.writeFileSync(INDEX_FILE, updated);
  console.log(`Set homepage showreel to Vimeo video ${id}`);
}

function buildAboutPage(){
  if (!fs.existsSync(ABOUT_TEMPLATE_FILE)){
    console.warn("No templates/about-template.html found — skipped generating the About page.");
    return;
  }
  if (!fs.existsSync(ABOUT_CONTENT_DIR)){
    console.warn(`No content folder found at ${ABOUT_CONTENT_DIR} — skipped generating the About page.`);
    return;
  }

  // Portrait photo — same pattern as project covers: drop a file named
  // portrait.(jpg|png|webp) in content/about/, or leave it out for a
  // clearly marked placeholder.
  let portraitHtml = `<div class="about-portrait is-placeholder">Your portrait photo here</div>`;
  if (fs.existsSync(ABOUT_CONTENT_DIR)){
    const files = fs.readdirSync(ABOUT_CONTENT_DIR);
    const portraitFile = files.find((f) => VALID_IMAGE_EXT.includes(path.extname(f).toLowerCase()) && path.parse(f).name.toLowerCase() === "portrait");
    if (portraitFile){
      fs.mkdirSync(ABOUT_IMAGES_OUT_DIR, { recursive: true });
      const destName = `portrait${path.extname(portraitFile)}`;
      fs.copyFileSync(path.join(ABOUT_CONTENT_DIR, portraitFile), path.join(ABOUT_IMAGES_OUT_DIR, destName));
      portraitHtml = `<div class="about-portrait has-photo"><img src="../images/about/${destName}" alt="Yomi Ajani"></div>`;
    }
  }

  const template = fs.readFileSync(ABOUT_TEMPLATE_FILE, "utf8");
  const html = template
    .replace("{{PORTRAIT}}", portraitHtml)
    .replace("{{BIO}}", buildBioHtml())
    .replace("{{CLIENTS}}", buildClientsHtml())
    .replace("{{EXHIBITIONS}}", buildExhibitionsHtml())
    .replace("{{EXPERIENCE}}", buildRoleEntriesHtml("experience.txt"))
    .replace("{{EDUCATION}}", buildRoleEntriesHtml("education.txt"));

  fs.mkdirSync(ABOUT_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ABOUT_OUT_DIR, "index.html"), html);
  console.log("Built About page from /content/about/");
}

function main(){
  if (!fs.existsSync(CONTENT_DIR)){
    console.error(`No content folder found at ${CONTENT_DIR} — nothing to build. Creating an empty projects-data.js.`);
    fs.writeFileSync(DATA_OUT_FILE, "const projects = [];\n");
    return;
  }

  fs.mkdirSync(IMAGES_OUT_DIR, { recursive: true });
  fs.mkdirSync(WORKS_OUT_DIR, { recursive: true });
  const template = fs.existsSync(TEMPLATE_FILE) ? fs.readFileSync(TEMPLATE_FILE, "utf8") : null;

  const slugs = fs.readdirSync(CONTENT_DIR).filter((name) => {
    return fs.statSync(path.join(CONTENT_DIR, name)).isDirectory();
  });

  const projects = [];

  slugs.forEach((slug) => {
    const folder = path.join(CONTENT_DIR, slug);
    const files = fs.readdirSync(folder);

    const coverFile = files.find((f) => VALID_IMAGE_EXT.includes(path.extname(f).toLowerCase()) && path.parse(f).name.toLowerCase() === "cover");
    if (!coverFile){
      console.warn(`Skipping "${slug}" — no cover.(jpg|png|webp) found.`);
      return;
    }

    const metaFile = files.find((f) => f.toLowerCase() === "meta.txt");
    const meta = metaFile ? parseMeta(fs.readFileSync(path.join(folder, metaFile), "utf8")) : {};

    const ext = path.extname(coverFile);
    const destName = `${slug}${ext}`;
    fs.copyFileSync(path.join(folder, coverFile), path.join(IMAGES_OUT_DIR, destName));

    const dims = sizeOf(path.join(folder, coverFile));
    const ratio = Number((dims.width / dims.height).toFixed(4));

    // Copy gallery images, if any
    const galleryDir = path.join(folder, "gallery");
    const galleryOutDir = path.join(IMAGES_OUT_DIR, slug, "gallery");
    const galleryPaths = [];
    if (fs.existsSync(galleryDir)){
      fs.mkdirSync(galleryOutDir, { recursive: true });
      const galleryFiles = fs.readdirSync(galleryDir)
        .filter((f) => VALID_IMAGE_EXT.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      galleryFiles.forEach((f) => {
        fs.copyFileSync(path.join(galleryDir, f), path.join(galleryOutDir, f));
        const dims = sizeOf(path.join(galleryDir, f));
        galleryPaths.push({
          src: `../../images/projects/${slug}/gallery/${f}`,
          ratio: Number((dims.width / dims.height).toFixed(4)),
        });
      });
    }

    let videoHtml = "";
    const videoFile = path.join(folder, "video.txt");
    if (fs.existsSync(videoFile)){
      const vimeoId = extractVimeoId(fs.readFileSync(videoFile, "utf8"));
      if (vimeoId){
        videoHtml = buildVideoEmbedHtml(vimeoId, "work-video-iframe", `${meta.title || slugToTitleCase(slug)} video`);
      } else {
        console.warn(`Could not find a Vimeo ID in ${videoFile} — skipping video for "${slug}".`);
      }
    }

    projects.push({
      slug,
      title: meta.title || slugToTitleCase(slug),
      year: meta.year || "",
      category: meta.category || "",
      order: meta.order ? Number(meta.order) : null,
      image: `images/projects/${destName}`,
      ratio,
      description: meta.description || "",
      at: meta.at || "",
      with: meta.with || "",
      for: meta.for || "",
      role: meta.role || "",
      readmore: meta.readmore || "",
      galleryPaths,
      videoHtml,
    });
  });

  projects.sort((a, b) => {
    if (a.order !== null && b.order !== null) return a.order - b.order;
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    return (b.year || "").localeCompare(a.year || "") || a.title.localeCompare(b.title);
  });

  // --- projects-data.js (used by the homepage) ---
  const listData = projects.map(({ slug, title, year, category, image, ratio }) => ({ slug, title, year, category, image, ratio }));
  const out = `// Auto-generated by scripts/build-content.js from /content/projects — do not edit by hand.\n// To change a project, edit its folder in /content/projects/ instead.\nconst projects = ${JSON.stringify(listData, null, 2)};\n`;
  fs.writeFileSync(DATA_OUT_FILE, out);

  // --- individual work pages ---
  if (template){
    projects.forEach((p, i) => {
      const prev = projects[i - 1];
      const next = projects[i + 1];
      let html = template
        .replaceAll("{{TITLE}}", escapeHtml(p.title))
        .replaceAll("{{DESCRIPTION_META}}", escapeHtml(p.description).slice(0, 300))
        .replaceAll("{{DESCRIPTION}}", escapeHtml(p.description))
        .replaceAll("{{CATEGORY}}", escapeHtml(p.category))
        .replaceAll("{{YEAR}}", escapeHtml(p.year))
        .replaceAll("{{META_ROWS}}", buildMetaRows(p))
        .replaceAll("{{VIDEO}}", p.videoHtml ? `<section class="work-video"><div class="work-video-inner">${p.videoHtml}</div></section>` : "")
        .replaceAll("{{GALLERY}}", buildGalleryHtml(p.galleryPaths));

      const prevLink = prev ? `<a href="../${prev.slug}/index.html" class="pagenav-link pagenav-prev">&#8592; ${escapeHtml(prev.title)}</a>` : "<span></span>";
      const nextLink = next ? `<a href="../${next.slug}/index.html" class="pagenav-link pagenav-next">${escapeHtml(next.title)} &#8594;</a>` : "<span></span>";
      html = html.replace("{{PREV_LINK}}", prevLink).replace("{{NEXT_LINK}}", nextLink);

      const outDir = path.join(WORKS_OUT_DIR, p.slug);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "index.html"), html);
    });
    console.log(`Built ${projects.length} work page(s) into /works/`);
  } else {
    console.warn("No templates/work-template.html found — skipped generating individual work pages.");
  }

  console.log(`Built ${projects.length} project(s) into ${path.relative(process.cwd(), DATA_OUT_FILE)}`);
}

function buildShowreelPage(){
  const file = path.join(HOME_CONTENT_DIR, "showreel.txt");
  if (!fs.existsSync(file) || !fs.existsSync(SHOWREEL_TEMPLATE_FILE)){
    console.warn("Missing content/home/showreel.txt or templates/showreel-template.html — skipped the standalone showreel page.");
    return;
  }
  const id = extractVimeoId(fs.readFileSync(file, "utf8"));
  if (!id){
    console.warn("Could not find a Vimeo ID in content/home/showreel.txt — skipped the standalone showreel page.");
    return;
  }
  // No "background=1" here on purpose — this page is meant to be shared
  // with sound and normal player controls, unlike the muted autoplay
  // version embedded on the homepage.
  const videoHtml = `<iframe src="https://player.vimeo.com/video/${id}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Showreel" style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>`;
  const template = fs.readFileSync(SHOWREEL_TEMPLATE_FILE, "utf8");
  const html = template.replace("{{VIDEO}}", videoHtml);
  fs.mkdirSync(SHOWREEL_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SHOWREEL_OUT_DIR, "index.html"), html);
  console.log(`Built standalone showreel page at /showreel/ (Vimeo ${id}, sound + controls on)`);
}

const IMPRESSUM_CONTENT_DIR = path.join(ROOT, "content", "impressum");
const IMPRESSUM_TEMPLATE_FILE = path.join(ROOT, "templates", "impressum-template.html");
const IMPRESSUM_OUT_DIR = path.join(ROOT, "impressum");

function buildLegalSectionHtml(filename){
  const file = path.join(IMPRESSUM_CONTENT_DIR, filename);
  if (!fs.existsSync(file)) return "<p>Content missing.</p>";
  const text = fs.readFileSync(file, "utf8");
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    if (block.startsWith("## ")){
      return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
  }).join("\n    ");
}

function buildImpressumPage(){
  if (!fs.existsSync(IMPRESSUM_TEMPLATE_FILE) || !fs.existsSync(IMPRESSUM_CONTENT_DIR)){
    console.warn("Missing templates/impressum-template.html or content/impressum/ — skipped the Impressum page.");
    return;
  }
  const template = fs.readFileSync(IMPRESSUM_TEMPLATE_FILE, "utf8");
  const html = template
    .replace("{{IMPRESSUM}}", buildLegalSectionHtml("impressum.txt"))
    .replace("{{DATENSCHUTZ}}", buildLegalSectionHtml("datenschutz.txt"));
  fs.mkdirSync(IMPRESSUM_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMPRESSUM_OUT_DIR, "index.html"), html);
  console.log("Built Impressum & Datenschutz page from /content/impressum/");
}

main();
buildAboutPage();
buildHomepageVideo();
buildShowreelPage();
buildImpressumPage();
