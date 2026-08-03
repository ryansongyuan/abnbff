# GitHub Pages Redirect Design

## Goal

Make the repository deployable and accessible through GitHub Pages while keeping the existing hosted website as the single live application.

## Approach

Add a small static `index.html` at the repository root. The page redirects visitors to `https://stayalpha-abnb.jn34t34.chatgpt.site/` immediately and includes a visible manual link for browsers where automatic redirecting is disabled.

Add a GitHub Actions workflow that publishes only the static entry page to GitHub Pages whenever `main` changes. The existing Next/Vinext source remains unchanged and is not bundled into the Pages artifact.

## Page Behavior

- Use a standards-based HTML meta refresh for immediate navigation.
- Use a short inline script as a second redirect mechanism.
- Render a simple dark fallback screen with the destination link.
- Keep the destination URL in one obvious constant in the document where practical.
- Include canonical and robots metadata so the redirect page does not compete with the live site in search results.

## Deployment

The workflow will:

1. Check out `main`.
2. Copy `index.html` into a clean Pages artifact directory.
3. Upload the artifact with GitHub's official Pages action.
4. Deploy it with GitHub's official deployment action.

The workflow requires GitHub Pages to use GitHub Actions as its source. It will request only the permissions needed to read repository contents, publish Pages, and obtain an identity token.

## Verification

- An automated test will assert that `index.html` exists, targets the exact live URL, contains both automatic and manual navigation, and does not reference local application assets.
- The repository test suite will remain green.
- The workflow YAML and final Git state will be inspected before pushing.

## Non-Goals

- Running `/api/stock` on GitHub Pages.
- Duplicating the live website as a static build.
- Changing the current hosting URL or live-data behavior.
