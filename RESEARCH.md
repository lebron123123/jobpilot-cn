# 参考项目与采用决策

## 1. Resume Matcher
来源：https://github.com/srbhr/resume-matcher

采用：主简历上传、JD对照、关键词与匹配洞察、岗位定制版本、PDF导出、多模型适配。  
不直接复制代码：第一版先复用流程与信息架构，后续按许可证独立实现连接层。

## 2. Reactive Resume
来源：https://github.com/amruthpillai/reactive-resume

采用：本地优先、用户拥有数据、结构化简历、模板化导出和版本管理。  
关键经验：简历事实数据与视觉模板分离。

## 3. AIHawk / AutoApply 类项目
来源：https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk

采用：岗位过滤、针对每个JD生成材料、申请去重、失败记录。  
不采用：隐身、反检测绕过、无人监督的批量提交。

## 4. JobAutomater / Open Applier 模式
来源：https://github.com/parakhkavin/JobAutomater 、https://openapplier.com/

采用：在用户自己的浏览器中填表、Dry Run、批量批准、SQLite跟踪、最后提交由用户点击。  
这是中国招聘平台自动化的主要产品模式。

## 5. DeepInterview / Interview Coach
来源：https://github.com/ngoanpv/DeepInterview 、https://github.com/J3rry320/interview-coach

采用：CV+JD生成自适应题目、浏览器语音STT/TTS、模拟面试评分、弱项记忆、多语言训练与复盘报告。  
不采用：真实面试中的隐蔽代答；实际面试仅支持经对方允许的字幕与个人笔记。

## 产品闭环

简历上传 → 本地解析与事实库 → 岗位发现/导入 → 匹配评分 → 批量生成岗位版本 → 人工批量批准 → 浏览器填表 → 人工最终提交 → 投递跟踪 → 模拟面试 → 问题与答案沉淀 → 结果反哺评分。
