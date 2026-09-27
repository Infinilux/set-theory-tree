import { chromium } from "playwright";
const url = process.argv[2] || "http://127.0.0.1:4173/";
const out = process.argv[3] || "shot.png";
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
const errs = [], logs = [];
p.on("console", m => { if (m.type() === "error") errs.push(m.text()); else logs.push(m.type()+": "+m.text()); });
p.on("pageerror", e => errs.push("PAGEERROR: " + e.message));
await p.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(3500);
// 读页面状态
const stat = await p.evaluate(() => ({
  canvas: !!document.querySelector("canvas"),
  cw: document.querySelector("canvas")?.width, ch: document.querySelector("canvas")?.height,
  legendCats: document.querySelectorAll("#legend .cat").length,
  hudButtons: document.querySelectorAll("#hud button").length,
  title: document.querySelector("#legend h1")?.textContent,
  sub: document.querySelector("#legend .sub")?.textContent,
  cardHidden: document.querySelector("#card")?.hidden,
}));
console.log(JSON.stringify(stat, null, 1));
// 悬停一个已知节点：屏幕中心略偏，扫描找是否有卡片出现
let hoverHit = false;
for (const [dx, dy] of [[0,0],[120,60],[-160,-80],[220,-140],[-260,160],[60,-220],[300,40],[-80,240]]) {
  await p.mouse.move(800+dx, 475+dy); await p.waitForTimeout(260);
  const hid = await p.evaluate(() => document.querySelector("#card")?.hidden);
  if (!hid) { hoverHit = true; break; }
}
console.log("hover card shown:", hoverHit);
// 点漫游、截图
await p.click("#tour"); await p.waitForTimeout(2600);
await p.screenshot({ path: out });
console.log("console errors:", errs.length); errs.slice(0,8).forEach(e => console.log("  ERR", e));
// 再抓一次非漫游视角
await p.click("#tour"); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector("#reset")?.click());
await p.waitForTimeout(800);
await p.screenshot({ path: out.replace(".png", "-static.png") });
await b.close();