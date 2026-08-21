const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {adapterFor}=require('./adapters');
const root=path.join(__dirname,'..'),dataDir=path.join(root,'data'),previewDir=path.join(dataDir,'browser-previews');
fs.mkdirSync(previewDir,{recursive:true});
const safeName=s=>String(s||'job').replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,60);
async function findAndFill(page,pattern,value){
  for(const input of await page.locator('input:visible').all()){
    const hint=[await input.getAttribute('placeholder'),await input.getAttribute('name'),await input.getAttribute('aria-label'),await input.getAttribute('id')].filter(Boolean).join(' ');
    if(pattern.test(hint)&&await input.isEditable().catch(()=>false)){await input.fill(value).catch(()=>{});return true}
  }
  return false;
}
async function prepareOne(context,task,index){
  const adapter=adapterFor(task.url),page=index===0?(context.pages()[0]||await context.newPage()):await context.newPage(),result={url:task.url,platform:adapter.name,status:'started',filled:[],submitted:false,at:new Date().toISOString()};
  try{
    await page.goto(task.url,{waitUntil:'domcontentloaded',timeout:45000});
    const body=(await page.locator('body').innerText({timeout:10000}).catch(()=>'' )).slice(0,20000);
    result.loginLikelyRequired=adapter.login.test(body);
    for(const [key,pattern] of Object.entries(adapter.fieldHints))if(task.profile[key]&&await findAndFill(page,pattern,task.profile[key]))result.filled.push(key);
    const applyCandidates=[];
    for(const pattern of adapter.applyButtons){const buttons=page.getByRole('button',{name:pattern}).or(page.getByRole('link',{name:pattern}));if(await buttons.count())applyCandidates.push(pattern.toString())}
    result.applyControlsDetected=applyCandidates;
    result.status=result.loginLikelyRequired?'waiting_for_user_login':'prepared';
    result.note='Dry Run：未点击投递/沟通/提交按钮，未绕过验证码。';
    result.screenshot=path.join(previewDir,`${String(index+1).padStart(2,'0')}_${safeName(adapter.id)}_${Date.now()}.png`);
    await page.screenshot({path:result.screenshot,fullPage:false}).catch(()=>{});
  }catch(err){result.status='failed';result.error=String(err.message||err)}
  return result;
}
(async()=>{
  const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),tasks=payload.tasks||[payload],profileDir=path.join(dataDir,'browser-profile');
  const context=await chromium.launchPersistentContext(profileDir,{headless:false,channel:'chrome',viewport:null});
  const results=[];
  for(let i=0;i<tasks.length;i++)results.push(await prepareOne(context,{...tasks[i],profile:tasks[i].profile||payload.profile},i));
  fs.writeFileSync(path.join(dataDir,'browser-results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
  console.log(`Prepared ${results.filter(x=>x.status==='prepared').length}/${results.length}; browser remains open for user review.`);
})().catch(err=>{fs.writeFileSync(path.join(dataDir,'browser-error.txt'),String(err.stack||err));process.exit(1)});
