"""
IntelliCoin Outcome Tracker
Checks every active signal and marks TP1/TP2/TP3/SL/Expired
"""
import os, requests, time
from datetime import datetime, timezone
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_price(symbol):
    try:
        r = requests.get("https://fapi.binance.com/fapi/v1/ticker/price",
                         params={"symbol":symbol}, timeout=5)
        return float(r.json()["price"])
    except: return None

def run():
    print("\n--- Outcome Tracker ---")
    res = supabase.table("signals").select("*").eq("status","active").execute()
    active = res.data or []
    print(f"Checking {len(active)} active signals…")

    for s in active:
        symbol    = s["symbol"]
        direction = s["direction"]
        sl        = float(s["stop_loss"])
        tp1       = float(s["tp1"])
        tp2       = float(s.get("tp2") or tp1)
        tp3       = float(s.get("tp3") or tp2)
        entry     = float(s["entry_low"])
        created   = datetime.fromisoformat(s["created_at"].replace("Z","+00:00"))
        age_h     = (datetime.now(timezone.utc) - created).total_seconds() / 3600

        if age_h > 24:
            supabase.table("signals").update({"status":"expired"}).eq("id",s["id"]).execute()
            supabase.table("signal_outcomes").insert({
                "signal_id":s["id"], "outcome":"expired",
                "duration_minutes":int(age_h*60)
            }).execute()
            print(f"  Expired: {symbol}")
            continue

        price = get_price(symbol)
        if not price: continue
        time.sleep(0.04)

        outcome = None
        if direction == "long":
            if price <= sl:    outcome = "stop_hit"
            elif price >= tp3: outcome = "tp3_hit"
            elif price >= tp2: outcome = "tp2_hit"
            elif price >= tp1: outcome = "tp1_hit"
        elif direction == "short":
            if price >= sl:    outcome = "stop_hit"
            elif price <= tp3: outcome = "tp3_hit"
            elif price <= tp2: outcome = "tp2_hit"
            elif price <= tp1: outcome = "tp1_hit"

        if outcome:
            pnl = ((price-entry)/entry*100) if direction=="long" else ((entry-price)/entry*100)
            rr  = float(s.get("rr_ratio") or 0)
            supabase.table("signals").update({"status":outcome}).eq("id",s["id"]).execute()
            supabase.table("signal_outcomes").insert({
                "signal_id":     s["id"],
                "outcome":       outcome,
                "exit_price":    price,
                "pnl_pct":       round(pnl,4),
                "rr_achieved":   rr if "tp" in outcome else (round(-1/rr,2) if rr else 0),
                "duration_minutes": int(age_h*60),
            }).execute()
            print(f"  {outcome:12} {symbol:20} pnl={pnl:+.2f}%")

    print("Outcome check complete.\n")

if __name__ == "__main__":
    run()
