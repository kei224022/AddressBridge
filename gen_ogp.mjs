/**
 * gen_ogp.mjs — OGP 画像（1200×630）を Playwright で生成する
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OGP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1200px; height: 630px; overflow: hidden;
  background: #fafafa;
  font-family: 'Segoe UI', 'Noto Sans JP', Arial, sans-serif;
}
.stripe {
  height: 14px;
  background: repeating-linear-gradient(
    -45deg,
    #e63329 0px, #e63329 14px,
    #ffffff 14px, #ffffff 28px,
    #1a5276 28px, #1a5276 42px,
    #ffffff 42px, #ffffff 56px
  );
}
.body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(630px - 28px);
  gap: 20px;
  background: linear-gradient(135deg, #f0f4f8 0%, #fafafa 100%);
}
.icon { font-size: 80px; }
.title {
  font-size: 72px;
  font-weight: 700;
  color: #1a5276;
  letter-spacing: -1px;
}
.sub {
  font-size: 30px;
  color: #555;
  font-weight: 400;
}
.tags {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}
.tag {
  background: #1a5276;
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 20px;
  font-weight: 600;
}
</style>
</head>
<body>
  <div class="stripe"></div>
  <div class="body">
    <div class="icon">✈</div>
    <div class="title">AddressBridge</div>
    <div class="sub">日本語住所を9カ国語フォーマットに即変換</div>
    <div class="tags">
      <span class="tag">🇺🇸 US</span>
      <span class="tag">🇬🇧 UK</span>
      <span class="tag">🇫🇷 FR</span>
      <span class="tag">🇩🇪 DE</span>
      <span class="tag">🇮🇹 IT</span>
      <span class="tag">🇨🇦 CA</span>
      <span class="tag">🇰🇷 KR</span>
      <span class="tag">🇹🇼 TW</span>
    </div>
  </div>
  <div class="stripe"></div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(OGP_HTML, { waitUntil: 'networkidle' });

const png = await page.screenshot({ type: 'png', fullPage: false });
writeFileSync(new URL('./assets/ogp.png', import.meta.url), png);

await browser.close();
console.log('✓ assets/ogp.png (1200×630) 生成完了');
