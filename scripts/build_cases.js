'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),E=require('../assets/engine.js');
const ROOT=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'data/catalog.js'),'utf8'),ctx);
const catalog=ctx.window.CTA_CATALOG;
const pct=x=>Number.isFinite(x)?(x*100).toFixed(2)+'%':'—',money=x=>x.toLocaleString('en-US',{maximumFractionDigits:2});
const examples=[];
let md='# 固定参数的真实历史案例\n\n这些结果由 `node scripts/build_cases.js` 使用本项目实际历史数据和同一回测引擎生成，没有为展示挑选最优参数。数据是用户研究快照，未对提供方原始行情做独立外部核验。\n\n统一规则：收盘决策、次根开盘成交；本金1,000,000；入场名义仓位100%；单边手续费3bps、滑点2bps；SMA/EMA/布林周期20、快慢10/40、布林K=2；不启用ATR；区间末尾估值平仓。BTC为USDT，焦煤为CNY，金额不得跨币种相加。\n\n';
for(const [id,start,end,allowShort] of [['BTCUSDT_1d','2024-01-01','2026-09-28',false],['JM_CONT_1h','2024-05-20','2026-09-29',true]]){
 const ds=catalog.datasets.find(x=>x.id===id);vm.runInNewContext(fs.readFileSync(path.join(ROOT,ds.file),'utf8'),ctx);const pack=ctx.window.CTADATA[id],b=E.unpack(pack),p={...E.DEFAULTS,start,end,allowShort};const rows=E.compare(b,pack.meta,p);const results=Object.keys(E.STRATEGIES).filter(x=>x!=='buyhold').map(strategy=>E.run(b,pack.meta,{...p,strategy}));const simple=results[0],trades=simple.trades;
 const picked=[['最大盈利',trades.filter(t=>t.net>0).sort((a,b)=>b.net-a.net)[0]],['最大亏损',trades.filter(t=>t.net<0).sort((a,b)=>a.net-b.net)[0]],['最大毛利润回吐',trades.filter(t=>t.mfe>0).sort((a,b)=>b.giveback-a.giveback)[0]]].filter(x=>x[1]);
 const bench=E.run(b,pack.meta,{...p,strategy:'buyhold',stop:false,allowShort:false});
 examples.push({dataset:id,dataSha256:ds.sha256,parameters:p,comparisons:rows,benchmark:bench.stats,selectedTrades:picked.map(([label,trade])=>({label,trade})),warnings:simple.warnings});
 md+=`## ${pack.meta.name} · ${pack.meta.timeframe}\n\n窗口：${b[simple.start].day}—${b[simple.end].day}；${allowShort?'多空双向':'只做多 / 空仓'}。\n\n| 规则 | 净收益 | 最大回撤 | 交易数 | 胜率 | 持仓占比 | 成本 / 本金 |\n|---|---:|---:|---:|---:|---:|---:|\n`;
 for(const r of rows)md+=`| ${r.name} | ${pct(r.total)} | ${pct(-r.maxDD)} | ${r.trades} | ${pct(r.winRate)} | ${pct(r.exposure)} | ${pct(r.costPct)} |\n`;
 md+=`\n同口径持续做多基准：净收益${pct(bench.stats.total)}，最大回撤${pct(-bench.stats.maxDD)}。持续做多仍计成本、期货移仓；不是理想化的无成本价格涨跌幅。\n\n`;
 const a=rows[0],e=rows[1],d=rows[2],f=rows[3];
 md+=`**从比较中观察，而不是预设答案。** EMA较SMA的净收益${e.total>=a.total?'更高':'更低'}（${pct(e.total)} 对 ${pct(a.total)}），交易数从${a.trades}变成${e.trades}。这说明“更敏感”与“更赚钱”是两个问题。双均线交叉的持仓占比为${pct(d.exposure)}；加入显式空仓后为${pct(f.exposure)}，但这并不保证净收益或回撤同步改善。\n\n### 单SMA的逐笔复盘\n\n`;
 for(const [label,t] of picked){md+=`**${label}：第${t.id}笔，${t.dir>0?'多':'空'}，${b[t.entryIndex].day} → ${b[t.exitIndex].day}。** 入场信号在${b[t.entrySignalIndex].day}收盘后确定（小时策略详见逐次成交时间戳）；进场价${money(t.fills[0].price)}，退出价${money(t.fills.at(-1).price)}，${t.qty.toFixed(pack.meta.kind==='future'?0:5)}${pack.meta.kind==='future'?'手':'单位'}。毛盈亏${money(t.gross)}，成本${money(t.cost)}，净盈亏${money(t.net)}。最大毛浮盈${money(t.mfe)}，最大毛浮亏${money(t.mae)}，毛利润回吐${money(t.giveback)}，移仓${t.rolls}次。\n\n退出原因：${t.exitReason}。${t.forced?'这是末尾估值动作，并非策略主动卖出。':''}\n\n`;
  md+=label==='最大盈利'?'复盘重点：这笔利润来自持有的价格路径，而不是事后挑到最低买点或最高卖点。检查它之前付出了多少次试错，再评价策略的收益结构。\n\n':label==='最大亏损'?'复盘重点：这笔亏损是固定规则的真实输出，不应为了删掉它而增加只适合该日期的条件。可以对“过滤假突破”或“提前退出”提出假设，但应同时检查被错删的盈利交易。\n\n':'复盘重点：最大浮盈不是当时可确定的可兑现收益。用更短退出周期或ATR可能减少回吐，也可能在其他趋势中提前离场；需要相同入场、不同退出的批量对照，不能把全部回吐称为可追回利润。\n\n';
 }
 if(id.startsWith('JM'))md+='**焦煤限制。** 本连续序列仅在有限的34份合约数据中，以前一交易日成交量选约，并因果衔接。它不是交易所官方主力连续。按真实合约平旧开新计盈亏，不能把换月价差算作利润。小时样本有零成交量，普通成交被跳过；末尾平仓为估值约定。未还原涨跌停无法成交、保证金强平或盘口冲击，因此这些收益不是实盘承诺。\n\n';
}
md+='## 下一步实验，不预先写结论\n\n先固定一个研究段，登记准备验证的原因与变更，只改变一个部件。比较同口径下的规则与相邻参数，再查看未反复参与调参的新时段和其他品种。对小时数据，验证段按完整交易日分割。\n\n特别不要把“趋势行情”与“震荡行情”的事后标签，直接当作实盘当时已知的模型切换条件。需要可在当时计算的环境定义和独立验证。\n';
fs.writeFileSync(path.join(ROOT,'docs/CASE_STUDIES.md'),md);
fs.writeFileSync(path.join(ROOT,'docs/example-results.json'),JSON.stringify({engineVersion:E.VERSION,examples},(_,v)=>v===Infinity?'Infinity':v,2));
console.log(examples.map(x=>({dataset:x.dataset,rows:x.comparisons.map(r=>({strategy:r.strategy,total:pct(r.total),dd:pct(-r.maxDD),trades:r.trades}))})));
