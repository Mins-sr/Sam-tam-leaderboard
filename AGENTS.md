# Repository Guidelines

This repository is a dependency-free browser app for exploring SAM and video segmentation models. Keep contributions consistent with its small static structure and validate data changes before submitting them.

## Project Structure & Module Organization

- `index.html` is the app entry point.
- `app.js` contains browser-side rendering, filters, and interactions; `style.css` contains the presentation layer.
- `data/models.json` stores model records and taxonomies.
- `docs/classification-definitions.md` defines the classification rules used by the dataset.
- `validate_schema.py` checks the JSON structure and taxonomy references. There is currently no separate test or asset directory.

## Build, Test, and Development Commands

There is no build step or package manager configuration. From the repository root, run `python3 -m http.server 8080` and open `http://localhost:8080/`. Serving over HTTP lets the app fetch its JSON and Markdown files.

- `python3 validate_schema.py` checks required fields, taxonomy values, dates, and data quality constraints.
- `node --check app.js` checks JavaScript syntax; it requires Node.js but no project dependencies.

## Coding Style & Naming Conventions

Use two spaces for indentation and follow the surrounding vanilla JavaScript, HTML, and CSS style. Use `camelCase` for JavaScript names, kebab-case for CSS classes and model IDs, and `snake_case` for JSON fields and taxonomy IDs. Keep model records aligned with the existing schema. No formatter or linter is configured.

## Testing Guidelines

There is no automated behavioral test suite or coverage target. Run `python3 validate_schema.py` after changing model data or taxonomies, and `node --check app.js` after JavaScript edits. For UI changes, review the affected view and its filters in a browser.

## Commit & Pull Request Guidelines

The repository has no commits yet, so no established commit convention can be inferred. Use a short, descriptive subject such as `docs: add contributor guide` or `fix: correct model filtering`. Pull requests should explain the change and validation performed; include screenshots for visible UI changes and link related issues when applicable.

## Security & Data Quality

Do not commit credentials or private configuration. Keep model references and classification claims traceable to their sources, and update the definition document when classification rules change.
