/**
 * Downloads each registered original from images.unsplash.com, writes an optimised WebP
 * master and thumbnail without metadata, and regenerates the source and licence register.
 *
 * Usage: node --import tsx scripts/optimise-photography.ts [cacheDir]
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { allEditorialAssets, type VistaEditorialAsset } from "../src/lib/premium-photography";

const root = process.cwd();
const cache = process.argv[2] ?? join(root, ".photo-cache");
const masterWidth: Record<VistaEditorialAsset["placement"], number> = { hero: 1920, editorial: 1600, gallery: 1200 };
const thumbWidth = 640;

async function original(asset: VistaEditorialAsset) {
  const file = join(cache, asset.origin + ".jpg");
  if (!existsSync(file)) {
    const response = await fetch("https://images.unsplash.com/" + asset.origin + "?fm=jpg&fit=max&w=2400&q=90");
    if (!response.ok) throw new Error(asset.id + ": download failed with " + response.status);
    await mkdir(cache, { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(file);
}

async function main() {
  const register: Record<string, unknown>[] = [];
  const problems: string[] = [];
  for (const asset of allEditorialAssets) {
    const input = await original(asset);
    const out = join(root, "public", asset.path.slice(1));
    const thumb = join(root, "public", asset.thumb.slice(1));
    await mkdir(dirname(out), { recursive: true });
    const master = await sharp(input).rotate().resize({ width: masterWidth[asset.placement], withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 }).toFile(out);
    const small = await sharp(input).rotate().resize({ width: thumbWidth, withoutEnlargement: true })
      .webp({ quality: 74, effort: 6 }).toFile(thumb);
    if (master.width !== asset.width || master.height !== asset.height)
      problems.push(`${asset.id}: registry ${asset.width}x${asset.height}, actual ${master.width}x${master.height}`);
    register.push({
      id: asset.id, path: asset.path, thumb: asset.thumb, section: asset.section, collection: asset.collection,
      title: asset.title, alt: asset.alt, photographer: asset.photographer, sourceUrl: asset.sourceUrl,
      licence: asset.licence, cdnOrigin: "https://images.unsplash.com/" + asset.origin,
      width: master.width, height: master.height, bytes: (await stat(out)).size, thumbBytes: small.size,
    });
    console.log(asset.id.padEnd(36), `${master.width}x${master.height}`.padEnd(10), Math.round(master.size / 1024) + " KB", "/ thumb " + Math.round(small.size / 1024) + " KB");
  }
  await writeFile(join(root, "public/web-images/premium/sources.json"), JSON.stringify({
    description: "Source and licence register for locally served VisTa editorial photography.",
    licenceTerms: "https://unsplash.com/license",
    generatedBy: "scripts/optimise-photography.ts",
    assets: register,
  }, null, 1) + "\n");
  if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
}

main().catch(error => { console.error(error); process.exit(1); });
