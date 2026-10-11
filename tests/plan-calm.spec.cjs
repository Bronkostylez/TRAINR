const {test,expect}=require('@playwright/test');
const {onboard,createSession,go,noOverflow,watchErrors}=require('./helpers.cjs');
for(const theme of ['dark','light']) test(`Planen priorisiert den Ablauf ${theme}`,async({page})=>{
 const errors=watchErrors(page); await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});await onboard(page);await createSession(page);await go(page,'#planen');
 await expect(page.locator('#pl-options')).not.toHaveAttribute('open');await expect(page.locator('#pl-pause')).not.toBeVisible();await expect(page.locator('#pl-slot')).toBeVisible();await expect(page.locator('#pl-people')).toBeVisible();await expect(page.locator('#pl-squad')).toBeVisible();
 await expect(page.locator('.toast')).toHaveCount(0,{timeout:15000});await page.screenshot({path:`/downloads/plan-calm-${theme}-390.png`});await page.locator('#pl-options summary').click();await expect(page.locator('#pl-pause')).toBeVisible();await expect(page.locator('#pl-focus')).toBeVisible();await expect(page.locator('#pl-age')).toBeVisible();
 await page.locator('#pl-pplus').click();await expect(page.locator('#pl-options')).toHaveAttribute('open');
 await page.locator('.focus-strip summary').click();await expect(page.locator('.focus-strip .abar')).toBeVisible();expect(await noOverflow(page)).toBe(true);expect(errors).toEqual([]);
});
