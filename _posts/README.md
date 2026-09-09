# How to Add New Posts & Notes

To publish a new post or technical note on the site, add a Markdown file to this `_posts/` directory.

---

## 1. File Naming Rule

File names must follow the Jekyll date convention:
```
YYYY-MM-DD-title-slug.md
```

### Examples:
- `2026-09-09-network-telemetry.md`
- `2026-09-15-linux-kernel-tracing.md`
- `2026-10-01-security-boundaries.md`

---

## 2. Front Matter Template

Every post should begin with YAML front matter enclosed between triple dashes `---`:

```yaml
---
title: "Network Telemetry Primitives"
date: 2026-09-09 14:00:00 +0300
excerpt: "Analysis of low-overhead telemetry pipelines in distributed systems."
tags: [systems, networking, security]
read_time: "4 min read"
# Optional cover/hero image displayed at the top of the article:
# image: /assets/images/posts/my-hero-image.png
---
```

> **Note**: `layout: post` is configured as the default in `_config.yml`, so you don't even need to type it!

---

## 3. Adding Pictures & Diagrams

1. **Where to place images**:
   Place your images in:
   ```
   assets/images/posts/
   ```
   Supported formats: `.png`, `.jpg`, `.jpeg`, `.svg`, `.webp`, `.gif`.

2. **How to include an image in Markdown**:
   ```markdown
   ![Diagram Description](/assets/images/posts/your-image.png)
   ```

3. **How to include an image with a caption**:
   ```html
   <figure>
     <img src="/assets/images/posts/your-image.png" alt="Diagram Description" />
     <figcaption>Figure 1 — Description of the architecture flow</figcaption>
   </figure>
   ```

4. **Styling is automatic**:
   Images automatically scale responsively, have rounded corners (`8px`), subtle adaptive borders, and centered alignment.

---

## 4. Markdown Formatting Options

You can freely use standard Markdown:

- **Headings**: `## Heading 2`, `### Heading 3`
- **Lists**: `- Item 1`, `1. Step 1`
- **Code blocks**:
  ````markdown
  ```bash
  systemctl status telemetry
  ```
  ````
- **Tables**:
  ```markdown
  | Metric | Target | P99 |
  | ------ | ------ | --- |
  | Ingest | 100k/s | <2ms|
  ```
- **Blockquotes**: `> Determinism is a security property.`

---

## 5. Preview Your Changes

To preview locally:
```bash
bundle exec jekyll serve
```
Then visit: `http://localhost:4000/#writing`
