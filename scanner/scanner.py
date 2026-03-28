"""
IntelliCoin Scanner
Gate-based ranking: S / A / B / C / Rejected
Runs every hour via GitHub Actions at :05 past
Uses multiple Binance endpoints to bypass US IP restrictions
"""
import os, time, requests
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

# Multiple Binance endpoints — tries each until one works (bypasses 451 US block)
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

# ─── helpers ──────────────────────────────────────────────────────────────────

def get(path, params={}):
    """Try multiple Binance endpoints until one works."""
    last_error = None
    for base in BINANCE_ENDPOINTS:
        try:
            r = requests.get(
                f"{base}{path}",
                params=params,
                timeout=10,
                headers=HEADERS,
            )
            if r.status_code == 451:
                last_error = f"451 blocked on {base}"
                continue
            r.raise_for_status()
            time.sleep(0.04)
            return r.json()
        except requests.exceptions.HTTPError as e:
            if "451" in str(e):
                last_error = f"451 blocked on {base}"
                continue
            raise e
        except Exception as e:
            last_error = str(e)
            continue
    raise Exception(f"All Binance endpoints failed. Last error: {last_error}")


def sf(v):
    try: return float(v)
    except: return None


# ─── data fetchers ─────────────────────────────────────────────────────────────

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
    try:
        return get("/fapi/v1/klines", {"symbol": symbol, "interval": "1h", "limit": limit})
    except:
        return []


def get_oi_history(symbol):
    try:
        return get("/futures/data/openInterestHist", {"symbol": symbol, "period": "1h", "limit": 6})
    except:
        return []


def get_funding(symbol):
    try:
        d = get("/fapi/v1/fundingRate", {"symbol": symbol, "limit": 1})
        return sf(d[0]["fundingRate"]) if d else None
    except:
        return None


def get_bybit_ticker(symbol):
    """Check Bybit for cross-exchange confirmation."""
    try:
        r = requests.get(
            "https://api.bybit.com/v5/market/tickers",
            params={"category": "linear", "symbol": symbol},
            timeout=5,
            headers=HEADERS,
        )
        data = r.json()
        if data.get("retCode") == 0 and data["result"]["list"]:
            t = data["result"]["list"][0]
            chg = sf(t.get("price24hPcnt", "0"))
            return {"price_chg_pct": (chg or 0) * 100}
        return None
    except:
        return None


# ─── indicator calculations ────────────────────────────────────────────────────

def calc_oi_change(oi_hist):
    try:
        if len(oi_hist) < 2: return None
        old = float(oi_hist[0]["sumOpenInterest"])
        new = float(oi_hist[-1]["sumOpenInterest"])
        return ((new - old) / old * 100) if old > 0 else None
    except:
        return None


def calc_volume_ratio(klines):
    try:
        vols = [float(k[5]) for k in klines]
        if len(vols) < 2: return None
        avg = sum(vols[:-1]) / len(vols[:-1])
        return vols[-1] / avg if avg > 0 else None
    except:
        return None


def calc_adx(klines, period=14):
    try:
        if len(klines) < period + 1: return None
        highs  = [float(k[2]) for k in klines]
        lows   = [float(k[3]) for k in klines]
        closes = [float(k[4]) for k in klines]
        tr_l, pdm_l, ndm_l = [], [], []
        for i in range(1, len(klines)):
            tr  = max(highs[i]-lows[i], abs(highs[i]-closes[i-1]), abs(lows[i]-closes[i-1]))
            pdm = max(highs[i]-highs[i-1], 0) if highs[i]-highs[i-1] > lows[i-1]-lows[i] else 0
            ndm = max(lows[i-1]-lows[i], 0)   if lows[i-1]-lows[i] > highs[i]-highs[i-1]  else 0
            tr_l.append(tr); pdm_l.append(pdm); ndm_l.append(ndm)

        def smooth(lst):
            s = sum(lst[:period])
            res = [s]
            for v in lst[period:]:
                s = s - s / period + v
                res.append(s)
            return res

        atr_s = smooth(tr_l)
        pdm_s = smooth(pdm_l)
        ndm_s = smooth(ndm_l)
        dx_l  = []
        for a, p, n in zip(atr_s, pdm_s, ndm_s):
            if a == 0: continue
            pdi = 100 * p / a
            ndi = 100 * n / a
            dx  = 100 * abs(pdi - ndi) / (pdi + ndi) if (pdi + ndi) != 0 else 0
            dx_l.append(dx)
        return sum(dx_l[-period:]) / period if dx_l else None
    except:
        return None


# ─── scenario classifier ───────────────────────────────────────────────────────

SCENARIO_NAMES = {
    1:  "Strong bull trend",
    2:  "Strong bear trend",
    3:  "Weak rally",
    4:  "Weak sell-off",
    5:  "Bull trap",
    6:  "Bear trap",
    7:  "Long squeeze",
    8:  "Short squeeze",
    9:  "Coil / buildup",
    10: "Disinterest",
}

SCENARIO_DIRECTION = {
    1: "long",  2: "short",
    3: "short", 4: "long",
    5: "short", 6: "long",
    7: "short", 8: "long",
    9: None,    10: None,
}


def classify(price_chg, oi_chg, vol_ratio, fr):
    up   = price_chg >  1.5
    down = price_chg < -1.5
    flat = not up and not down

    oi_up   = oi_chg is not None and oi_chg >  3
    oi_down = oi_chg is not None and oi_chg < -3

    vol_hi  = vol_ratio is not None and vol_ratio > 1.5
    vol_lo  = vol_ratio is not None and vol_ratio < 0.7

    fr_hi_p = fr is not None and fr >  0.0008
    fr_hi_n = fr is not None and fr < -0.0008
    fr_ex_p = fr is not None and fr >  0.002
    fr_ex_n = fr is not None and fr < -0.002

    if up   and oi_up   and vol_hi and not fr_ex_p: return 1
    if down and oi_up   and vol_hi and not fr_ex_n: return 2
    if up   and oi_down and vol_lo and fr_hi_p:     return 3
    if down and oi_down and vol_lo and fr_hi_n:     return 4
    if up   and not oi_up and vol_lo and fr_hi_p:   return 5
    if down and not oi_up and vol_lo and fr_hi_n:   return 6
    if up   and oi_up   and fr_ex_p:                return 7
    if down and oi_up   and fr_ex_n:                return 8
    if flat and oi_up:                              return 9
    return 10


# ─── gate-based ranker ─────────────────────────────────────────────────────────

def assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg=None):
    """
    RANK S: ADX>30 + OI>8% + Vol>2x + Bybit confirms
    RANK A: ADX>22 + OI>4% + Vol>1.5x + FR not opposing
    RANK B: Scenario 1-8 + (OI>2% OR Vol>1.2x) + FR not opposing
    RANK C: Scenario 9 (coil watchlist)
    None:   Rejected
    """
    if scenario == 10: return None
    if scenario == 9:  return 'C'

    direction = SCENARIO_DIRECTION.get(scenario)
    if direction is None: return None

    fr    = fr    or 0
    oi    = oi_chg or 0
    vol   = vol_ratio or 0
    adx_v = adx   or 0

    fr_opposing = (
        (direction == 'long'  and fr >  0.002) or
        (direction == 'short' and fr < -0.002)
    )

    bybit_confirms = False
    if bybit_chg is not None:
        bybit_confirms = (
            (direction == 'long'  and bybit_chg >  1.5) or
            (direction == 'short' and bybit_chg < -1.5)
        )

    # Rank S
    if adx_v > 30 and abs(oi) > 8 and vol > 2.0 and bybit_confirms:
        return 'S'

    # Rank A
    if adx_v > 22 and abs(oi) > 4 and vol > 1.5 and not fr_opposing:
        return 'A'

    # Rank B
    if scenario in range(1, 9) and (abs(oi) > 2 or vol > 1.2) and not fr_opposing:
        return 'B'

    return None


# ─── trade setup builder ───────────────────────────────────────────────────────

def build_setup(direction, price, klines):
    try:
        atrs = []
        for i in range(1, min(15, len(klines))):
            h  = float(klines[i][2])
            l  = float(klines[i][3])
            pc = float(klines[i-1][4])
            atrs.append(max(h-l, abs(h-pc), abs(l-pc)))
        atr = sum(atrs) / len(atrs) if atrs else price * 0.02

        recent  = klines[-10:]
        swing_h = max(float(k[2]) for k in recent)
        swing_l = min(float(k[3]) for k in recent)

        if direction == "long":
            el   = round(price * 0.999, 8)
            eh   = round(price * 1.002, 8)
            sl   = round(min(swing_l, price - 1.5 * atr), 8)
            risk = max(el - sl, price * 0.005)
            tp1  = round(eh + risk * 1.5, 8)
            tp2  = round(eh + risk * 3.0, 8)
            tp3  = round(eh + risk * 5.0, 8)
        else:
            el   = round(price * 0.998, 8)
            eh   = round(price * 1.001, 8)
            sl   = round(max(swing_h, price + 1.5 * atr), 8)
            risk = max(sl - eh, price * 0.005)
            tp1  = round(el - risk * 1.5, 8)
            tp2  = round(el - risk * 3.0, 8)
            tp3  = round(el - risk * 5.0, 8)

        rr      = round(abs(tp2 - eh) / abs(sl - el), 2) if risk > 0 else 2.0
        atr_pct = (atr / price) * 100
        lev     = 3 if atr_pct > 3 else 5 if atr_pct > 2 else 7 if atr_pct > 1 else 10

        return {
            "entry_low":         el,
            "entry_high":        eh,
            "stop_loss":         sl,
            "tp1":               tp1,
            "tp2":               tp2,
            "tp3":               tp3,
            "rr_ratio":          rr,
            "suggested_leverage": lev,
        }
    except:
        return {
            "entry_low": price, "entry_high": price,
            "stop_loss": price, "tp1": price,
            "tp2": price,       "tp3": price,
            "rr_ratio": 0,      "suggested_leverage": 3,
        }


# ─── config & status ───────────────────────────────────────────────────────────

def get_config():
    try:
        res = supabase.table("scanner_config").select("*").limit(1).execute()
        return res.data[0] if res.data else {}
    except:
        return {}


def update_status(status, count=0):
    try:
        supabase.table("scanner_config").update({
            "last_scan_at":            datetime.now(timezone.utc).isoformat(),
            "last_scan_status":        status,
            "signals_generated_today": count,
        }).eq("id", "00000000-0000-0000-0000-000000000001").execute()
    except Exception as e:
        print(f"  Could not update scanner status: {e}")


# ─── main ──────────────────────────────────────────────────────────────────────

def run():
    print(f"\n{'='*60}")
    print(f"IntelliCoin Scanner — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}\n")

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

            if not price or price_chg is None:
                continue

            klines    = get_klines(symbol)
            oi_hist   = get_oi_history(symbol)
            fr        = get_funding(symbol)
            oi_chg    = calc_oi_change(oi_hist)
            vol_ratio = calc_volume_ratio(klines)
            adx       = calc_adx(klines)

            scenario  = classify(price_chg, oi_chg, vol_ratio, fr)

            if scenario not in enabled:
                continue
            if scenario == 10:
                continue

            direction = SCENARIO_DIRECTION.get(scenario)

            # Bybit cross-confirm (for Rank S gate)
            bybit     = get_bybit_ticker(symbol)
            bybit_chg = bybit["price_chg_pct"] if bybit else None

            rank = assign_rank(scenario, adx, oi_chg, vol_ratio, fr, bybit_chg)

            if rank is None:
                continue  # rejected by gates

            setup = build_setup(direction, price, klines) if direction else {
                "entry_low": price, "entry_high": price,
                "stop_loss": price, "tp1": price,
                "tp2": price,       "tp3": price,
                "rr_ratio": 0,      "suggested_leverage": 0,
            }

            row = {
                "symbol":            symbol,
                "scenario_id":       scenario,
                "scenario_name":     SCENARIO_NAMES[scenario],
                "direction":         direction or "watch",
                "signal_rank":       rank,
                "price_at_signal":   price,
                "oi_change_pct":     round(oi_chg,    4) if oi_chg    else None,
                "fr_at_signal":      round(fr,         8) if fr        else None,
                "volume_ratio":      round(vol_ratio,  4) if vol_ratio else None,
                "adx_value":         round(adx,        2) if adx       else None,
                "confirmed_bybit":   bool(bybit_chg is not None and abs(bybit_chg) > 1),
                "confirmed_okx":     False,
                **setup,
            }

            res = supabase.table("signals").insert(row).execute()
            if res.data:
                created += 1
                oi_str  = f"OI:{oi_chg:+.1f}%" if oi_chg else "OI:—"
                adx_str = f"ADX:{adx:.0f}"       if adx    else "ADX:—"
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
