"""
IntelliCoin Scanner
Gate-based ranking: S / A / B / C / Rejected
Runs every hour via GitHub Actions at :05 past
"""
import os, time, requests
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)
BASE         = "https://fapi.binance.com"

# ─── helpers ──────────────────────────────────────────────────────────────────

def get(path, params={}):
    r = requests.get(f"{BASE}{path}", params=params, timeout=10)
    r.raise_for_status()
    time.sleep(0.04)
    return r.json()

def sf(v):
    try: return float(v)
    except: return None

# ─── data fetchers ─────────────────────────────────────────────────────────────

def get_all_symbols():
    info = get("/fapi/v1/exchangeInfo")
    return [s["symbol"] for s in info["symbols"]
            if s["quoteAsset"]=="USDT" and s["contractType"]=="PERPETUAL" and s["status"]=="TRADING"]

def get_ticker(symbol):
    return get("/fapi/v1/ticker/24hr", {"symbol": symbol})

def get_klines(symbol, limit=26):
    try: return get("/fapi/v1/klines", {"symbol":symbol,"interval":"1h","limit":limit})
    except: return []

def get_oi_history(symbol):
    try: return get("/futures/data/openInterestHist", {"symbol":symbol,"period":"1h","limit":6})
    except: return []

def get_funding(symbol):
    try:
        d = get("/fapi/v1/fundingRate", {"symbol":symbol,"limit":1})
        return sf(d[0]["fundingRate"]) if d else None
    except: return None

def get_bybit_ticker(symbol):
    """Check if same signal exists on Bybit for cross-exchange confirm"""
    try:
        r = requests.get(f"https://api.bybit.com/v5/market/tickers",
                         params={"category":"linear","symbol":symbol}, timeout=5)
        data = r.json()
        if data.get("retCode") == 0 and data["result"]["list"]:
            t = data["result"]["list"][0]
            return {"price_chg_pct": sf(t.get("price24hPcnt","0")) * 100}
        return None
    except: return None

# ─── indicator calculations ────────────────────────────────────────────────────

def calc_oi_change(oi_hist):
    try:
        if len(oi_hist) < 2: return None
        old = float(oi_hist[0]["sumOpenInterest"])
        new = float(oi_hist[-1]["sumOpenInterest"])
        return ((new-old)/old*100) if old > 0 else None
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
        if len(klines) < period+1: return None
        highs  = [float(k[2]) for k in klines]
        lows   = [float(k[3]) for k in klines]
        closes = [float(k[4]) for k in klines]
        tr_l,pdm_l,ndm_l = [],[],[]
        for i in range(1,len(klines)):
            tr  = max(highs[i]-lows[i], abs(highs[i]-closes[i-1]), abs(lows[i]-closes[i-1]))
            pdm = max(highs[i]-highs[i-1],0) if highs[i]-highs[i-1]>lows[i-1]-lows[i] else 0
            ndm = max(lows[i-1]-lows[i],0)   if lows[i-1]-lows[i]>highs[i]-highs[i-1]  else 0
            tr_l.append(tr); pdm_l.append(pdm); ndm_l.append(ndm)
        def smooth(lst):
            s = sum(lst[:period]); res=[s]
            for v in lst[period:]: s=s-s/period+v; res.append(s)
            return res
        atr_s=smooth(tr_l); pdm_s=smooth(pdm_l); ndm_s=smooth(ndm_l)
        dx_l=[]
        for a,p,n in zip(atr_s,pdm_s,ndm_s):
            if a==0: continue
            pdi=100*p/a; ndi=100*n/a
            dx=100*abs(pdi-ndi)/(pdi+ndi) if (pdi+ndi)!=0 else 0
            dx_l.append(dx)
        return sum(dx_l[-period:])/period if dx_l else None
    except: return None

def calc_rsi(klines, period=14):
    try:
        closes = [float(k[4]) for k in klines]
        if len(closes) < period+1: return None
        gains,losses = [],[]
        for i in range(1,len(closes)):
            diff = closes[i]-closes[i-1]
            gains.append(max(diff,0)); losses.append(max(-diff,0))
        avg_g = sum(gains[:period])/period
        avg_l = sum(losses[:period])/period
        for i in range(period,len(gains)):
            avg_g = (avg_g*(period-1)+gains[i])/period
            avg_l = (avg_l*(period-1)+losses[i])/period
        if avg_l == 0: return 100
        return 100 - 100/(1+avg_g/avg_l)
    except: return None

# ─── scenario classifier ───────────────────────────────────────────────────────

SCENARIO_NAMES = {
    1:"Strong bull trend", 2:"Strong bear trend", 3:"Weak rally",
    4:"Weak sell-off",     5:"Bull trap",         6:"Bear trap",
    7:"Long squeeze",      8:"Short squeeze",     9:"Coil / buildup", 10:"Disinterest"
}

SCENARIO_DIRECTION = {
    1:"long", 2:"short", 3:"short", 4:"long",
    5:"short", 6:"long",  7:"short", 8:"long", 9:None, 10:None
}

def classify(price_chg, oi_chg, vol_ratio, fr):
    up   = price_chg >  1.5
    down = price_chg < -1.5
    flat = not up and not down

    oi_up   = oi_chg is not None and oi_chg >  3
    oi_down = oi_chg is not None and oi_chg < -3

    vol_hi  = vol_ratio is not None and vol_ratio > 1.5
    vol_lo  = vol_ratio is not None and vol_ratio < 0.7

    fr_hi_p  = fr is not None and fr >  0.0008
    fr_hi_n  = fr is not None and fr < -0.0008
    fr_ex_p  = fr is not None and fr >  0.002
    fr_ex_n  = fr is not None and fr < -0.002

    if up   and oi_up   and vol_hi  and not fr_ex_p: return 1  # Strong bull
    if down and oi_up   and vol_hi  and not fr_ex_n: return 2  # Strong bear
    if up   and oi_down and vol_lo  and fr_hi_p:     return 3  # Weak rally
    if down and oi_down and vol_lo  and fr_hi_n:     return 4  # Weak selloff
    if up   and not oi_up and vol_lo and fr_hi_p:    return 5  # Bull trap
    if down and not oi_up and vol_lo and fr_hi_n:    return 6  # Bear trap
    if up   and oi_up   and fr_ex_p:                 return 7  # Long squeeze
    if down and oi_up   and fr_ex_n:                 return 8  # Short squeeze
    if flat and oi_up:                               return 9  # Coil
    return 10

# ─── gate-based ranker ─────────────────────────────────────────────────────────

def assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg=None):
    """
    Returns 'S', 'A', 'B', 'C', or None (rejected)

    RANK S — all 3 gates:
      Gate 1: ADX > 30
      Gate 2: OI change > 8% AND volume ratio > 2.0
      Gate 3: Same signal direction confirmed on Bybit

    RANK A — all 3 gates:
      Gate 1: ADX > 22
      Gate 2: OI change > 4% AND volume ratio > 1.5
      Gate 3: FR direction matches signal (not opposing)

    RANK B — all 3 gates:
      Gate 1: Scenario 1-8 confirmed
      Gate 2: OI change > 2% OR volume ratio > 1.2
      Gate 3: No active disqualifier (FR not opposing signal)

    RANK C — scenario 9 only (coil watchlist)

    REJECTED — scenario 10 or fails Rank B Gate 1
    """
    direction = SCENARIO_DIRECTION.get(scenario)

    if scenario == 10:
        return None  # always reject

    if scenario == 9:
        return 'C'  # coil — watchlist only

    if direction is None:
        return None

    fr = fr or 0
    oi = oi_chg or 0
    vol = vol_ratio or 0
    adx_v = adx or 0

    # FR alignment check
    fr_opposing = (direction == 'long'  and fr > 0.002) or \
                  (direction == 'short' and fr < -0.002)

    # Bybit cross-confirm
    bybit_confirms = False
    if bybit_chg is not None:
        bybit_up   = bybit_chg > 1.5
        bybit_down = bybit_chg < -1.5
        bybit_confirms = (direction == 'long' and bybit_up) or \
                         (direction == 'short' and bybit_down)

    # ── RANK S ──
    g1 = adx_v > 30
    g2 = abs(oi) > 8 and vol > 2.0
    g3 = bybit_confirms
    if g1 and g2 and g3:
        return 'S'

    # ── RANK A ──
    g1 = adx_v > 22
    g2 = abs(oi) > 4 and vol > 1.5
    g3 = not fr_opposing
    if g1 and g2 and g3:
        return 'A'

    # ── RANK B ──
    g1 = scenario in range(1, 9)
    g2 = abs(oi) > 2 or vol > 1.2
    g3 = not fr_opposing
    if g1 and g2 and g3:
        return 'B'

    return None  # rejected

# ─── trade setup builder ───────────────────────────────────────────────────────

def build_setup(direction, price, klines):
    try:
        atrs = []
        for i in range(1, min(15, len(klines))):
            h=float(klines[i][2]); l=float(klines[i][3]); pc=float(klines[i-1][4])
            atrs.append(max(h-l, abs(h-pc), abs(l-pc)))
        atr = sum(atrs)/len(atrs) if atrs else price*0.02
        recent = klines[-10:]
        swing_h = max(float(k[2]) for k in recent)
        swing_l = min(float(k[3]) for k in recent)

        if direction == "long":
            el = round(price*0.999, 8)
            eh = round(price*1.002, 8)
            sl = round(min(swing_l, price-1.5*atr), 8)
            risk = max(el-sl, price*0.005)
            tp1 = round(eh+risk*1.5, 8)
            tp2 = round(eh+risk*3.0, 8)
            tp3 = round(eh+risk*5.0, 8)
        else:
            el = round(price*0.998, 8)
            eh = round(price*1.001, 8)
            sl = round(max(swing_h, price+1.5*atr), 8)
            risk = max(sl-eh, price*0.005)
            tp1 = round(el-risk*1.5, 8)
            tp2 = round(el-risk*3.0, 8)
            tp3 = round(el-risk*5.0, 8)

        rr = round(abs(tp2-eh)/abs(sl-el), 2) if risk > 0 else 2.0
        atr_pct = (atr/price)*100
        lev = 3 if atr_pct>3 else 5 if atr_pct>2 else 7 if atr_pct>1 else 10

        return {
            "entry_low":price, "entry_high":eh,
            "stop_loss":sl, "tp1":tp1, "tp2":tp2, "tp3":tp3,
            "rr_ratio":rr, "suggested_leverage":lev
        }
    except:
        return {
            "entry_low":price,"entry_high":price,"stop_loss":price,
            "tp1":price,"tp2":price,"tp3":price,"rr_ratio":0,"suggested_leverage":3
        }

# ─── config & status ───────────────────────────────────────────────────────────

def get_config():
    res = supabase.table("scanner_config").select("*").limit(1).execute()
    return res.data[0] if res.data else {
        "scanner_enabled": True,
        "enabled_scenarios": list(range(1,11)),
        "blacklisted_symbols": [],
        "min_rank_to_broadcast": "SA",
    }

def update_status(status, count=0):
    supabase.table("scanner_config").update({
        "last_scan_at": datetime.now(timezone.utc).isoformat(),
        "last_scan_status": status,
        "signals_generated_today": count,
    }).eq("id","00000000-0000-0000-0000-000000000001").execute()

# ─── main ──────────────────────────────────────────────────────────────────────

def run():
    print(f"\n{'='*60}")
    print(f"IntelliCoin Scanner — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}\n")

    config      = get_config()
    enabled     = set(config.get("enabled_scenarios", list(range(1,11))))
    blacklisted = set(config.get("blacklisted_symbols", []))

    symbols = get_all_symbols()
    print(f"Scanning {len(symbols)} pairs...\n")
    created = 0

    for symbol in symbols:
        if symbol in blacklisted:
            continue
        try:
            ticker     = get_ticker(symbol)
            price      = sf(ticker.get("lastPrice"))
            price_chg  = sf(ticker.get("priceChangePercent"))
            if not price or price_chg is None: continue

            klines     = get_klines(symbol)
            oi_hist    = get_oi_history(symbol)
            fr         = get_funding(symbol)
            oi_chg     = calc_oi_change(oi_hist)
            vol_ratio  = calc_volume_ratio(klines)
            adx        = calc_adx(klines)

            scenario   = classify(price_chg, oi_chg, vol_ratio, fr)

            if scenario not in enabled:
                continue
            if scenario == 10:
                continue

            direction  = SCENARIO_DIRECTION.get(scenario)

            # Cross-exchange check for Rank S potential
            bybit = get_bybit_ticker(symbol)
            bybit_chg = bybit["price_chg_pct"] if bybit else None

            rank = assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg)

            if rank is None:
                continue  # rejected by gates

            setup = build_setup(direction, price, klines) if direction else {
                "entry_low":price,"entry_high":price,"stop_loss":price,
                "tp1":price,"tp2":price,"tp3":price,"rr_ratio":0,"suggested_leverage":0
            }

            row = {
                "symbol":          symbol,
                "scenario_id":     scenario,
                "scenario_name":   SCENARIO_NAMES[scenario],
                "direction":       direction or "watch",
                "signal_rank":     rank,
                "price_at_signal": price,
                "oi_change_pct":   round(oi_chg,4)    if oi_chg   else None,
                "fr_at_signal":    round(fr,8)         if fr       else None,
                "volume_ratio":    round(vol_ratio,4)  if vol_ratio else None,
                "adx_value":       round(adx,2)        if adx      else None,
                "confirmed_bybit": bool(bybit_chg is not None and abs(bybit_chg) > 1),
                **setup,
            }

            res = supabase.table("signals").insert(row).execute()
            if res.data:
                created += 1
                print(f"  {'✓':2} {symbol:22} S{scenario} {(direction or 'watch'):5} Rank {rank}  OI:{oi_chg:+.1f}%  ADX:{adx:.0f}" if oi_chg and adx else f"  ✓ {symbol} S{scenario} Rank {rank}")

        except Exception as e:
            print(f"  ✗ {symbol}: {e}")
            continue

    update_status(f"ok — {created} signals", created)
    print(f"\n{'='*60}")
    print(f"Done. {created} signals generated.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    run()
