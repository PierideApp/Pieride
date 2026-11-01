import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const releaseTag = process.env.RELEASE_TAG;
const version = releaseTag?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Tag de release invalide : ${releaseTag ?? "absent"}`);
}

for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
  const config = JSON.parse(readFileSync(file, "utf8"));
  config.version = version;
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

const cargoManifestPath = "src-tauri/Cargo.toml";
const cargoManifest = readFileSync(cargoManifestPath, "utf8");
const updatedCargoManifest = cargoManifest.replace(
  /^(version\s*=\s*)"[^"]+"/m,
  `$1"${version}"`
);

if (updatedCargoManifest === cargoManifest) {
  throw new Error(
    "Impossible de mettre à jour la version de src-tauri/Cargo.toml"
  );
}

writeFileSync(cargoManifestPath, updatedCargoManifest);
