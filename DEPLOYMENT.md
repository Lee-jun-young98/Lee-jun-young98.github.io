# Deployment

This Quartz blog is ready to publish with GitHub Pages.

## Local preview

```bash
npm.cmd install
npx.cmd quartz build --serve --port 8080
```

Open:

```text
http://localhost:8080
```

Published local post:

```text
http://localhost:8080/blog/hydra-llm-sft-training-pipeline
```

## GitHub Pages setup

1. Create a new GitHub repository, recommended name:

```text
Lee-jun-young98.github.io
```

2. In this local folder, set the remote:

```bash
git remote add origin https://github.com/Lee-jun-young98/Lee-jun-young98.github.io.git
```

3. Push the `main` branch.

4. In GitHub, open repository settings and enable Pages with:

```text
Source: GitHub Actions
```

The workflow at `.github/workflows/deploy.yml` will build Quartz and deploy `public`.

