"""
IntelliCoin Scanner
Gate-based ranking: S / A / B / C / Rejected
Runs every hour via GitHub Actions
Auto-fetches a free working proxy at runtime to bypass Binance 451 US block
"""
import os, time, random, requests
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

BINANCE_ENDPOINTS = [
    "https://fapi.binance.com",
    "https://fapi1.binance.com",
    "https://fapi2.binance.com",
    "https://fapi3.binance.com",
    "https://fapi4.binance.com",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# ─── Proxy setup ──────────────────────────────────────────────────────────────

def get_working_proxy():
    """
    Fetch a fresh proxy from Proxifly (updated every 5 minutes, no auth needed).
    Tests each proxy against Binance until one works.
    Falls back to manual HTTPS_PROXY env var if set.
    """
    # First check if manual proxy is set
    manual = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    if manual:
        print(f"Using manual proxy from env: {manual[:30]}...")
        return {"https": manual, "http": manual}

    print("Fetching fresh proxy list from Proxifly...")
    try:
        # Proxifly free proxy list - updated every 5 minutes, no auth required
        r = requests.get(
            "https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/http/data.json",
            timeout=10,
        )
        proxies = r.json()

        # Filter to non-US proxies (avoid getting another US IP which is also blocked)
        non_us = [p for p in proxies if p.get("country") not in ("US", "United States")]
        candidates = non_us if non_us else proxies

        # Shuffle and try up to 20
        random.shuffle(candidates)
        for candidate in candidates[:20]:
            ip   = candidate.get("ip")
            port = candidate.get("port")
            if not ip or not port:
                continue
            proxy_str = f"http://{ip}:{port}"
            proxy_dict = {"https": proxy_str, "http": proxy_str}

            # Test this proxy against Binance
            try:
                test = requests.get(
                    "https://fapi.binance.com/fapi/v1/ping",
                    proxies=proxy_dict,
                    timeout=6,
                    headers=HEADERS,
                )
                if test.status_code == 200:
                    print(f"✓ Working proxy found: {ip}:{port} ({candidate.get('country','?')})")
                    return proxy_dict
            except:
                continue

        print("No working proxy found from Proxifly list — trying without proxy")
        return None

    except Exception as e:
        print(f"Could not fetch proxy list: {e}")
        return None


# ─── HTTP helper ──────────────────────────────────────────────────────────────

PROXIES = None  # set in run()

def get(path, params={}):
    last_error = None
    for base in BINANCE_ENDPOINTS:
        try:
            r = requests.get(
                f"{base}{path}",
                params=params,
                timeout=12,
                headers=HEADERS,
                proxies=PROXIES,
            )
            if r.status_code == 451:
                last_error = f"451 blocked on {base}"
                continue
            r.raise_for_status()
            time.sleep(0.04)
            return r.json()
        except requests.exceptions.HTTPError as e:
            if "451" in str(e):
                last_error = f"451 on {base}"
                continue
            raise e
        except Exception as e:
            last_error = str(e)
            continue
    raise Exception(f"All Binance endpoints failed. Last: {last_error}")


def sf(v):
    try: return float(v)
    except: return None


# ─── Data fetchers ────────────────────────────────────────────────────────────

def get_all_symbols():
    info = get("/fapi/v1/exchangeInfo")
    return [
        s["symbol"] for s in info["symbols"]
        if s["quoteAsset"] == "USDT"
        and s["contractType"] == "PERPETUAL"
        and s["status"] == "TRADING"
    ]

def get_ticker(symbol):
    return get("/fapi/v1/ticker/24hr", {"symbol": symbol})

def get_klines(symbol, limit=26):
    try: return get("/fapi/v1/klines", {"symbol": symbol, "interval": "1h", "limit": limit})
    except: return []

def get_oi_history(symbol):
    try: return get("/futures/data/openInterestHist", {"symbol": symbol, "period": "1h", "limit": 6})
    except: return []

def get_funding(symbol):
    try:
        d = get("/fapi/v1/fundingRate", {"symbol": symbol, "limit": 1})
        return sf(d[0]["fundingRate"]) if d else None
    except: return None

def get_bybit_ticker(symbol):
    try:
        r = requests.get(
            "https://api.bybit.com/v5/market/tickers",
            params={"category": "linear", "symbol": symbol},
            timeout=5, headers=HEADERS,
        )
        data = r.json()
        if data.get("retCode") == 0 and data["result"]["list"]:
            chg = sf(data["result"]["list"][0].get("price24hPcnt", "0"))
            return {"price_chg_pct": (chg or 0) * 100}
        return None
    except: return None


# ─── Indicators ───────────────────────────────────────────────────────────────

def calc_oi_change(oi_hist):
    try:
        if len(oi_hist) < 2: return None
        old = float(oi_hist[0]["sumOpenInterest"])
        nw  = float(oi_hist[-1]["sumOpenInterest"])
        return ((nw - old) / old * 100) if old > 0 else None
    except: return None

def calc_volume_ratio(klines):
    try:
        vols = [float(k[5]) for k in klines]
        if len(vols) < 2: return None
        avg = sum(vols[:-1]) / len(vols[:-1])
        return vols[-1] / avg if avg > 0 else None
    except: return None

def calc_adx(klines, period=14):
    try:
        if len(klines) < period + 1: return None
        H = [float(k[2]) for k in klines]
        L = [float(k[3]) for k in klines]
        C = [float(k[4]) for k in klines]
        tr_l, pdm_l, ndm_l = [], [], []
        for i in range(1, len(klines)):
            tr  = max(H[i]-L[i], abs(H[i]-C[i-1]), abs(L[i]-C[i-1]))
            pdm = max(H[i]-H[i-1], 0) if H[i]-H[i-1] > L[i-1]-L[i] else 0
            ndm = max(L[i-1]-L[i], 0) if L[i-1]-L[i] > H[i]-H[i-1] else 0
            tr_l.append(tr); pdm_l.append(pdm); ndm_l.append(ndm)
        def smooth(lst):
            s = sum(lst[:period]); res = [s]
            for v in lst[period:]: s = s - s/period + v; res.append(s)
            return res
        at = smooth(tr_l); pd = smooth(pdm_l); nd = smooth(ndm_l)
        dx = []
        for a, p, n in zip(at, pd, nd):
            if a == 0: continue
            pi = 100*p/a; ni = 100*n/a
            dx.append(100*abs(pi-ni)/(pi+ni) if (pi+ni) != 0 else 0)
        return sum(dx[-period:]) / period if dx else None
    except: return None


# ─── Scenario classifier ──────────────────────────────────────────────────────

SCENARIO_NAMES = {
    1:"Strong bull trend", 2:"Strong bear trend", 3:"Weak rally",
    4:"Weak sell-off",     5:"Bull trap",         6:"Bear trap",
    7:"Long squeeze",      8:"Short squeeze",     9:"Coil / buildup", 10:"Disinterest",
}

SCENARIO_DIRECTION = {
    1:"long", 2:"short", 3:"short", 4:"long",
    5:"short", 6:"long",  7:"short", 8:"long",
    9:None,   10:None,
}

def classify(pc, oi, vol, fr):
    up = pc > 1.5; dn = pc < -1.5; fl = not up and not dn
    oiU = oi  is not None and oi  >  3;  oiD = oi  is not None and oi  < -3
    vH  = vol is not None and vol >  1.5; vL  = vol is not None and vol <  0.7
    fhP = fr  is not None and fr  >  0.0008; fhN = fr is not None and fr < -0.0008
    fxP = fr  is not None and fr  >  0.002;  fxN = fr is not None and fr < -0.002
    if up and oiU and vH and not fxP: return 1
    if dn and oiU and vH and not fxN: return 2
    if up and oiD and vL and fhP:     return 3
    if dn and oiD and vL and fhN:     return 4
    if up and not oiU and vL and fhP: return 5
    if dn and not oiU and vL and fhN: return 6
    if up and oiU and fxP:            return 7
    if dn and oiU and fxN:            return 8
    if fl and oiU:                    return 9
    return 10


# ─── Gate-based ranker ────────────────────────────────────────────────────────

def assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg=None):
    if scenario == 10: return None
    if scenario == 9:  return 'C'
    direction = SCENARIO_DIRECTION.get(scenario)
    if not direction: return None
    fr = fr or 0; oi = oi_chg or 0; vol = vol_ratio or 0; adx_v = adx or 0
    fr_opp = (direction == 'long' and fr > 0.002) or (direction == 'short' and fr < -0.002)
    bybit_ok = bybit_chg is not None and (
        (direction == 'long' and bybit_chg > 1.5) or
        (direction == 'short' and bybit_chg < -1.5)
    )
    if adx_v > 30 and abs(oi) > 8 and vol > 2.0 and bybit_ok:          return 'S'
    if adx_v > 22 and abs(oi) > 4 and vol > 1.5 and not fr_opp:        return 'A'
    if 1 <= scenario <= 8 and (abs(oi) > 2 or vol > 1.2) and not fr_opp: return 'B'
    return None


# ─── Trade setup builder ──────────────────────────────────────────────────────

def build_setup(direction, price, klines):
    try:
        atrs = []
        for i in range(1, min(15, len(klines))):
            h=float(klines[i][2]); l=float(klines[i][3]); pc=float(klines[i-1][4])
            atrs.append(max(h-l, abs(h-pc), abs(l-pc)))
        atr    = sum(atrs)/len(atrs) if atrs else price*0.02
        recent = klines[-10:]
        sH = max(float(k[2]) for k in recent)
        sL = min(float(k[3]) for k in recent)
        if direction == "long":
            el=price*0.999; eh=price*1.002
            sl=min(sL, price-1.5*atr); risk=max(el-sl, price*0.005)
            tp1=eh+risk*1.5; tp2=eh+risk*3; tp3=eh+risk*5
        else:
            el=price*0.998; eh=price*1.001
            sl=max(sH, price+1.5*atr); risk=max(sl-eh, price*0.005)
            tp1=el-risk*1.5; tp2=el-risk*3; tp3=el-risk*5
        rr  = round(abs(tp2-eh)/abs(sl-el), 2) if risk > 0 else 2.0
        pct = (atr/price)*100
        lev = 3 if pct>3 else 5 if pct>2 else 7 if pct>1 else 10
        return {"entry_low":el,"entry_high":eh,"stop_loss":sl,
                "tp1":tp1,"tp2":tp2,"tp3":tp3,"rr_ratio":rr,"suggested_leverage":lev}
    except:
        return {"entry_low":price,"entry_high":price,"stop_loss":price,
                "tp1":price,"tp2":price,"tp3":price,"rr_ratio":0,"suggested_leverage":3}


# ─── Config & status ──────────────────────────────────────────────────────────

def get_config():
    try:
        res = supabase.table("scanner_config").select("*").limit(1).execute()
        return res.data[0] if res.data else {}
    except: return {}

def update_status(status, count=0):
    try:
        supabase.table("scanner_config").update({
            "last_scan_at":            datetime.now(timezone.utc).isoformat(),
            "last_scan_status":        status,
            "signals_generated_today": count,
        }).eq("id", "00000000-0000-0000-0000-000000000001").execute()
    except Exception as e:
        print(f"  Could not update scanner status: {e}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def run():
    global PROXIES

    print(f"\n{'='*60}")
    print(f"IntelliCoin Scanner — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}\n")

    # Auto-fetch working proxy
    PROXIES = get_working_proxy()
    print()

    config      = get_config()
    enabled     = set(config.get("enabled_scenarios", list(range(1, 11))))
    blacklisted = set(config.get("blacklisted_symbols", []))

    print("Fetching all Binance USDT perpetual pairs...")
    symbols = get_all_symbols()
    print(f"Found {len(symbols)} pairs\n")

    created = 0

    for symbol in symbols:
        if symbol in blacklisted:
            continue
        try:
            ticker    = get_ticker(symbol)
            price     = sf(ticker.get("lastPrice"))
            price_chg = sf(ticker.get("priceChangePercent"))
            if not price or price_chg is None: continue

            klines    = get_klines(symbol)
            oi_hist   = get_oi_history(symbol)
            fr        = get_funding(symbol)
            oi_chg    = calc_oi_change(oi_hist)
            vol_ratio = calc_volume_ratio(klines)
            adx       = calc_adx(klines)

            scenario  = classify(price_chg, oi_chg, vol_ratio, fr)
            if scenario not in enabled or scenario == 10: continue

            direction = SCENARIO_DIRECTION.get(scenario)
            bybit     = get_bybit_ticker(symbol)
            bybit_chg = bybit["price_chg_pct"] if bybit else None
            rank      = assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg)
            if not rank: continue

            setup = build_setup(direction, price, klines) if direction else {
                "entry_low":price,"entry_high":price,"stop_loss":price,
                "tp1":price,"tp2":price,"tp3":price,"rr_ratio":0,"suggested_leverage":0,
            }

            row = {
                "symbol":             symbol,
                "scenario_id":        scenario,
                "scenario_name":      SCENARIO_NAMES[scenario],
                "direction":          direction or "watch",
                "signal_rank":        rank,
                "price_at_signal":    price,
                "oi_change_pct":      round(oi_chg,   4) if oi_chg    else None,
                "fr_at_signal":       round(fr,        8) if fr        else None,
                "volume_ratio":       round(vol_ratio, 4) if vol_ratio else None,
                "adx_value":          round(adx,       2) if adx       else None,
                "confirmed_bybit":    bool(bybit_chg is not None and abs(bybit_chg) > 1),
                "confirmed_okx":      False,
                **setup,
            }

            res = supabase.table("signals").insert(row).execute()
            if res.data:
                created += 1
                oi_str  = f"OI:{oi_chg:+.1f}%" if oi_chg else "OI:—"
                adx_str = f"ADX:{adx:.0f}"      if adx    else "ADX:—"
                print(f"  ✓ {symbol:22} S{scenario} {(direction or 'watch'):5} Rank {rank}  {oi_str}  {adx_str}")

        except Exception as e:
            print(f"  ✗ {symbol}: {e}")
            continue

    update_status(f"ok — {created} signals", created)
    print(f"\n{'='*60}")
    print(f"Done. {created} signals generated.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    run()
