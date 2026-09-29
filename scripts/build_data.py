#!/usr/bin/env python3
"""Export an explicit market-data whitelist. Never import private framework code.

Input: the OHLC JSON artifact or a local market-data-research clone (Parquet).
Output: dependency-free JS data packs, usable through file:// and GitHub Pages.
"""
from __future__ import annotations
import argparse, bisect, hashlib, json, math
from pathlib import Path
import pandas as pd

FIELDS = ['t','o','h','l','c','v','contract','factor','rawO','rawH','rawL','rawC','rollOldOpen','day','gap']
INDEX_NAMES={'sh000001':'上证指数','sh000016':'上证50','sh000300':'沪深300','sh000852':'中证1000','sh000905':'中证500','sz399001':'深证成指','sz399006':'创业板指'}
US_NAMES={'SP500':'标普500','NASDAQ':'纳斯达克综合','DOW':'道琼斯','SPY':'SPY ETF','QQQ':'QQQ ETF','AAPL':'苹果 AAPL','MSFT':'微软 MSFT','NVDA':'英伟达 NVDA'}

def load_source(root: Path, rel: str) -> tuple[pd.DataFrame,str]:
    p=root/rel
    if p.exists():
        d=pd.read_parquet(p)
        return d, hashlib.sha256(p.read_bytes()).hexdigest()
    p=root/(rel.removeprefix('data/').replace('/','__').replace('.parquet','.json'))
    if not p.exists(): raise FileNotFoundError(p)
    manifest=root/'export-manifest.json'
    if not manifest.exists(): raise ValueError('JSON input requires export-manifest.json with original source hashes')
    original=next((x for x in json.loads(manifest.read_text(encoding='utf-8'))['datasets'] if x['source_path']==rel),None)
    if not original: raise ValueError(f'Original source hash missing: {rel}')
    return pd.DataFrame(json.loads(p.read_text(encoding='utf-8'))), original['sha256']

def validate(df: pd.DataFrame, key: list[str]) -> pd.DataFrame:
    d=df.copy()
    for c in ['open','high','low','close']:
        d[c]=pd.to_numeric(d[c],errors='raise')
    if d[key].duplicated().any(): raise ValueError(f'Duplicate time keys: {key}')
    valid=d[['open','high','low','close']].notna().all(axis=1)
    valid &= (d[['open','high','low','close']]>0).all(axis=1)
    valid &= (d.high >= d[['open','close','low']].max(axis=1)-1e-8)
    valid &= (d.low <= d[['open','close','high']].min(axis=1)+1e-8)
    if not valid.all(): raise ValueError(f'Invalid OHLC rows: {int((~valid).sum())}')
    if 'volume' in d and ((d.volume.dropna()<0).any()): raise ValueError('Negative volume')
    return d.sort_values(key).reset_index(drop=True)

def stamp(x): return int(pd.Timestamp(x).timestamp())
def num(x):
    if x is None or pd.isna(x): return None
    return round(float(x),8)

def row(r, contract='', factor=1.0, old=None, day=None, gap=False):
    return [round(float(r['t']),3),*[num(r[c]*factor) for c in ['open','high','low','close']],num(r.get('volume')),contract,round(factor,12),*[num(r[c]) for c in ['open','high','low','close']],num(old),day or pd.Timestamp(r['t'],unit='s',tz='UTC').strftime('%Y-%m-%d'),bool(gap)]

def aggregate(rows, kind, expected=None):
    groups={}
    for r in rows: groups.setdefault(r[13],[]).append(r)
    result=[]; omitted=[]
    for day,b in sorted(groups.items()):
        b=sorted(b,key=lambda x:x[0])
        if kind=='crypto': complete=len(b)==24 and len({x[0]//3600 for x in b})==24 and all(x[0]%3600==0 for x in b)
        else: complete=set(x[0] for x in b)==expected.get(day,set()) and len({x[6] for x in b})==1
        if not complete:
            omitted.append(day);continue
        vols=[x[5] for x in b if x[5] is not None]
        result.append([stamp(day),b[0][1],max(x[2] for x in b),min(x[3] for x in b),b[-1][4],num(sum(vols)) if vols else None,b[0][6],b[0][7],b[0][8],max(x[9] for x in b),min(x[10] for x in b),b[-1][11],b[0][12],day,False])
    for i in range(1,len(result)):
        if kind=='crypto': result[i][14]=result[i][0]-result[i-1][0]>86400
    return result, omitted

def build_continuous(d:pd.DataFrame):
    """Prior-day volume leader, forward-only expiry, simultaneous executable rolls.

    Universe is truncated source coverage, NOT an official dominant contract series.
    A roll never earns the spread between two contracts. The engine settles the old
    actual contract at rollOldOpen and opens the new one at rawO.
    """
    days=sorted(d.day.unique()); active=None; factor=1.; output=[]; audit=[]; skipped=[]
    byday={day:g for day,g in d.groupby('day',sort=True)}
    lookup={(int(r.t),r.contract):r._asdict() for r in d.itertuples(index=False)}
    for k,day in enumerate(days):
        if k==0: continue  # no prior-day selection information
        prev=byday[days[k-1]]; current=byday[day]; first=int(current.t.min())
        volume=prev.groupby('contract').volume.sum().sort_values(ascending=False)
        candidate=next((c for c,v in volume.items() if v>0 and (active is None or c>=active)),active)
        old_open=None
        if candidate and candidate!=active:
            new=lookup.get((first,candidate)); old=lookup.get((first,active)) if active else None
            can_roll=bool(new and new['volume']>0 and (active is None or (old and old['volume']>0)))
            common=prev[prev.contract.isin([active,candidate])].pivot(index='t',columns='contract',values='close') if active else None
            anchor=common.dropna() if active and active in common and candidate in common else None
            if can_roll and (active is None or (anchor is not None and len(anchor))):
                previous=active
                if active:
                    a=anchor.iloc[-1]; before=factor; factor*=float(a[active])/float(a[candidate]);old_open=float(old['open'])
                    audit.append({'day':day,'decisionDay':days[k-1],'anchorTime':int(anchor.index[-1]),'old':active,'new':candidate,'oldPreviousClose':float(a[active]),'newPreviousClose':float(a[candidate]),'oldOpen':old_open,'newOpen':float(new['open']),'factorBefore':before,'factorAfter':factor,'reason':'前一交易日样本内成交量最大；只向更远到期合约换月'})
                active=candidate
            else: skipped.append({'day':day,'candidate':candidate,'active':active,'reason':'缺少同期开盘成交或上一交易日锚点，延迟换月'})
        if active is None: continue
        selected=current[current.contract==active]
        if selected.empty:
            # Refuse to bridge an unpriceable contract disappearance.
            skipped.append({'day':day,'active':active,'reason':'当前合约缺失；连续样本在此终止，未虚构移仓价'})
            break
        for j,r in enumerate(selected.to_dict('records')):
            output.append(row(r,active,factor,old_open if j==0 else None,day))
    return output,audit,skipped

def export(root:Path, dest:Path):
    dest.mkdir(parents=True,exist_ok=True); catalog=[]; instruments={}; checks=[]; rolls=[]; sourcehash={}
    def emit(instrument,name,kind,tf,rows,**extra):
        if len(rows)<2: return
        id=f'{instrument}_{tf}'
        meta={'id':id,'instrument':instrument,'name':name,'kind':kind,'timeframe':tf,'timezone':'UTC' if kind=='crypto' else ('Asia/Shanghai' if kind=='future' else '交易日日期'),'rows':len(rows),'start':rows[0][13],'end':rows[-1][13],'fields':FIELDS,'multiplier':60 if kind=='future' else 1,'tick':0.5 if kind=='future' else 0,'annualDays':365 if kind=='crypto' else 252,'shortDefault':kind=='future',**extra}
        data={'meta':meta,'bars':rows}
        text='window.CTADATA=window.CTADATA||{};window.CTADATA['+json.dumps(id)+']='+json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)+';\n'
        (dest/(id+'.js')).write_text(text,encoding='utf-8',newline='\n')
        entry={k:v for k,v in meta.items() if k!='fields'};entry['file']='data/'+id+'.js';entry['sha256']=hashlib.sha256(text.encode()).hexdigest();catalog.append(entry)
        instruments.setdefault(instrument,{'id':instrument,'name':name,'kind':kind,'timeframes':[]})['timeframes'].append(tf)
        checks.append({'id':id,'rows':len(rows),'first':meta['start'],'last':meta['end'],'zeroVolume':sum(x[5]==0 for x in rows),'gaps':sum(bool(x[14]) for x in rows)})
    for symbol in ['BTCUSDT','ETHUSDT']:
        rel=f'data/crypto/{symbol}_spot_1h.parquet';d,sha=load_source(root,rel);sourcehash[rel]=sha
        d['timestamp']=pd.to_datetime(d.timestamp,utc=True,format="mixed");d=validate(d,['timestamp']);d['t']=d.timestamp.astype('int64')/10**9
        rows=[row(r,gap=(i>0 and abs(r['t']-float(d.iloc[i-1].t)-3600)>0.01)) for i,r in enumerate(d.to_dict('records'))]
        name='比特币 BTC' if symbol=='BTCUSDT' else '以太坊 ETH'
        common={'irregularHours':int((d.t%3600!=0).sum()),'unit':'USDT','adjustment':'现货原始OHLC','note':'币安现货历史，不是永续；默认只做多。缺失时点未补价；早期非整点K线保留小时展示，不纳入日线。多空模式仅为无资金费的理论实验。','source':'Binance public archive / 用户研究快照'}
        emit(symbol,name,'crypto','1h',rows,**common)
        daily,omitted=aggregate(rows,'crypto');emit(symbol,name,'crypto','1d',daily,omittedDays=omitted,**common)
    for symbol,name in INDEX_NAMES.items():
        rel=f'data/china_indices/{symbol}_1d.parquet';d,sha=load_source(root,rel);sourcehash[rel]=sha;d=validate(d,['date']);d['t']=pd.to_datetime(d.date).astype('int64')//10**9
        emit(symbol,name,'index','1d',[row(r) for r in d.to_dict('records')],unit='模拟单位',adjustment='指数OHLC',note='指数不能直接成交；这是点位代理实验，未替代ETF或股指期货。无小时数据，不伪造小时K线。',source='用户历史数据 + Tencent OHLC')
    for symbol,name in US_NAMES.items():
        rel=f'data/us/{symbol}_1d.parquet';d,sha=load_source(root,rel);sourcehash[rel]=sha;d=validate(d,['date']);d['t']=pd.to_datetime(d.date).astype('int64')//10**9
        index=symbol in ['SP500','NASDAQ','DOW'];kind='index' if index else ('fund' if symbol in ['SPY','QQQ'] else 'equity')
        rows=[]
        for r in d.to_dict('records'):
            f=float(r['adj_close'])/float(r['close']) if not index else 1.
            if not math.isfinite(f) or f<=0: raise ValueError(f'Invalid adjustment: {symbol}')
            x=row(r,factor=f)
            if not index:
                # The entire backtest uses one coherent adjusted-price proxy.
                # Do NOT combine raw OHLC entries with adjusted-close returns.
                x[8:12]=x[1:5];x[7]=1.
            rows.append(x)
        emit(symbol,name,kind,'1d',rows,unit='模拟单位' if index else 'USD（复权代理）',adjustment='指数OHLC' if index else 'OHLC × adj_close / close',note='指数点位代理；不是可直接交易工具。' if index else '统一调整全部OHLC；交易表为复权代理价，不是历史原始成交价。未独立还原拆股、分红现金流；允许分数份额。',source='Yahoo Finance / 用户研究快照')
    rel='data/futures/jm/contracts_1h.parquet';d,sha=load_source(root,rel);sourcehash[rel]=sha;d['timestamp']=pd.to_datetime(d.timestamp,utc=True,format="mixed");d=validate(d,['timestamp','contract']);d['t']=d.timestamp.astype('int64')/10**9
    local=d.timestamp.dt.tz_convert('Asia/Shanghai');d['localDay']=local.dt.strftime('%Y-%m-%d');d['hour']=local.dt.hour
    daytime=sorted(d.loc[(d.hour>=8)&(d.hour<18),'localDay'].unique())
    def trade_day(day,hour):
        p=bisect.bisect_right(daytime,day) if hour>=18 else bisect.bisect_left(daytime,day)
        return daytime[p] if p<len(daytime) else None
    d['day']=[trade_day(day,hour) for day,hour in zip(d.localDay,d.hour)]
    omitted_tail=int(d.day.isna().sum());d=d.dropna(subset=['day'])
    expected={day:set(int(x) for x in g.t) for day,g in d.groupby('day')}
    # Exclude days whose observed panel itself lacks a complete five-bar day session.
    complete={day:ts for day,ts in expected.items() if {pd.Timestamp(t,unit='s',tz='UTC').tz_convert('Asia/Shanghai').hour for t in ts}.issuperset({9,10,11,13,14})}
    expected={day:ts if day in complete else set() for day,ts in expected.items()}
    cont,audit,skipped=build_continuous(d)
    common={'unit':'CNY','source':'用户服务器实际JM合约快照','note':'非官方主力连续：在有限合约样本内按前一交易日成交量选约，只向更远月份换月。使用因果比例衔接；盈亏按原始合约结算并计移仓双边成本。乘数60、最小价位0.5沿用原研究配置，非现行交易所规则核验。','adjustment':'因果比例衔接（指标） / 原始合约（盈亏）','rolls':audit,'selection':'prior-day-volume-forward-only','deferredRolls':len(skipped),'tradingCalendar':'夜盘归属下一观测日盘交易日；并非官方交易日历'}
    emit('JM_CONT','焦煤 JM · 教学连续','future','1h',cont,**common)
    daily,omitted=aggregate(cont,'future',expected);emit('JM_CONT','焦煤 JM · 教学连续','future','1d',daily,omittedDays=omitted,**common)
    for symbol,g in d.groupby('contract'):
        rows=[row(r,contract=symbol,day=r['day']) for r in g.to_dict('records')]
        kw={'unit':'CNY','adjustment':'单一实际合约，无换月复权','source':'用户服务器实际JM合约快照','note':'单合约不拼接、不需要换月复权；最多1000个小时点。零成交量K线保留展示但禁止模拟成交；非全生命周期历史。乘数与最小价位沿用研究配置，未核验现行规则。','tradingCalendar':'按观测日盘归属夜盘；缺时点的日线剔除'}
        emit(symbol,symbol.upper()+' · 实际合约','future','1h',rows,**kw)
        daily,omitted=aggregate(rows,'future',expected);emit(symbol,symbol.upper()+' · 实际合约','future','1d',daily,omittedDays=omitted,**kw)
    payload={'version':'1.0.0','snapshotDate':'2026-09-29','instruments':list(instruments.values()),'datasets':catalog,'sourceCommit':json.loads((root/'export-manifest.json').read_text(encoding='utf-8')).get('source_commit') if (root/'export-manifest.json').exists() else None,'sourceHashes':sourcehash,'dataLicense':'代码MIT不覆盖行情数据；数据原始提供方保留其权利。公开再分发前应确认数据使用授权。'}
    (dest/'catalog.js').write_text('window.CTA_CATALOG='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    (dest/'quality-report.json').write_text(json.dumps({'datasets':checks,'rolls':audit,'deferred':skipped,'unassignedTailRows':omitted_tail,'limitations':['样本每合约最多1000小时，不能称作全市场或官方主力连续','期货日线以观测交易日历归属；不是官方节假日日历','股票ETF的统一复权价格仅为总回报代理','没有订单簿、资金费、涨跌停可成交性、历史保证金与分红拆股事件表']},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Exported {len(instruments)} instruments, {len(catalog)} datasets, {sum(x["rows"] for x in catalog):,} bars; {len(audit)} causal rolls.')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'data');a=p.parse_args();export(a.source,a.out)
