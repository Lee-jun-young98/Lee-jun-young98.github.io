# Notion paper sync

This blog treats the Notion paper review database as the source of truth.

## GitHub secrets

Add these repository secrets in GitHub Actions settings:

- `NOTION_TOKEN`: Required. Internal integration token with access to the paper review database.
- `NOTION_PAPERS_DATABASE_ID`: Optional. Defaults to `df3a2db6a13749c5b70eac452622298a`.

The Notion integration must be shared with the `논문리뷰` database.

## How publishing works

The `Sync Notion papers` workflow runs every day at 05:00 KST and can also be run manually from GitHub Actions.

It reads every page in the Notion database, converts blocks to Markdown, and writes posts under `content/papers/{category}/`. The folder is selected from the `Table tag` property:

- `Generative AI` -> `content/papers/generative-ai/`
- `LLM` -> `content/papers/llm/`
- `Vision` -> `content/papers/vision/`
- `MultiModal` -> `content/papers/multimodal/`
- `3D` -> `content/papers/3d/`
- `Skill` -> `content/papers/skill/`
- `Metrics` -> `content/papers/metrics/`

When the workflow commits changed Markdown files, the existing deploy workflow publishes the updated GitHub Pages site.
