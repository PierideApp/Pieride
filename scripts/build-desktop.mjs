import { spawnSync } from "node:child_process";
import { join } from "node:path";

const builds = {
  win: {
    platform: "win32",
    label: "Windows",
    args: ["build", "--bundles", "nsis"],
  },
  "win-portable": {
    platform: "win32",
    label: "Windows portable",
    args: [
      "build",
      "--no-bundle",
      "--config",
      "src-tauri/tauri.portable.conf.json",
    ],
  },
  mac: {
    platform: "darwin",
    label: "macOS",
    args: ["build", "--bundles", "app,dmg"],
  },
  linux: {
    platform: "linux",
    label: "Linux",
    args: ["build", "--bundles", "deb,rpm,appimage"],
  },
};

const build = builds[process.argv[2]];

if (!build) {
  console.error("Builds disponibles :");
  console.error("  pnpm build:win");
  console.error("  pnpm build:win:portable");
  console.error("  pnpm build:mac");
  console.error("  pnpm build:linux");
  process.exit(1);
}

if (process.platform !== build.platform) {
  const operatingSystems = {
    win32: "Windows",
    darwin: "macOS",
    linux: "Linux",
  };

  console.error(
    `Le build ${build.label} doit être lancé sur ${operatingSystems[build.platform]}. ` +
      "Utilise le workflow GitHub Release pour générer les builds des autres systèmes."
  );
  process.exit(1);
}

const isWindows = process.platform === "win32";
const tauriCommand = join(
  process.cwd(),
  "node_modules",
  ".bin",
  isWindows ? "tauri.cmd" : "tauri"
);

const result = spawnSync(tauriCommand, build.args, {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: isWindows,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
