import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const hooksSourceDir = join(projectRoot, ".githooks");
const hooksDestDir = join(projectRoot, ".git", "hooks");

const hooks = ["pre-commit", "post-merge"];

console.log("Installing Git hooks...\n");

if (!existsSync(hooksDestDir)) {
  mkdirSync(hooksDestDir, { recursive: true });
}

let installed = 0;

for (const hook of hooks) {
  try {
    const sourcePath = join(hooksSourceDir, hook);
    const destPath = join(hooksDestDir, hook);

    if (!existsSync(sourcePath)) {
      console.log(`  Hook source not found: ${hook}`);
      continue;
    }

    copyFileSync(sourcePath, destPath);

    try {
      chmodSync(destPath, 0o755);
    } catch (err) {
      console.log(`  Could not set execute permissions for ${hook} (this is normal on Windows)`);
    }

    console.log(`  Installed: ${hook}`);
    installed++;
  } catch (error) {
    console.error(`  Error installing ${hook}:`, error.message);
  }
}

console.log(`\nSuccessfully installed ${installed}/${hooks.length} Git hooks`);

if (installed > 0) {
  console.log("\nThe hooks will now run automatically on git operations.");
  console.log("To uninstall, run: pnpm hooks:uninstall\n");
}
