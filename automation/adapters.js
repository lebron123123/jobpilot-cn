const adapters=[
  {id:'zhipin',name:'BOSS直聘',match:/zhipin\.com/i,login:/登录|扫码|验证码/,applyButtons:[/立即沟通/,/继续沟通/,/投递/],fieldHints:{name:/姓名|name/i,phone:/手机|电话|phone|mobile/i,email:/邮箱|email/i}},
  {id:'zhaopin',name:'智联招聘',match:/zhaopin\.com/i,login:/登录|扫码|验证码/,applyButtons:[/立即投递/,/申请职位/,/投递简历/],fieldHints:{name:/姓名|name/i,phone:/手机|电话|phone|mobile/i,email:/邮箱|email/i}},
  {id:'liepin',name:'猎聘',match:/liepin\.com/i,login:/登录|扫码|验证码/,applyButtons:[/应聘职位/,/立即应聘/,/投递/],fieldHints:{name:/姓名|name/i,phone:/手机|电话|phone|mobile/i,email:/邮箱|email/i}},
  {id:'generic',name:'通用ATS',match:/.*/,login:/sign in|log in|登录|验证码/i,applyButtons:[/apply now/i,/submit application/i,/申请职位/,/投递/],fieldHints:{name:/姓名|full.?name|name/i,phone:/手机|电话|phone|mobile/i,email:/邮箱|email/i}}
];
function adapterFor(url){return adapters.find(x=>x.match.test(url))||adapters.at(-1)}
module.exports={adapters,adapterFor};
