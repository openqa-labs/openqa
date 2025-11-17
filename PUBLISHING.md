# Publishing Guide

## Prerequisites

1. **Check package name availability:**
   ```bash
   npm search openqa
   ```
   If "openqa" is taken, you'll need to use a scoped name like `@auto-browse/openqa`

2. **Login to npm:**
   ```bash
   npm login
   ```

## Publishing to npm

1. **Verify package contents:**
   ```bash
   npm pack --dry-run
   ```
   This shows what files will be included in the package.

2. **Publish to npm:**
   ```bash
   npm publish
   ```

   For first-time publish of a public package:
   ```bash
   npm publish --access public
   ```

## Creating GitHub Release

After publishing to npm, create a GitHub release:

1. Go to GitHub Actions in your repository
2. Run the "Release" workflow manually
3. The workflow will automatically:
   - Create a git tag (v0.0.1)
   - Create a GitHub release
   - Link to the npm package

**Or manually create a release:**

```bash
git tag v0.0.1
git push origin v0.0.1
```

Then create the release on GitHub UI.

## Version Updates

When releasing new versions:

1. Update version in package.json:
   ```bash
   npm version patch  # 0.0.1 -> 0.0.2
   npm version minor  # 0.0.1 -> 0.1.0
   npm version major  # 0.0.1 -> 1.0.0
   ```

2. Commit and push:
   ```bash
   git push && git push --tags
   ```

3. Publish:
   ```bash
   npm publish
   ```

4. Run GitHub Release workflow

## Verify Publication

After publishing, verify:
- npm package: https://www.npmjs.com/package/openqa
- GitHub release: https://github.com/auto-browse/openqa/releases
- Installation works: `npm install openqa` in a test project
