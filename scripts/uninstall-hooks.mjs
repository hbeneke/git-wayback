import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const hooksDestDir = join(projectRoot, ".git", "hooks");

const hooks = ["pre-commit", "post-merge"];

console.log("Uninstalling Git hooks...\n");

let removed = 0;

for (const hook of hooks) {
  try {
    const destPath = join(hooksDestDir, hook);

    if (existsSync(destPath)) {
      unlinkSync(destPath);
      console.log(`  Removed: ${hook}`);
      removed++;
    } else {
      console.log(`  Hook not found: ${hook}`);
    }
  } catch (error) {
    console.error(`  Error removing ${hook}:`, error.message);
  }
}

console.log(`\nSuccessfully removed ${removed}/${hooks.length} Git hooks`);

if (removed > 0) {
  console.log("\nGit hooks have been uninstalled.");
  console.log("To reinstall, run: pnpm hooks:install\n");
}
