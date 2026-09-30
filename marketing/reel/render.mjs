// usage: node render.mjs <out> <fps> <dpr> <from> <to>   (frames [from,to) piped to ffmpeg)
//        node render.mjs --stills <dir> <dpr> t1,t2,...
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
const FF = process.env.FFMPEG ?? "ffmpeg";
const html = pathToFileURL(new URL("./reel.html", import.meta.url).pathname).href;
const args = process.argv.slice(2);
const stills = args[0] === "--stills";
const dpr = Number(stills ? args[2] : args[2]);
const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: dpr });
await page.goto(html);
await page.evaluate(() => window.ready);
if (stills) {
  for (const t of args[3].split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: `${args[1]}/t${t.toFixed(2)}.png` });
  }
} else {
  const [out, fps, , from, to] = [args[0], Number(args[1]), dpr, Number(args[3]), Number(args[4])];
  const ff = spawn(FF, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "5.2", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate((t) => window.render(t), f / fps);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - from) % 30 === 0) console.log(`${out}: frame ${f} (${((Date.now() - t0) / (f - from + 1)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
}
await b.close();
