const STEPS = [
  { t: "Paste", d: "Any Pine indicator or strategy — we read it back in plain English.", icon: <path className="st" d="M7 8l-4 4 4 4M17 8l4 4-4 4M13 6l-2 12" /> },
  { t: "Configure", d: "Exchange, timeframe, and only the filters you choose.", icon: <path className="st" d="M4 6h16M7 12h10M10 18h4" /> },
  { t: "Scan", d: "Run it across the market; tap any coin for the full read.", icon: <><circle className="st" cx="11" cy="11" r="6" /><path className="st" d="M15.5 15.5L20 20" /></> },
];

export default function HowItWorks() {
  return (
    <section id="how" className="how">
      {STEPS.map((s) => (
        <div key={s.t} className="step">
          <span className="gi"><svg viewBox="0 0 24 24">{s.icon}</svg></span>
          <h4>{s.t}</h4>
          <p>{s.d}</p>
        </div>
      ))}
    </section>
  );
}
