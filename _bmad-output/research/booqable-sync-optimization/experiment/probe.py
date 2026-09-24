"""Read-only Booqable probe. Writes aggregate evidence only; never payloads/credentials."""
import json, os, re, time, ssl, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from collections import Counter
ENV = Path('/Users/denyskuznetsov/Documents/echelon-cycling-hub-admin/echelon-cycling-hub-admin/.env.local')
OUT = Path(__file__).with_name('result.json')
config = {}
for line in ENV.read_text().splitlines():
    match = re.match(r'^\s*(BOOQABLE_API_KEY|BOOQABLE_COMPANY_SLUG)\s*=\s*(.*?)\s*$', line)
    if match:
        config[match[1]] = match[2].strip('\"\'')
slug = config['BOOQABLE_COMPANY_SLUG']
assert re.fullmatch(r'[a-zA-Z0-9-]+', slug), 'Invalid configured slug'
BASE = f'https://{slug}.booqable.com/api/4/'
INC = 'customer,coupon,lines,lines.planning,lines.planning.stock_item_plannings,lines.planning.stock_item_plannings.stock_item,lines.item'
evidence = {'scope':'Three reserved orders, live read-only comparison; no raw payloads persisted', 'requests':[], 'comparisons':[]}
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None
opener = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile="/etc/ssl/cert.pem")))
def request(label, path, params=None, body=None):
    assert len(evidence['requests']) < 20, 'Request budget exhausted'
    assert path == 'orders' or path == 'orders/search' or re.fullmatch(r'orders/[a-zA-Z0-9-]+',path)
    assert body is None or path == 'orders/search'
    url = BASE + path + ('?' + urllib.parse.urlencode(params) if params else '')
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization':'Bearer '+config['BOOQABLE_API_KEY'],'Accept':'application/vnd.api+json','Content-Type':'application/json'})
    started=time.monotonic()
    try:
        with opener.open(req,timeout=20) as res:
            raw=res.read(8_000_001)
            assert len(raw)<=8_000_000, 'Response size budget exceeded'
            status=res.status
    except urllib.error.HTTPError as exc:
        status=exc.code; raw=b'{}'
    except Exception as exc:
        evidence['requests'].append({'label':label,'transport_error':type(exc).__name__, 'reason_type':type(getattr(exc,'reason',None)).__name__, 'reason_errno':getattr(getattr(exc,'reason',None),'errno',None), 'tls_verify_code':getattr(getattr(exc,'reason',None),'verify_code',None)})
        raise RuntimeError('Transport failed; no response data logged') from None
    row={'label':label,'status':status,'elapsed_ms':round((time.monotonic()-started)*1000),'bytes':len(raw)}
    evidence['requests'].append(row)
    if status==429: raise RuntimeError('Throttled; stopping without retry')
    if status!=200: return None
    doc=json.loads(raw)
    data=doc.get('data'); included=doc.get('included',[])
    row.update(primary_count=len(data) if isinstance(data,list) else int(isinstance(data,dict)),included_types=dict(Counter(x.get('type','unknown') for x in included)),has_next=bool(doc.get('links',{}).get('next')))
    time.sleep(.3)
    return doc

def graph(doc, oid):
    data=doc['data']; roots=data if isinstance(data,list) else [data]
    pool={(x.get('type'),x['id']):x for x in roots+doc.get('included',[]) if isinstance(x,dict) and 'id' in x}
    root=next((x for x in roots if x.get('id')==oid),None)
    if not root:return None
    # Compare all included records and dangling references reachable from this order.
    seen={}; missing=Counter(); pending=[(root.get('type'),oid)]
    while pending:
        key=pending.pop()
        if key in seen:continue
        item=pool.get(key)
        if item is None:
            missing[key[0] or 'unknown']+=1; continue
        seen[key]=item
        for rel in item.get('relationships',{}).values():
            refs=rel.get('data',[])
            if isinstance(refs,dict):refs=[refs]
            for ref in refs or []:
                if isinstance(ref,dict) and 'id' in ref:
                    k=(ref.get('type'),ref['id'])
                    # Only traversable resources belong in comparison; separately count absent refs.
                    if k in pool:pending.append(k)
                    else:missing[k[0] or 'unknown']+=1
    return seen,missing

def compare(label, batch, details, ids):
    for i,oid in enumerate(ids):
        a=graph(details[oid],oid); b=graph(batch,oid) if batch else None
        row={'label':label,'sample':i+1,'order_present':bool(b)}
        if b:
            ak,bk=set(a[0]),set(b[0]); common=ak&bk
            row.update(baseline_types=dict(Counter(k[0] for k in ak)),candidate_types=dict(Counter(k[0] for k in bk)),missing_resources=dict(Counter(k[0] for k in ak-bk)),extra_resources=dict(Counter(k[0] for k in bk-ak)),different_resources=dict(Counter(k[0] for k in common if a[0][k]!=b[0][k])),baseline_unresolved_refs=dict(a[1]),candidate_unresolved_refs=dict(b[1]),exact_graph_equal=a==b)
        evidence['comparisons'].append(row)

try:
    discovery=request('discover three reserved orders','orders',{'filter[status]':'reserved','page[size]':3,'fields[orders]':'id,status'})
    assert discovery is not None,'Discovery failed'
    ids=[x['id'] for x in discovery['data']]
    assert len(ids)>=2,'Insufficient sample'
    details={}
    for i,oid in enumerate(ids):
        doc=request(f'individual baseline {i+1}','orders/'+oid,{'include':INC})
        assert doc is not None and not doc.get('links',{}).get('next'),'Baseline failed or paginated; comparison inconclusive'
        details[oid]=doc
    batch=request('collection full includes with multi-ID filter','orders',{'filter[id]':','.join(ids),'include':INC,'page[size]':3})
    if batch: compare('collection',batch,details,ids)
    conditions={'operator':'or','attributes':[{'id':{'eq':oid}} for oid in ids]}
    body={'filter':{'conditions':conditions},'include':INC,'page':{'size':3,'number':1}}
    search=request('search full includes for same IDs','orders/search',body=body)
    if search: compare('search',search,details,ids)
    # Force primary-order pagination while retaining full includes.
    if batch:
        pages=[]
        for page in range(1,len(ids)+1):
            doc=request(f'collection page size one, page {page}','orders',{'filter[id]':','.join(ids),'include':INC,'page[size]':1,'page[number]':page})
            if not doc:break
            pages.append(doc)
        merged={'data':[x for d in pages for x in d.get('data',[])],'included':[x for d in pages for x in d.get('included',[])]}
        compare('collection paginated',merged,details,ids)
        evidence['pagination_unique_orders']=len({x['id'] for x in merged['data']})
    for i,oid in enumerate(ids):
        after=request(f'individual stability check {i+1}','orders/'+oid,{'include':INC})
        evidence.setdefault('stability',[]).append({'sample':i+1,'unchanged':bool(after) and graph(after,oid)==graph(details[oid],oid)})
except Exception as exc:
    evidence['stopped']=str(exc) if isinstance(exc,(RuntimeError,AssertionError)) else type(exc).__name__
finally:
    OUT.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence,indent=2))
