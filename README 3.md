# Yomi Ajani — portfolio site

Static site for Cloudflare Pages. Content (project covers, galleries,
descriptions, titles, years, categories) is generated from plain
folders — no code editing needed to add or update a project.

## Adding / editing a project

1. Go to `content/projects/`
2. Make a new folder, named whatever you want the project's URL to be
   (e.g. `my-new-project`)
3. Put a cover image inside it named exactly `cover.jpg`, `cover.png`,
   or `cover.webp`
4. Optionally, add a `gallery/` folder inside it with more images —
   these become that project's photo gallery, in alphabetical order
   by filename (e.g. `01.jpg`, `02.jpg`...)
5. Add a `meta.txt` file inside it, for example:

   ```
   title: My New Project
   year: 2026
   category: Research
   at: Studio Name
   role: Design, Development
   readmore: https://example.com/press-article
   description: Write as many lines as you like here — everything
   after "description:" becomes the project's description text on
   its page, so this can run to a full paragraph or several.
   ```

   `at` / `with` / `for` / `role` / `readmore` are all optional — only
   include the ones that apply. `description` should always be the
   **last** line in the file, since everything after it is captured
   as the description text.

That's it — delete a folder to remove a project, rename it to change
its slug/URL. Add `order: 1` (etc.) to force a specific position;
otherwise projects sort by year, then title.

## How it works

`scripts/build-content.js` scans `content/projects/`, and for each
project:
- copies the cover image into `images/projects/`
- copies any gallery images into `images/projects/<slug>/gallery/`
- measures the cover's real dimensions
- generates that project's page at `works/<slug>/index.html` from
  `templates/work-template.html`
- writes `projects-data.js`, which the homepage reads to build its list

You never edit `projects-data.js`, `images/projects/`, or anything
inside `works/` by hand — they're all regenerated every time the
build runs.

## The About page

Like projects, the About page is generated from plain text files —
you don't need to touch HTML. Everything lives in `content/about/`:

- `bio.txt` — your intro paragraphs. Leave a blank line between
  paragraphs; each one becomes its own line on the page.
- `portrait.jpg` (or `.png`/`.webp`) — optional. Add a photo here
  named exactly `portrait.jpg` and it'll replace the placeholder box.
- `clients.txt` — one name per line, becomes the Clients &
  Collaborators list.
- `exhibitions.txt` — one entry per line, formatted as
  `Title | Organization | Year | URL`, where the URL is optional:
  ```
  Designboom | Sound Structures Project Feature | 2022 | https://example.com/article
  Étapes Magazine, no. 264 | Printed Feature | 2021
  ```

Add, remove, or reorder lines to change what shows up — the order in
the file is the order on the page. Run `npm run build` afterward, same
as for projects.

Cover images and gallery images accept `.jpg`, `.png`, `.webp`, or
`.gif` — animated gifs work fine as project gallery images too.

### Adding a video to a project page

Drop a `video.txt` file in a project's folder, e.g.
`content/projects/sound-structures/video.txt`, containing either the
Vimeo video's numeric ID or its full URL — either works:
```
1045042631
```
or
```
https://vimeo.com/1045042631
```
It'll appear as a framed video below the project's description,
above the gallery. Leave the file out entirely for projects with no
video — nothing shows in its place.

## Homepage showreel video

The homepage's hero video comes from `content/home/showreel.txt` —
same format as project videos (a Vimeo ID or full URL). Edit that
file and run `npm run build` to update it; you don't need to touch
`index.html` directly anymore.

## Standalone showreel page

There's also a plain `/showreel/` page — same video, same visual
frame, but with sound and normal player controls (the homepage version
is muted/autoplay/no-controls). It's not linked from anywhere in the
site's navigation, but it works if you share the link directly:
`yoursite.com/showreel`. It's generated from the same
`content/home/showreel.txt` file, so it always matches whatever video
is set there.

## Deploying on Cloudflare Pages

- **Build command**: `npm run build`
- **Build output directory**: `/` (repo root)
- **Framework preset**: none

Push this whole folder to a GitHub repo, connect it in Cloudflare Pages,
set the build command above, and every push regenerates the project
list and pages automatically from whatever is in `content/projects/`.

## Local preview without deploying

```
npm install
npm run build
```

then double-click `index.html` — it opens in your browser. All the
internal links (projects, About, next/previous project) are relative,
so clicking around works straight from your file system, no server
needed.

Re-run `npm run build` any time you change something in
`content/projects/` or add a new project folder, then refresh your
browser.

## Images are placeholders right now

Every cover and gallery image in `content/projects/` right now is a
generated placeholder — swap them for your real photos (same
filenames: `cover.jpg`, and anything in `gallery/`), then run
`npm run build` again.

## Impressum & Datenschutz

Edit `content/impressum/impressum.txt` and
`content/impressum/datenschutz.txt` — plain text, blank line between
paragraphs, and a line starting with `## ` becomes a heading. **These
are templates with placeholders, not verified legal text** — fill in
your real details and ideally have the final wording checked (a free
German-law generator like e-recht24.de, or a lawyer) before publishing.

## Files

- `index.html`, `styles.css`, `script.js` — the homepage
- `about/` — generated About page, don't edit directly
- `works/` — generated project pages, don't edit directly
- `content/projects/` — edit this to manage projects
- `content/about/` — edit this to manage the About page
- `templates/` — the templates used to generate work and about pages
- `scripts/build-content.js` — the generator (don't need to touch)
- `projects-data.js`, `images/` — generated output, don't edit directly

