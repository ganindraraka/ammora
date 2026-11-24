# Ammora Launchpad

A polished, testnet-only token launchpad demo built with `@ammora-protocol/sdk@0.3.9` for GIWA Sepolia (chain `91342`).

The app discovers launches through `AmmoraDataApiClient`, reads deployment addresses from the SDK catalog, supports an injected wallet connection, and prepares a human-readable unsigned launch preview. It never asks for a private key, automatically signs, or automatically sends a transaction.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Create a production build locally with:

```bash
npm run build
npm run preview
```

## Upload to your GitHub repository

1. Create a new GitHub repository. For the easiest public review URL, set it to **Public**.
2. Download or copy this project folder. Do not include `node_modules`.
3. In a terminal inside the project folder, replace the placeholder remote with your repository URL:

```bash
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git branch -M main
git add .
git commit -m "Ship Ammora SDK launchpad"
git push -u origin main
```

If Git says there is nothing to commit, that is fine; continue with `git push -u origin main`.

## Publish with GitHub Pages

This repository includes `.github/workflows/deploy-pages.yml`. After the first push:

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Push any new commit, or open **Actions → Deploy to GitHub Pages → Run workflow**.
5. GitHub will publish the site at `https://USERNAME.github.io/REPOSITORY/`.

The site uses relative asset paths, so it works from a repository subpath. Copy that GitHub Pages URL into Ammora's builder review form.

## Ammora links

- Official site: https://ammora.org/
- SDK docs: https://docs.ammora.org/guides/sdk-quickstart
- SDK package: https://www.npmjs.com/package/@ammora-protocol/sdk
- GIWA explorer: https://sepolia-explorer.giwa.io/

## Safety note

This is beta testnet software for GIWA Sepolia. The Ammora SDK documentation states that the 0.x SDK and testnet deployments may change and are not a substitute for an independent security review. Do not use real funds.
