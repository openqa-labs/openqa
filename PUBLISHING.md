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

## Testing Before Publishing

### Option 1: Test with npm link (Recommended)

```bash
# In openqa repo root
npm link

# In a test project directory
mkdir ../test-openqa && cd ../test-openqa
npm link openqa
npm install playwright-bdd @playwright/test

# Test the CLI
npx openqa init playwright-bdd

# Test in a Node script
node -e "import('openqa').then(m => console.log(m))"
```

Clean up after testing:
```bash
# In test project
npm unlink openqa

# In openqa repo
npm unlink
```

### Option 2: Test with npm pack

```bash
# In openqa repo
npm pack
# Creates: openqa-0.0.1.tgz

# In test project
npm install /path/to/openqa-0.0.1.tgz
npm install playwright-bdd @playwright/test
npx openqa init playwright-bdd
```

### Option 3: Publish Beta Version

```bash
# In openqa repo
npm version 0.0.2-beta.0
npm publish --tag beta

# In test project
npm install openqa@beta
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

## Pre-Publish Checklist

Before publishing, ensure:

1. ✅ All tests pass
2. ✅ Tested with `npm link` or `npm pack`
3. ✅ CLI tool works: `npx openqa init playwright-bdd`
4. ✅ README is up to date
5. ✅ Branch merged to main
6. ✅ Version bumped appropriately

## Version Updates

When releasing new versions:

1. **Merge feature branch to main:**
   ```bash
   git checkout main
   git merge feat/your-feature
   ```

2. **Update version in package.json:**
   ```bash
   npm version patch  # 0.0.1 -> 0.0.2 (bug fixes)
   npm version minor  # 0.0.1 -> 0.1.0 (new features)
   npm version major  # 0.0.1 -> 1.0.0 (breaking changes)
   ```

   This automatically:
   - Updates package.json
   - Creates a git commit
   - Creates a git tag

3. **Push to GitHub:**
   ```bash
   git push && git push --tags
   ```

4. **Publish to npm:**
   ```bash
   npm publish
   ```

5. Run GitHub Release workflow (optional)

## Verify Publication

After publishing, verify:
- npm package: https://www.npmjs.com/package/openqa
- GitHub release: https://github.com/auto-browse/openqa/releases
- Installation works: `npm install openqa` in a test project
