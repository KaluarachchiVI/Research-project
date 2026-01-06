# Fix Next.js Workspace Root Detection Issue

## Problem
Next.js is detecting the wrong workspace root because there are multiple `package-lock.json` files:
- Wrong root detected: `C:\Users\ASUS TUF\package-lock.json`
- Correct root: `C:\Users\ASUS TUF\Desktop\Research project\praboth\web-ui\package-lock.json`

## Solution 1: Updated Config (Already Done)
The `next.config.js` has been updated to explicitly set the Turbopack root:

```javascript
turbopack: {
  root: path.resolve(__dirname),
}
```

**To apply:**
1. Stop the Next.js server (Ctrl+C)
2. Restart it:
   ```powershell
   cd praboth\web-ui
   npx next dev
   ```

## Solution 2: Remove Conflicting Lockfile (If Solution 1 Doesn't Work)

If the config fix doesn't work, you can remove or rename the conflicting lockfile:

```powershell
# Check if the file exists
Test-Path "C:\Users\ASUS TUF\package-lock.json"

# If it exists and you don't need it, rename it (safer than deleting)
Rename-Item "C:\Users\ASUS TUF\package-lock.json" "C:\Users\ASUS TUF\package-lock.json.backup"
```

**Warning:** Only do this if you're sure the lockfile in your user directory isn't needed for another project.

## Solution 3: Use Specific Next.js Version

If you're getting version mismatches (error shows Next.js 16.1.1 but package.json has 14.2.4):

```powershell
cd praboth\web-ui

# Install the specific version from package.json
npm install next@14.2.4

# Then use the local version instead of npx
.\node_modules\.bin\next.cmd dev
```

Or update package.json to match:
```json
"dependencies": {
  "next": "^16.1.1",
  ...
}
```

Then run:
```powershell
npm install
npx next dev
```

## Solution 4: Use .npmrc to Ignore Parent Lockfiles

Create a `.npmrc` file in `praboth/web-ui/`:

```ini
package-lock=true
```

This tells npm to only use the local lockfile.

## Verification

After applying a solution, you should see:
```
✓ Starting...
✓ Ready in X seconds
- Local:        http://localhost:3000
```

Without the workspace root warning.

