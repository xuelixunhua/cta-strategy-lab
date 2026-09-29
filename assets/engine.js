/* CTA Strategy Lab — original educational engine, MIT (code only).
   Deliberately independent of any proprietary/private research framework. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CTAEngine=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='1.1.0';
const STRATEGIES={
 sma:{name:'单均线 SMA',tag:'先建立一个可执行规则',n:20,lesson:'价格在均线上方做多；下方做空或空仓。先观察震荡磨损与趋势回吐，再谈改进。',entry:'收盘价 > SMA(N)：目标多仓；收盘价 < SMA(N)：目标做空（多空模式）或空仓等待（只多模式）。',exit:'收盘价穿到均线另一侧，下一根开盘退出或反手；等于均线时空仓。',tradeoff:'均线越短，反应越快，也可能交易越密；越长越能容忍波动，却可能回吐更多。',question:'亏损来自方向判断、频繁换手，还是退出太慢？'},
 ema:{name:'指数均线 EMA',tag:'只改变一个部件',n:20,lesson:'保留相同的进出规则与周期，只把均线换成EMA。近期权重增加，不代表收益一定增加。',entry:'收盘价与 EMA(N) 比较；其他交易规则与单SMA一致。EMA先用N点SMA初始化，再以α=2/(N+1)递推。',exit:'收盘价落到EMA另一侧时，下一根开盘退出或反手。',tradeoff:'相同N下EMA更看重近期价格；更快离场也可能带来更快的反复止错。',question:'同一窗口、相同成本下，少回吐的部分能抵掉额外磨损吗？'},
 dual:{name:'双均线交叉',tag:'把价格信号变得更平滑',n:20,lesson:'用快线与慢线的相对位置表示方向。普通双均线仍然可以是“非多即空”，不会天然产生空仓。',entry:'SMA(快) > SMA(慢)：做多；快线 < 慢线：做空或空仓。',exit:'快慢线关系反转时退出或反手。快慢相等时空仓。',tradeoff:'对单根价格波动可能更不敏感，但会引入额外滞后；双线也不保证出场更早。',question:'滤掉的假信号，是否以错过一段趋势为代价？'},
 dual_flat:{name:'双均线 + 空仓',tag:'分开入场与出场',n:20,lesson:'慢线约束方向，快线负责进出。第一次把“先退场、再等待”写成明确的状态机。',entry:'快线>慢线且收盘>快线：多；快线<慢线且收盘<快线：空；其余：空仓等待。',exit:'多仓收盘跌回快线下方，或快慢关系失效则平仓；空仓位等待重新满足入场。空头对称。',tradeoff:'能在大趋势尚未反转时先退出，但来回穿越快线仍会磨损，也可能过早离场。',question:'空仓减少的是无效波动，还是也减少了趋势参与？'},
 boll_break:{name:'布林带突破',tag:'只交易越过边界的行情',n:20,lesson:'波动通道把入场门槛写得更明确。收盘突破上轨跟随，而不是因为“涨多了”去做空。',entry:'空仓时，收盘>上一根已形成的上轨做多；收盘<上一根下轨做空。中轨SMA(N)，上下轨为中轨±K×总体标准差。',exit:'多仓收盘回到中轨下方则退出；空头对称。出场信号不在同一根收盘直接反手。',tradeoff:'可以减少通道内的小交易，也可能遇到假突破；大K门槛更高、信号更少。',question:'盈利来自少数大趋势吗？假突破损失是否在成本后可承受？'},
 boll_revert:{name:'布林带回归',tag:'同一指标，不同交易假设',n:20,lesson:'等价格从带外回到带内，再交易向中轨回归。它依赖回归而非趋势延续，不能和突破策略混为一谈。',entry:'上一收盘低于当时下轨，本根回到下轨上方且仍低于中轨：做多；上轨回落条件对称做空。',exit:'多仓收盘到达中轨或以上平仓；空头对称。可增加ATR止损，但止损不保证必能按理想价成交。',tradeoff:'横盘中可能更合适；强单边中可能连续接反弹并亏损。返回带内不等于趋势结束。',question:'回归是否真实存在？最大的逆向趋势损失会不会吃掉许多小盈利？'},
 sf01:{name:'SF01 通道 · 教学版',tag:'改变突破边界的定义',n:20,lesson:'从笔记中的OHLC变换构造通道。只改边界，不把策略名称当成额外优势。',entry:'U=O+H−C，D=O+L−C；取前N根U的最高和D的最低。收盘突破已知上轨做多、跌破下轨做空。',exit:'默认多仓收盘跌破下轨退出，空头突破上轨退出；可在独立退出模块中替换。完整执行规则为本项目教学约定，不声称复刻原策略。',tradeoff:'它与普通最高/最低通道不同，阈值甚至可位于原K线外侧；仍有假突破与参数敏感性。',question:'改变边界后，筛掉的是假突破还是有价值的趋势？'},
 supertrend:{name:'SuperTrend',tag:'趋势状态与跟踪边界',n:20,lesson:'比较HL2＋Wilder ATR教学版本与KAMA＋滚动ATR研究变体。相似的名称不意味着相同的规则。',entry:'按已完成K线递推单向收紧的上下带，突破前一根反向带时切换趋势；默认跟随多/空趋势状态。',exit:'默认趋势翻转时退出或反手；也能保留趋势入场，仅由独立退出模块平仓。',tradeoff:'ATR让价格距离随波动变化；震荡中仍可能翻转。KAMA中心、ATR算法、初始化和执行时点都会改变结果。',question:'效果来自中心线、ATR平滑、趋势状态，还是退出机制？'},
 buyhold:{name:'同口径持续做多',n:20}
};
const EXIT_TYPES={native:'原策略退出',atr:'收盘锚定 ATR',chandelier:'吊灯退出',percent:'百分比跟踪',invvol:'波动率倒数（实验）'};
const DEFAULTS={exitType:'native',exitMode:'overlay',reentry:'fresh',trailPct:5,trailN:22,invMin:1,invMax:20,stVariant:'hl2',strategy:'sma',n:20,fast:10,slow:40,k:2,atrN:14,atrK:3,stop:false,initial:1000000,exposure:1,feeBps:3,slipBps:2,allowShort:false,forceClose:true};
function unpack(pack){if(!pack||!Array.isArray(pack.bars))throw Error('行情格式无效');const fields=pack.meta.fields;return pack.bars.map(r=>{const b={};fields.forEach((f,i)=>b[f]=r[i]);return b;});}
function sma(x,n){const a=Array(x.length).fill(null);let sum=0;for(let i=0;i<x.length;i++){sum+=x[i];if(i>=n)sum-=x[i-n];if(i>=n-1)a[i]=sum/n;}return a;}
function ema(x,n){const a=Array(x.length).fill(null);if(x.length<n)return a;let s=0;for(let i=0;i<n;i++)s+=x[i];a[n-1]=s/n;const alpha=2/(n+1);for(let i=n;i<x.length;i++)a[i]=alpha*x[i]+(1-alpha)*a[i-1];return a;}
function deviation(x,n,mean){const out=Array(x.length).fill(null);for(let i=n-1;i<x.length;i++){let ss=0;for(let j=i-n+1;j<=i;j++)ss+=(x[j]-mean[i])**2;out[i]=Math.sqrt(ss/n);}return out;}
function atr(b,n){const tr=b.map((v,i)=>Math.max(v.h-v.l,i?Math.abs(v.h-b[i-1].c):0,i?Math.abs(v.l-b[i-1].c):0));const a=Array(b.length).fill(null);if(b.length<n)return a;a[n-1]=tr.slice(0,n).reduce((s,v)=>s+v,0)/n;for(let i=n;i<b.length;i++)a[i]=(a[i-1]*(n-1)+tr[i])/n;return a;}
function extrema(x,n,maximum){const out=Array(x.length).fill(null),queue=[];let head=0;for(let i=0;i<x.length;i++){while(head<queue.length&&queue[head]<=i-n)head++;while(queue.length>head&&(maximum?x[queue.at(-1)]<=x[i]:x[queue.at(-1)]>=x[i]))queue.pop();queue.push(i);if(i>=n-1)out[i]=x[queue[head]];}return out;}
function kama(x,n,fast=2,slow=30){const out=Array(x.length).fill(null);if(x.length<=n)return out;let noise=0;for(let i=1;i<=n;i++)noise+=Math.abs(x[i]-x[i-1]);out[n-1]=x.slice(0,n).reduce((a,v)=>a+v,0)/n;for(let i=n;i<x.length;i++){if(i>n)noise+=Math.abs(x[i]-x[i-1])-Math.abs(x[i-n]-x[i-n-1]);const er=noise>1e-12?Math.abs(x[i]-x[i-n])/noise:0,alpha=(er*(2/(fast+1)-2/(slow+1))+2/(slow+1))**2;out[i]=out[i-1]+alpha*(x[i]-out[i-1]);}return out;}
function supertrend(b,n,k,variant='hl2'){
 const c=b.map(x=>x.c),center=variant==='kama'?kama(c,n):b.map(x=>(x.h+x.l)/2),tr=b.map((x,i)=>Math.max(x.h-x.l,i?Math.abs(x.h-c[i-1]):0,i?Math.abs(x.l-c[i-1]):0));
 const a=variant==='kama'?sma(tr,n):atr(b,n),up=Array(b.length).fill(null),down=Array(b.length).fill(null),line=Array(b.length).fill(null),direction=Array(b.length).fill(0);let prev=-1;
 for(let i=0;i<b.length;i++){if(a[i]==null||center[i]==null)continue;const hi=center[i]+k*a[i],lo=center[i]-k*a[i],ref=variant==='kama'?center[i]:c[i];
 if(prev<0){up[i]=hi;down[i]=lo;direction[i]=c[i]>=center[i]?1:-1;}
 else{const priorRef=variant==='kama'?center[prev]:c[prev];up[i]=priorRef<=up[prev]?Math.min(hi,up[prev]):hi;down[i]=priorRef>=down[prev]?Math.max(lo,down[prev]):lo;direction[i]=ref>=up[prev]?1:ref<down[prev]?-1:direction[prev];}
 line[i]=direction[i]>0?down[i]:up[i];prev=i;}return{up,down,line,direction,center,atr:a};
}
function indicators(b,p){const c=b.map(v=>v.c),single=p.strategy==='ema'?ema(c,p.n):sma(c,p.n),fast=sma(c,p.fast),slow=sma(c,p.slow),mean=sma(c,p.n),isBoll=p.strategy.startsWith('boll'),std=isBoll?deviation(c,p.n,mean):Array(b.length).fill(null);
 const ind={single,fast,slow,mid:mean.map((v,i)=>i?mean[i-1]:null),upper:mean.map((v,i)=>i&&std[i-1]!=null?mean[i-1]+p.k*std[i-1]:null),lower:mean.map((v,i)=>i&&std[i-1]!=null?mean[i-1]-p.k*std[i-1]:null),atr:atr(b,p.atrN)};
 if(p.strategy==='sf01'){const u=extrema(b.map(x=>x.o+x.h-x.c),p.n,true),l=extrema(b.map(x=>x.o+x.l-x.c),p.n,false);ind.upper=u.map((v,i)=>i?u[i-1]:null);ind.lower=l.map((v,i)=>i?l[i-1]:null);ind.mid=ind.upper.map((v,i)=>v==null?null:(v+ind.lower[i])/2);}
 if(p.strategy==='supertrend')ind.st=supertrend(b,p.n,p.k,p.stVariant);return ind;
}
function trailingDistance(p,currentVol,entryVol){if(p.exitType!=='invvol')return p.trailPct/100;return Math.max(p.invMin/100,Math.min(p.invMax/100,p.trailPct/100*entryVol/Math.max(currentVol,1e-9)));}
function validateSettings(input){const p={...DEFAULTS,...input};if(!Object.hasOwn(input,'exitType'))p.exitType=input.stop?'atr':'native';p.stop=p.exitType!=='native';if(!Object.hasOwn(EXIT_TYPES,p.exitType))throw Error('未知退出规则');if(!['overlay','replace'].includes(p.exitMode)||!['fresh','state'].includes(p.reentry)||!['hl2','kama'].includes(p.stVariant))throw Error('退出组合、再入场或SuperTrend版本无效');if(!Number.isInteger(p.trailN)||p.trailN<2||p.trailN>500)throw Error('吊灯窗口须为2至500');if(![p.trailPct,p.invMin,p.invMax].every(x=>Number.isFinite(x)&&x>0&&x<100)||p.invMin>p.invMax)throw Error('百分比须在0与100之间，且下限不大于上限');if(!STRATEGIES[p.strategy])throw Error('未知策略');for(const key of ['n','fast','slow','atrN'])if(!Number.isInteger(p[key])||p[key]<2||p[key]>500)throw Error('周期必须为2至500的整数');if(p.fast>=p.slow)throw Error('快线周期必须小于慢线');for(const key of ['initial','exposure','k','atrK'])if(!Number.isFinite(p[key])||p[key]<=0)throw Error('本金、仓位及倍数必须大于0');if(p.exposure>3)throw Error('教学版名义仓位上限为3倍');for(const key of ['feeBps','slipBps'])if(!Number.isFinite(p[key])||p[key]<0||p[key]>500)throw Error('手续费/滑点须在0至500基点内');return p;}
function decide(i,b,ind,p,pos){const C=b[i].c,dir=pos?pos.dir:0;let target=0,reason='等待条件';const set=(d,r)=>({target:d<0&&!p.allowShort?0:d,reason:r,signalIndex:i});
 if(p.strategy==='supertrend')return set(ind.st.direction[i],ind.st.direction[i]?'SuperTrend趋势状态':'SuperTrend预热');
 if(p.strategy==='buyhold')return set(1,'持续做多基准');
 if(p.strategy==='sma'||p.strategy==='ema'){const m=ind.single[i];if(m==null)return set(0,'指标预热');target=C>m?1:C<m?-1:0;return set(target,`收盘${target===1?'高于':target===-1?'低于':'等于'}${p.strategy.toUpperCase()}(${p.n})`);}
 if(p.strategy==='dual'||p.strategy==='dual_flat'){const f=ind.fast[i],s=ind.slow[i];if(s==null||f==null)return set(0,'指标预热');if(p.strategy==='dual'){target=f>s?1:f<s?-1:0;reason='快慢均线相对位置改变';}else{target=f>s&&C>f?1:f<s&&C<f?-1:0;reason=target?'趋势方向与快线进场条件同时成立':'价格越过快线或趋势条件失效，空仓等待';}return set(target,reason);}
 const u=ind.upper[i],l=ind.lower[i],m=ind.mid[i];if(u==null||l==null||u-l<1e-12)return set(0,'通道预热或零波动');
 if(p.strategy==='sf01'){if(dir===1)return set(C<l?0:1,C<l?'收盘跌破SF01下轨':'保持多仓');if(dir===-1)return set(C>u?0:-1,C>u?'收盘突破SF01上轨':'保持空仓');return set(C>u?1:C<l?-1:0,'收盘突破前N根SF01边界');}
 if(p.strategy==='boll_break'){if(dir===1)return set(C<m?0:1,C<m?'收盘跌回中轨下方':'保持多仓');if(dir===-1)return set(C>m?0:-1,C>m?'收盘升回中轨上方':'保持空仓');return set(C>u?1:C<l?-1:0,C>u?'收盘突破既定上轨':C<l?'收盘跌破既定下轨':'通道内等待');}
 if(dir===1)return set(C>=m?0:1,C>=m?'回归中轨，多仓平仓':'等待向中轨回归');if(dir===-1)return set(C<=m?0:-1,C<=m?'回归中轨，空仓平仓':'等待向中轨回归');
 const prev=b[i-1],pl=ind.lower[i-1],pu=ind.upper[i-1];if(!prev||pl==null)return set(0,'通道预热');return set(prev.c<pl&&C>=l&&C<m?1:prev.c>pu&&C<=u&&C>m?-1:0,'收盘从带外返回带内，等待向中轨回归');
}
function run(bars,meta,input={}){
 const p=validateSettings(input),b=bars,ind=indicators(b,p);if(!b.length)throw Error('没有可用行情');
 let start=input.startIndex??b.findIndex(x=>!input.start||x.day>=input.start);let end=input.endIndex??(()=>{for(let i=b.length-1;i>=0;i--)if(!input.end||b[i].day<=input.end)return i;return -1;})();
 if(start<0||end<start||end>=b.length||end-start<2)throw Error('所选区间至少需要3根真实K线');
 const multi=meta.multiplier||1, tick=meta.tick||0, isFuture=meta.kind==='future';let cash=p.initial, pos=null,pending=null,costs=0,tradeId=0,bankrupt=false,skipped=0,gapCount=0,blockedDirection=0;const trades=[],fills=[],curve=[],signals=[],stopLine=Array(b.length).fill(null),warnings=[];
 const mark=(price)=>cash+(pos?pos.dir*pos.qty*multi*(price-pos.legEntry):0);
 function transact(kind,raw,side,qty,i,reason,contract,extra={}){
   const slipped=raw*(1+side*p.slipBps/10000);let price=tick?(side>0?Math.ceil((slipped-1e-9)/tick)*tick:Math.floor((slipped+1e-9)/tick)*tick):slipped;
   if(price<=0)throw Error('滑点后价格无效');const fee=Math.abs(price*qty*multi)*p.feeBps/10000,slippage=Math.abs(price-raw)*qty*multi;
   const f={tradeId:pos?.id??tradeId+1,kind,index:i,t:b[i].t,raw,price,side,qty,fee,slippage,cost:fee+slippage,reason,contract:contract||'',signalPrice:raw*(extra.factor??b[i].factor??1),...extra};fills.push(f);cash-=f.cost;costs+=f.cost;if(pos){pos.cost+=f.cost;pos.fills.push(f);}return f;
 }
 function enter(dir,i,reason,signalIndex){const raw=b[i].rawO,eq=cash,slip=p.slipBps/10000,fee=p.feeBps/10000,entryReserve=!isFuture&&dir>0?1+slip+(1+slip)*fee:1,available=eq*p.exposure/(raw*multi*entryReserve);let qty=isFuture?Math.floor(available):available;if(qty<=0||!Number.isFinite(qty)){skipped++;return;}
   pos={id:++tradeId,dir,qty,entryIndex:i,entryTime:b[i].t,entryDay:b[i].day,entryRaw:raw,entrySignalPrice:b[i].o,entrySignalIndex:signalIndex,entryReason:reason,entryEquity:eq,entryNotional:qty*raw*multi,entryContract:b[i].contract||'',contract:b[i].contract||'',legEntry:raw,realized:0,cost:0,mfe:0,mae:0,rolls:0,stop:null,factor:b[i].factor||1,peak:b[i].o,trough:b[i].o,entryVol:ind.atr[i-1]!=null?ind.atr[i-1]/Math.abs(b[i-1].c):null,fills:[]};
   transact('entry',raw,dir,qty,i,reason,pos.contract,{signalIndex});
   if(p.stop){if(['percent','invvol'].includes(p.exitType))pos.stop=b[i].o*(1-dir*trailingDistance(p,pos.entryVol,pos.entryVol));else if(ind.atr[i-1]!=null)pos.stop=b[i].o-dir*p.atrK*ind.atr[i-1];}
 }
 function close(i,raw,reason,kind='exit',signalIndex=null,factor=null){if(!pos)return;const q=pos,gross=q.dir*q.qty*multi*(raw-q.legEntry);if(kind==='stop')blockedDirection=q.dir;cash+=gross;q.realized+=gross;transact(kind,raw,-q.dir,q.qty,i,reason,q.contract,{signalIndex,factor:factor??q.factor});
   q.mfe=Math.max(q.mfe,q.realized);q.mae=Math.min(q.mae,q.realized);const net=q.realized-q.cost;trades.push({...q,exitIndex:i,exitTime:b[i].t,exitDay:b[i].day,exitRaw:raw,exitSignalPrice:raw*(factor??q.factor),exitReason:reason,exitSignalIndex:signalIndex,exitContract:q.contract,gross:q.realized,net,returnOnEquity:net/q.entryEquity,returnOnNotional:net/q.entryNotional,giveback:Math.max(0,q.mfe-q.realized),barsHeld:i-q.entryIndex+1,forced:kind==='end',stopExit:kind==='stop'});pos=null;
 }
 for(let i=start;i<=end;i++){
   const r=b[i];if(![r.o,r.h,r.l,r.c,r.rawO,r.rawC].every(Number.isFinite))throw Error('行情含非法价格');let blocked=false;const tradable=!isFuture||(r.v!=null&&r.v>0);let holdThisBar=!!pos;stopLine[i]=pos?.stop??null;
   if(r.gap&&i>start){gapCount++;pending=null;if(pos&&tradable){close(i,r.rawO,'数据缺口后首个可观测开盘退出；缺口内路径未知','gap',null,r.factor);blocked=true;}}
   // Protective order already known at previous close has priority at the open.
   if(pos&&p.stop&&pos.stop!=null&&tradable){const oldOpen=(r.contract!==pos.contract&&r.rollOldOpen!=null)?r.rollOldOpen:r.rawO;const fac=(r.contract!==pos.contract&&r.rollOldOpen!=null)?pos.factor:r.factor;
     if((pos.dir===1&&oldOpen*fac<=pos.stop)||(pos.dir===-1&&oldOpen*fac>=pos.stop)){close(i,oldOpen,'开盘跳过'+EXIT_TYPES[p.exitType]+'线，按更差的实际开盘价退出','stop',null,fac);blocked=true;pending=null;}}
   if(pos&&r.contract!==pos.contract){
     if(r.rollOldOpen==null)throw Error('换月缺少旧合约同期开盘价：拒绝用跨合约跳价计算收益');
     if(!tradable)throw Error('换月新合约无成交量');
     if(pending&&pending.target!==pos.dir){close(i,r.rollOldOpen,pending.reason+'；换月时先平旧合约','exit',pending.signalIndex,pos.factor);}
     else{const q=pos,gross=q.dir*q.qty*multi*(r.rollOldOpen-q.legEntry);cash+=gross;q.realized+=gross;
       transact('roll-out',r.rollOldOpen,-q.dir,q.qty,i,'换月：平旧合约',q.contract,{factor:q.factor});q.contract=r.contract;q.legEntry=r.rawO;q.factor=r.factor;q.rolls++;
       transact('roll-in',r.rawO,q.dir,q.qty,i,'换月：开新合约（同手数）',q.contract);
     }
   }
   if(pending&&tradable&&!blocked&&!bankrupt){if(pos&&pending.target!==pos.dir)close(i,r.rawO,pending.reason,'exit',pending.signalIndex,r.factor);if(!pos&&pending.target!==0)enter(pending.target,i,pending.reason,pending.signalIndex);}
   if(!tradable&&pending&&pending.target!==(pos?.dir||0))skipped++;
   holdThisBar=holdThisBar||!!pos;
   if(pos){pos.factor=r.factor||1;stopLine[i]=pos.stop;
     // Stops depend only on information available before this bar. No same-bar high trailing.
     let stopped=false;
     if(p.stop&&pos.stop!=null&&tradable){const hit=pos.dir===1?r.l<=pos.stop:r.h>=pos.stop;if(hit){const raw=pos.stop/(r.factor||1);close(i,raw,'本根触及事先确定的'+EXIT_TYPES[p.exitType]+'线','stop');stopped=true;}}
     // OHLC order is unknown on a stop bar: do not credit its whole high/low as MFE/MAE.
     if(pos&&!stopped){const best=pos.realized+pos.dir*pos.qty*multi*((pos.dir>0?r.rawH:r.rawL)-pos.legEntry);const worst=pos.realized+pos.dir*pos.qty*multi*((pos.dir>0?r.rawL:r.rawH)-pos.legEntry);pos.mfe=Math.max(pos.mfe,best);pos.mae=Math.min(pos.mae,worst);}
   }
   let equity=mark(r.rawC);
   if(equity<=0&&!bankrupt){if(pos)close(i,r.rawC,'权益耗尽：教学引擎停止新增交易','end');bankrupt=true;equity=cash;}
   if(i===end&&p.forceClose&&pos){close(i,r.rawC,'区间结束估值平仓（不是策略信号）','end');equity=cash;}
   curve.push({index:i,t:r.t,day:r.day,equity,position:pos?.dir||0,exposed:holdThisBar,close:r.c});
   if(i<end&&!bankrupt){pending=decide(i,b,ind,p,pos);
     if(pos&&p.stop&&p.exitMode==='replace')pending={target:pos.dir,reason:'等待独立退出，不执行原策略正常出场',signalIndex:i};
     if(!pos&&blockedDirection&&p.reentry==='fresh'){const entryState=decide(i,b,ind,p,null).target;if(entryState!==blockedDirection)blockedDirection=0;else pending={target:0,reason:'保护性退出后等待入场条件先失效、再出现',signalIndex:i};}
     if(p.stop&&p.exitType!=='percent'&&ind.atr[i]==null)pending={target:0,reason:'退出波动指标预热',signalIndex:i};signals.push({...pending,t:r.t});
     if(pos&&p.stop){pos.peak=Math.max(pos.peak,r.h);pos.trough=Math.min(pos.trough,r.l);let candidate=null;
       if(p.exitType==='atr'&&ind.atr[i]!=null)candidate=r.c-pos.dir*p.atrK*ind.atr[i];
       if(p.exitType==='chandelier'&&ind.atr[i]!=null){const from=Math.max(pos.entryIndex,i-p.trailN+1);let anchor=pos.dir>0?-Infinity:Infinity;for(let j=from;j<=i;j++)anchor=pos.dir>0?Math.max(anchor,b[j].h):Math.min(anchor,b[j].l);candidate=anchor-pos.dir*p.atrK*ind.atr[i];}
       if(['percent','invvol'].includes(p.exitType)){const d=trailingDistance(p,ind.atr[i]/Math.abs(r.c),pos.entryVol);candidate=(pos.dir>0?pos.peak:pos.trough)*(1-pos.dir*d);}
       if(candidate!=null&&Number.isFinite(candidate))pos.stop=pos.stop==null?candidate:pos.dir>0?Math.max(pos.stop,candidate):Math.min(pos.stop,candidate);
     }
   }
 }
 let peak=p.initial,maxDD=0;curve.forEach(c=>{peak=Math.max(peak,c.equity);c.dd=(c.equity-peak)/peak;maxDD=Math.max(maxDD,-c.dd);c.netValue=c.equity/p.initial;});
 const final=curve.at(-1).equity,total=final/p.initial-1,duration=(b[end].t-b[start].t+(meta.timeframe==='1h'?3600:86400))/86400;
 const annual=duration>=1&&final>0?Math.pow(final/p.initial,365.25/duration)-1:null;
 const daily=new Map();curve.forEach(c=>daily.set(c.day,c.equity));let prev=p.initial;const rets=[];daily.forEach(eq=>{rets.push(eq/prev-1);prev=eq;});const mean=rets.reduce((a,v)=>a+v,0)/rets.length;const sd=rets.length>1?Math.sqrt(rets.reduce((a,v)=>a+(v-mean)**2,0)/(rets.length-1)):0;const sharpe=rets.length>=20&&sd>1e-12?mean/sd*Math.sqrt(meta.annualDays||252):null;
 const positive=trades.filter(t=>t.net>0).reduce((a,t)=>a+t.net,0),negative=-trades.filter(t=>t.net<0).reduce((a,t)=>a+t.net,0);const wins=trades.filter(t=>t.net>0).length;let streak=0,maxLosingStreak=0;trades.forEach(t=>{streak=t.net<0?streak+1:0;maxLosingStreak=Math.max(maxLosingStreak,streak);});
 const stats={total,annual,maxDD,sharpe,cost:costs,costPct:costs/p.initial,trades:trades.length,winRate:trades.length?wins/trades.length:null,profitFactor:negative?positive/negative:positive?Infinity:null,exposure:curve.filter(c=>c.exposed).length/curve.length,final,net:final-p.initial,meanBars:trades.length?trades.reduce((a,t)=>a+t.barsHeld,0)/trades.length:0,maxLosingStreak,days:duration,dailyObservations:rets.length,skipped,gapCount,rollFills:fills.filter(f=>f.kind.startsWith('roll')).length,bankrupt};
 if(gapCount)warnings.push(`${gapCount}处数据间断：取消旧信号，持仓在下一可观测开盘退出；缺口内无法判断止损路径。`);
 if(skipped)warnings.push(`${skipped}次委托被跳过：零成交量或不足一手。`);
 if(duration<90)warnings.push('不足90天：年化数字只作机械换算，不宜外推。');
 if(meta.kind!=='future'&&p.allowShort)warnings.push('做空仅为理论实验：未计借券、融资或永续资金费，不能视为对应市场可实现收益。');
 if(p.exposure>1)warnings.push('名义仓位超过本金；未模拟交易所保证金追缴、强平及借贷成本。');
 if(meta.kind==='future')warnings.push('未模拟逐日保证金变化、涨跌停封板与盘口深度；普通交易只检查成交量>0。区间末尾平仓是估值约定。');
 return{version:VERSION,p,meta,indicators:ind,start,end,curve,trades,fills,signals,stopLine,stats,warnings,openPosition:pos};
}
function compare(b,meta,input){return Object.keys(STRATEGIES).filter(k=>k!=='buyhold').map(strategy=>{const r=run(b,meta,{...input,strategy});return {strategy,name:STRATEGIES[strategy].name,...r.stats};});}
function robustness(b,meta,input){const base=run(b,meta,input),days=[...new Set(b.slice(base.start,base.end+1).map(x=>x.day))];if(days.length<30)throw Error('至少需要30个完整交易日，避免把同一天拆进研究与验证两侧');const splitDay=days[Math.floor(days.length*.7)],split=b.findIndex((x,i)=>i>=base.start&&x.day===splitDay);if(split-base.start<20||base.end-split<8)throw Error('研究段或验证段样本不足');const scales=[.5,.75,1,1.25,1.5,2];return{splitDay,rows:scales.map(scale=>{const p={...input,n:Math.min(500,Math.max(2,Math.round(input.n*scale))),fast:Math.min(499,Math.max(2,Math.round(input.fast*scale))),slow:Math.min(500,Math.max(3,Math.round(input.slow*scale)))};if(p.fast>=p.slow)p.slow=p.fast+1;const train=run(b,meta,{...p,startIndex:base.start,endIndex:split-1}),test=run(b,meta,{...p,startIndex:split,endIndex:base.end});return{scale,n:p.n,fast:p.fast,slow:p.slow,train:train.stats,test:test.stats};})};}
function compareExits(b,meta,input){return Object.keys(EXIT_TYPES).map(exitType=>{const r=run(b,meta,{...input,exitType});return{exitType,name:EXIT_TYPES[exitType],...r.stats};});}
return{VERSION,EXIT_TYPES,STRATEGIES,DEFAULTS,extrema,kama,supertrend,trailingDistance,compareExits,unpack,sma,ema,atr,indicators,validateSettings,decide,run,compare,robustness};
});
