const {test,expect}=require('@playwright/test');const {onboard,go}=require('./helpers.cjs');
for(const theme of ['dark','light'])test(`Torwart Quelle und Animation ${theme}`,async({page})=>{await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await onboard(page);await go(page,'#planen');await page.click('#pl-keeper');await page.click('dialog[open] [data-apply=replace]');await page.evaluate(async()=>{const D=await import('/src/views/detail.js');D.openDetail('gk-rectangle')});await expect(page.locator('dialog[open] #d-scene svg')).toBeVisible();await page.screenshot({path:`/downloads/goalie-drill-${theme}-390.png`});});

test('Keeper-Animationen dauern Sekunden, nicht Minuten', async ({ page }) => {
  await onboard(page);
  for (const id of ['gk-gateroll', 'gk-gatepass', 'gk-rectangle', 'gk-strike', 'gk-steps', 'gk-handball']) {
    await page.evaluate(async i => { const D = await import('/src/views/detail.js'); D.openDetail(i); }, id);
    await expect(page.locator('#d-time').last()).toContainText(/0:00 \/ 0:\d\d$/, { timeout: 5000 });
    await page.keyboard.press('Escape');
  }
});
