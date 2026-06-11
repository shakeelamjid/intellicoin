import CoinView from "@/components/CoinView";

type Params = { params: Promise<{ symbol: string }>; searchParams: Promise<{ tf?: string; bias?: string }> };

export default async function CoinPage({ params, searchParams }: Params) {
  const { symbol } = await params;
  const sp = await searchParams;
  return <CoinView symbol={symbol} tf={sp.tf || "4h"} bias={(sp.bias as "long" | "short") || "long"} />;
}
