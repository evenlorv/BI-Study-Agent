// Requires Playwright and Chromium. Run with the local server on port 8000.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const baseURL=process.env.BASE_URL||'http://127.0.0.1:8000/';
 await page.goto(baseURL);
 for (const file of ['style.css','app.js']) {
 const response=await page.request.get(new URL(file, baseURL).href);
 assert.equal(response.status(),200,`${file} must load under the project path`);
 }
 assert.notEqual(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.equal(await page.locator('.subject').count(),6);
 await page.locator('#availability').fill('3');await page.locator('#availability').press('Tab');
 await page.locator('#task-form [name=title]').fill('Min testoppgave <script>');await page.locator('#task-form button').click();
 const task=page.locator('#task-list .row').filter({hasText:'Min testoppgave <script>'});
 await task.locator('input').check();
 await page.locator('#session-form [name=minutes]').fill('45');await page.locator('#session-form [name=note]').fill('Forstår nåverdi');await page.locator('#session-form button').click();
 assert.match(await page.locator('#stats').innerText(),/135 min/);
 await page.locator('[data-progress=investments]').fill('65');await page.locator('[data-progress=investments]').press('Tab');
 await page.locator('[data-exam=investments]').fill('2027-01-10');await page.locator('[data-exam=investments]').press('Tab');
 await page.reload();
 assert.equal(await page.locator('#availability').inputValue(),'3');
 assert.equal(await page.locator('[data-progress=investments]').inputValue(),'65');
 assert.equal(await page.locator('[data-exam=investments]').inputValue(),'2027-01-10');
 assert.equal(await task.locator('input').isChecked(),true);
 assert.match(await page.locator('#session-list').innerText(),/Forstår nåverdi/);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.json$/);
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[data-delete-session]').click();assert.match(await page.locator('#stats').innerText(),/180 min/);
 page.once('dialog',d=>d.accept());await page.locator('#reset').click();assert.equal(await page.locator('#task-list .row').count(),2);
 assert.deepEqual(errors,[]);console.log('PASS: subjects, time goal, tasks, session totals, progress, exam dates, persistence, export, mobile width, deletion and reset.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
