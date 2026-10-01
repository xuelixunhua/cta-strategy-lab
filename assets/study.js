/* Teaching definitions and deterministic presets. No market data or optimisation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CTAStudy=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='1.2.0';
const ORDER=['sma','ema','dual','dual_flat','boll_break','sf01','supertrend','boll_revert'];
const LESSONS={
 sma:{group:'建立基准',parent:null,problem:'“看着像上涨”不能直接执行，也无法复盘。',change:'用价格相对一根均线的位置，写出第一套可执行规则。',cost:'震荡时反复试错；趋势结束后，滞后退出会回吐利润。',hypothesis:'假设方向有延续性，不预测顶底，跟随已经出现的趋势。',hold:'只要收盘仍在均线同一侧，就维持对应方向；入场后不逐根重置数量。',test:'先找一笔趋势盈利和一串震荡亏损。问题出在方向、退出，还是成本？',next:'ema'},
 ema:{group:'调整信号',parent:'sma',problem:'SMA对近期价格变化的反应有时不够及时。',change:'只把SMA换为EMA，保持周期与其余规则不变。',cost:'近期权重更高，但并非每次转折都更早，也可能增加无效交易。',hypothesis:'仍然赚趋势延续的钱，不是换了指标就换了收益来源。',hold:'收盘仍在EMA同一侧时持有；穿越时才产生退出或反手指令。',test:'与SMA对照：提前反应挽回的利润，是否覆盖了额外磨损？',next:'dual'},
 dual:{group:'调整信号',parent:'sma',problem:'价格频繁穿越单均线，单根噪声会带来反复交易。',change:'将“价格对均线”改为“快线对慢线”，平滑方向信号。',cost:'平滑也会增加滞后；双均线不天然意味着更早离场。',hypothesis:'让趋势持续一段时间、形成快慢线差异后再参与。',hold:'快慢线排序不变就持有。双向模式仍可能一直多空切换，而没有等待状态。',test:'少了多少小交易，又错过了多少趋势开头和结尾？',next:'dual_flat'},
 dual_flat:{group:'加入空仓',parent:'dual',problem:'只按快慢线反转退出，可能把平仓与反手捆在一起。',change:'方向仍由快慢线确定，再用价格对快线控制进出，加入明确的空仓状态。',cost:'可以先退一步，也可能提前卖出后又重新买回，增加成本。',hypothesis:'趋势方向和进场时机是两件事；暂时不交易也属于系统决策。',hold:'快慢线与价格条件同时满足才持仓；少一项就退出等待，不必立刻做反方向。',test:'空仓避开了无效波动，还是同时错过了趋势利润？',next:'boll_break'},
 boll_break:{group:'突破分支',parent:'dual_flat',problem:'在均线附近交易，仍可能没有足够明确的入场门槛。',change:'用波动通道界定突破；先超过上一根已确定的边界，再跟随。',cost:'通道内少做交易，但会遇到假突破，也会错过未突破的缓慢趋势。',hypothesis:'价格越过近期波动范围后，存在继续延伸的可能。',hold:'突破后不要求每根都保持在上轨外；多头默认等收盘跌回中轨下方退出，空头对称。',test:'看少数大盈利能否覆盖假突破成本；随后只改退出，研究回吐与过早离场。',next:'sf01'},
 sf01:{group:'突破分支',parent:'boll_break',problem:'想检验突破边界是否应由另一种价格结构定义。',change:'改成U=O+H−C、D=O+L−C的历史极值通道；本教学版默认用对侧边界退出。',cost:'入场边界和原生退出均与布林不同；并非“布林的必然升级”，要隔离变量另做对照。',hypothesis:'突破历史OHLC变换边界，可能代表新的趋势阶段；这是待检验假设。',hold:'多头保持到收盘跌破下轨，空头反之；教学实现可叠加或替换为独立退出。',test:'先理解变换后的边界为何不等于原始最高最低价，再固定退出做入场对照。',next:'supertrend'},
 supertrend:{group:'趋势与退出',parent:'boll_break',problem:'想把趋势状态、波动距离和跟踪边界组织在一起。',change:'引入ATR距离和递推边界；HL2版与KAMA研究变体各自有明确公式。',cost:'改变的不止一条线。ATR、中心、状态初始化都影响结果，震荡仍会反复翻转。',hypothesis:'通过波动适应的边界保持趋势状态，翻转时退出或反手。',hold:'状态未翻转就跟随；同向状态延续也可成为入场依据，不一定刚发生翻转。',test:'分别检验中心、ATR算法与退出方式，不因名称相似就视作相同策略。',next:'boll_revert'},
 boll_revert:{group:'回归分支 · 非趋势升级',parent:'boll_break',problem:'当研究假设是“偏离后回归”，追涨杀跌并非合适的表达。',change:'沿用布林通道，改为从带外回到带内后交易向中轨回归。',cost:'这是另一种收益假设；高胜率也可能被少数强单边损失抵消。',hypothesis:'假设这一次偏离会收敛，而不是继续扩张；不能同时把它解释为突破追随。',hold:'不要求价格立刻回归；默认等待中轨目标。持续单边时可能长期逆势，需研究风险退出。',test:'检查最大亏损和盈利因子，不只看胜率；与突破策略比较时承认假设已经改变。',next:null}
};
const FLOW=['假设','入场','持有与仓位','退出','再入场','验证'];
function preset(strategy,tf){if(!LESSONS[strategy]||!['1h','1d'].includes(tf))throw Error('未知策略或周期');const h=tf==='1h';return {n:h?48:20,fast:h?24:10,slow:h?96:40,k:2,atrN:h?24:14,atrK:3,trailN:h?48:22,trailPct:5,invMin:1,invMax:20,stVariant:'hl2',exitMode:'overlay',reentry:'fresh',stop:false,exitType:'native',...(strategy==='supertrend'?{n:h?24:10,k:3}:{})};}
function presetLabel(strategy,tf,p){p=p||preset(strategy,tf);return (tf==='1h'?'小时':'日线')+'教学起点 · '+(strategy.startsWith('dual')?'SMA '+p.fast+' / '+p.slow:strategy==='supertrend'?'ATR '+p.n+' × '+p.k:'N='+p.n+(strategy.startsWith('boll')?' / K='+p.k:''));}
function flowCards(strategy,p,engine){const l=LESSONS[strategy],s=engine.STRATEGIES[strategy],name=engine.EXIT_TYPES[p.exitType];return[
 l.hypothesis,
 s.entry+' 收盘确定条件，下一根可交易开盘才执行。',
 l.hold+' 每次入场按当时权益的'+Math.round(p.exposure*100)+'%分配名义仓位；期货取整数手。',
 p.stop?(p.exitMode==='replace'?'忽略原正常退出，改由':'保留原正常退出，另外叠加')+name+'。保护线用已完成K线计算，下一根才生效；跳空按更差开盘。':s.exit,
 p.stop&&p.reentry==='fresh'?'保护退出后，同方向条件必须先失效、再重新出现；反方向不受该方向锁限制。不是一止损就买回。':p.stop?'保护退出后，只要入场条件仍成立，就允许下一次执行重新进场；观察反复进出的成本。':'按原策略再次判断；只多模式不建立空头。布林与SF01正常退出不在同一收盘直接反手，均线与趋势状态可能反手。',
 l.test+' 计入费用与滑点，用未参与调参的时间段检验；窗口末尾估值平仓不是策略判断。'
];}
const fmt=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'未就绪';
function condition(b,ind,p,i,dir,phase='entry'){
 const x=b[i];if(!x)return'该时点没有可核对行情。';const close='收盘 '+fmt(x.c);let text='';
 if(['sma','ema'].includes(p.strategy))text=close+' '+(x.c>ind.single[i]?'>':x.c<ind.single[i]?'<':'=')+' '+p.strategy.toUpperCase()+'('+p.n+') '+fmt(ind.single[i]);
 else if(p.strategy.startsWith('dual')){text='快线 '+fmt(ind.fast[i])+' '+(ind.fast[i]>ind.slow[i]?'>':ind.fast[i]<ind.slow[i]?'<':'=')+' 慢线 '+fmt(ind.slow[i]);if(p.strategy==='dual_flat')text+='；'+close+' '+(x.c>ind.fast[i]?'>':x.c<ind.fast[i]?'<':'=')+' 快线 '+fmt(ind.fast[i]);}
 else if(p.strategy==='supertrend'){const st=ind.st;const flip=i>0&&st.direction[i]!==st.direction[i-1];text='趋势状态 '+(st.direction[i]>0?'多头':st.direction[i]<0?'空头':'预热')+'（'+(flip?'本根切换':'延续既有状态')+'），跟踪线 '+fmt(st.line[i]);}
 else if(p.strategy==='boll_revert'&&phase==='entry'){const previous=b[i-1];text='前收 '+fmt(previous?.c)+(dir>0?' < 当时下轨 '+fmt(ind.lower[i-1]):' > 当时上轨 '+fmt(ind.upper[i-1]))+'；本收 '+fmt(x.c)+(dir>0?' ≥ 本根既定下轨 '+fmt(ind.lower[i])+'，且 < 中轨 ':' ≤ 本根既定上轨 '+fmt(ind.upper[i])+'，且 > 中轨 ')+fmt(ind.mid[i]);}
 else {const key=phase==='exit'?(p.strategy==='sf01'?(dir>0?'lower':'upper'):'mid'):(dir>0?'upper':'lower'),v=ind[key][i];text=close+' '+(x.c>v?'>':x.c<v?'<':'=')+' '+({upper:'既定上轨',lower:'既定下轨',mid:'既定中轨'}[key])+' '+fmt(v);}
 return text+'（信号价格坐标）。';
}
function explainTrade(b,r,t){const entry=condition(b,r.indicators,r.p,t.entrySignalIndex,t.dir);let exit;const f=t.fills.at(-1),stop=r.stopLine[t.exitIndex];
 if(t.forced)exit=t.exitReason+'。这是账目边界／风险终止，不是趋势或通道给出的普通退出信号。';
 else if(t.stopExit){const gap=t.exitReason.includes('开盘跳过');exit='事先确定的保护线 '+fmt(stop)+'；'+(gap?'实际执行参考价映射到信号坐标 '+fmt(f.signalPrice):'本根'+(t.dir>0?'最低 ':'最高 ')+fmt(b[t.exitIndex][t.dir>0?'l':'h'])+(t.dir>0?' ≤ ':' ≥ ')+'保护线')+'。'+(gap?'发生跳空，不能按理想线价成交。':'盘中仅检测事先已确定的线，不用本根新高倒推止损。');}
 else if(t.exitSignalIndex!=null)exit=condition(b,r.indicators,r.p,t.exitSignalIndex,t.dir,'exit')+' '+t.exitReason+'。';
 else exit=t.exitReason+'；没有对应的普通收盘信号，不能硬套指标解释。';
 return {entry,execution:'信号后在可交易开盘执行，参考价 '+fmt(t.entryRaw)+'，含滑点模拟成交 '+fmt(t.fills[0].price)+'；数量 '+fmt(t.qty)+'。',exit,review:'毛盈亏 '+fmt(t.gross)+' − 成本 '+fmt(t.cost)+' = 净盈亏 '+fmt(t.net)+'。最大毛浮盈 '+fmt(t.mfe)+'，毛利润回吐 '+fmt(t.giveback)+'；浮盈不是当时可知的完美卖点。'};
}
function priceCapability(b,meta){const differs=meta.kind==='future'&&b.some(x=>Math.abs((x.factor||1)-1)>1e-9);return {canSwitch:differs,label:differs?'信号 / 原合约双口径':meta.kind==='future'?'单合约 · 两口径相同':meta.kind==='crypto'?'现货价格 · 无换月复权':'统一调整价格代理',explanation:differs?'信号价用于连续指标；原合约价还原实际合约尺度。K线、指标与保护线一并变换，交易账目和净值不变。':meta.kind==='future'?'该单合约没有换月衔接，信号价与原始价相同，因此没有可切换的第二套曲线。':meta.kind==='crypto'?'这是现货OHLC，没有期货换月衔接；两种显示不会形成不同曲线。':'当前数据只有统一口径的价格代理，不提供独立原始价视图；不是未响应的切换按钮。'};}
return {VERSION,ORDER,LESSONS,FLOW,preset,presetLabel,flowCards,condition,explainTrade,priceCapability};
});
