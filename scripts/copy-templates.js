const fs = require("node:fs");
const path = require("node:path");

const templateRoots = [
  {
    source: path.join(__dirname, "..", "src", "render", "templates"),
    target: path.join(__dirname, "..", "dist", "render", "templates")
  },
  {
    source: path.join(__dirname, "..", "src", "change", "templates"),
    target: path.join(__dirname, "..", "dist", "change", "templates")
  },
  {
    source: path.join(__dirname, "..", "src", "agents", "templates"),
    target: path.join(__dirname, "..", "dist", "agents", "templates")
  },
  {
    source: path.join(__dirname, "..", "src", "bug", "templates"),
    target: path.join(__dirname, "..", "dist", "bug", "templates")
  }
];

for (const root of templateRoots) {
  copyDirectory(root.source, root.target);
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Template source directory not found: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}
