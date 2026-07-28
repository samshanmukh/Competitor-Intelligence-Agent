'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LabelList,
} from 'recharts';
import { companyLogoUrl } from '../lib/companyLogo';
import { buildPositioningMapPoints } from '../lib/positioningMapData';

const TIP_STYLE = { background: '#0e1014', border: '1px solid #181c24', borderRadius: 8, fontSize: 12 };
const AXIS = { fill: '#64748b', fontSize: 11 };
const YOU_COLOR = '#f472b6';
const CHART_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#a78bfa', '#f97316'];

function truncateLabel(name, max = 16) {
  const s = String(name || '').replace(/\s*\(you\)\s*$/i, '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function mapDomains(points, unpricedX) {
  const known = points.filter((d) => !d.priceUnknown).map((d) => d.price).filter((p) => p > 0);
  const values = points.map((d) => d.value).filter((v) => v != null);
  if (!values.length) return { x: [0, Math.ceil(unpricedX * 1.08)], y: [0, 10] };

  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const vPad = Math.max(0.4, (vMax - vMin) * 0.12 || 0.5);

  if (!known.length) {
    return {
      x: [0, Math.ceil(unpricedX * 1.08)],
      y: [Math.max(0, vMin - vPad), Math.min(10, vMax + vPad)],
    };
  }

  const pMin = Math.min(...known);
  const pMax = Math.max(...known, unpricedX);
  const pPad = Math.max(8, (pMax - pMin) * 0.12 || pMax * 0.08);

  return {
    x: [Math.max(0, Math.floor(pMin - pPad)), Math.ceil(pMax + pPad)],
    y: [Math.max(0, vMin - vPad), Math.min(10, vMax + vPad)],
  };
}

function spreadMapPoints(points) {
  const buckets = new Map();
  for (const p of points) {
    const key = `${p.price?.toFixed(1)}|${p.value?.toFixed(2)}|${p.priceUnknown ? 'u' : 'k'}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }
  const out = [];
  for (const group of buckets.values()) {
    group.forEach((p, i) => {
      if (group.length === 1) {
        out.push({ ...p, labelIndex: out.length });
        return;
      }
      const angle = (2 * Math.PI * i) / group.length;
      const priceSpread = Math.max((p.price || 50) * 0.04, 4);
      out.push({
        ...p,
        price: p.price + Math.cos(angle) * priceSpread,
        value: Math.min(10, Math.max(0, p.value + Math.sin(angle) * 0.35)),
        labelIndex: out.length,
      });
    });
  }
  return out;
}

const LABEL_OFFSETS = [
  { dx: 0, dy: -14, anchor: 'middle' },
  { dx: 0, dy: 20, anchor: 'middle' },
  { dx: 12, dy: 4, anchor: 'start' },
  { dx: -12, dy: 4, anchor: 'end' },
  { dx: 16, dy: -10, anchor: 'start' },
  { dx: -16, dy: -10, anchor: 'end' },
];

function MapPointLabel({ x, y, payload }) {
  if (x == null || y == null || !payload) return null;
  const idx = payload.labelIndex ?? 0;
  const off = LABEL_OFFSETS[idx % LABEL_OFFSETS.length];
  const isYou = payload.isYou;
  const muted = Boolean(payload.priceUnknown);
  const label = truncateLabel(payload.shortName || payload.name, isYou ? 14 : 16);
  return (
    <text
      x={x + off.dx}
      y={y + off.dy}
      fill={isYou ? YOU_COLOR : (muted ? '#94a3b8' : '#cbd5e1')}
      fontSize={isYou ? 11 : 10}
      fontWeight={isYou ? 700 : 400}
      textAnchor={off.anchor}
      opacity={muted ? 0.75 : 1}
    >
      {label}{isYou ? ' (you)' : ''}
    </text>
  );
}

function MapLogoShape(props) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const isYou = Boolean(payload.isYou);
  const priceUnknown = Boolean(payload.priceUnknown);
  const size = isYou ? 30 : 26;
  const letter = String(payload.shortName || payload.name || '?').trim().charAt(0).toUpperCase() || '?';
  const stroke = isYou ? YOU_COLOR : (payload.color || '#64748b');
  const hasLogo = Boolean(payload.logoUrl);

  return (
    <g style={{ cursor: 'pointer', opacity: priceUnknown ? 0.55 : 1 }}>
      <circle cx={cx} cy={cy} r={size / 2 + 8} fill="transparent" />
      {priceUnknown && (
        <circle
          cx={cx}
          cy={cy}
          r={size / 2 + 5}
          fill="none"
          stroke={stroke}
          strokeWidth={1.25}
          strokeDasharray="3 3"
          opacity={0.7}
        />
      )}
      {hasLogo ? (
        <image
          href={payload.logoUrl}
          xlinkHref={payload.logoUrl}
          x={cx - size / 2}
          y={cy - size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: 'none' }}
        />
      ) : (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={size / 2 + 2}
            fill="#0e1014"
            stroke={stroke}
            strokeWidth={isYou ? 2 : 1.5}
            strokeDasharray={priceUnknown ? '4 3' : undefined}
          />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={12}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {letter}
          </text>
        </>
      )}
    </g>
  );
}

function MapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TIP_STYLE} className="px-3 py-2 text-xs text-slate-200">
      <div className="flex items-center gap-2">
        {d.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logoUrl} alt="" className="h-5 w-5 object-contain" referrerPolicy="no-referrer" />
        ) : (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-800 text-[10px] font-bold text-slate-300"
            style={{ boxShadow: `inset 0 0 0 1px ${d.isYou ? YOU_COLOR : d.color}` }}
          >
            {String(d.shortName || d.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <p className="font-semibold text-white">{d.name}</p>
      </div>
      <p className="mt-1 text-slate-400">
        Value: {d.value ?? '-'}/10{d.valueEstimated ? ' (est.)' : ''}
      </p>
      <p className="text-slate-400">
        Entry:{' '}
        {d.priceUnknown || d.rawPrice == null
          ? <span className="text-slate-500">Price unknown</span>
          : `$${Math.round(d.rawPrice)}/mo`}
      </p>
    </div>
  );
}

/**
 * @param {{ you?: object, rivals?: object[], title?: string, hint?: string }} props
 * you/rivals: { name, website, pricing_url, entry_price, value_score, isYou? }
 */
export default function PositioningMapChart({
  you,
  rivals = [],
  title = 'Positioning map',
  hint = 'Entry price vs. value, top-left is best value. Muted markers = price not found yet.',
}) {
  const { points, unpricedX, knownCount } = buildPositioningMapPoints(you, rivals);
  const rows = points.map((d, i) => ({
    ...d,
    color: d.isYou ? YOU_COLOR : CHART_COLORS[i % CHART_COLORS.length],
    logoUrl: companyLogoUrl({ website: d.website, pricing_url: d.pricing_url }),
  }));

  let mapData = spreadMapPoints(rows.map((d, i) => ({ ...d, labelIndex: i })));
  const domains = mapDomains(mapData.length ? mapData : [{ price: 50, value: 5 }], unpricedX);
  const knownForAvg = mapData.filter((d) => !d.priceUnknown);
  const avgPrice = knownForAvg.length
    ? knownForAvg.reduce((s, d) => s + d.price, 0) / knownForAvg.length
    : null;
  const hasUnpriced = mapData.some((d) => d.priceUnknown);

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/80 p-4 text-left">
      <p className="text-sm font-semibold text-white">{title}</p>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      {mapData.length >= 1 ? (
        <>
          <ResponsiveContainer width="100%" height={mapData.length >= 2 ? 320 : 240}>
            <ScatterChart margin={{ top: 28, right: 24, bottom: 28, left: 8 }}>
              <CartesianGrid stroke="#181c24" />
              <XAxis
                type="number"
                dataKey="price"
                name="Entry price"
                domain={domains.x}
                tick={AXIS}
                tickFormatter={(v) => {
                  if (hasUnpriced && Math.abs(v - unpricedX) <= Math.max(1, unpricedX * 0.02)) {
                    return 'n/a';
                  }
                  return `$${Math.round(v)}`;
                }}
                label={{ value: 'Entry price ($/mo)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="value"
                name="Value"
                domain={domains.y}
                tick={AXIS}
                label={{ value: 'Value score', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
              />
              <ZAxis range={[200, 200]} />
              {avgPrice != null && domains.x[0] <= avgPrice && avgPrice <= domains.x[1] && (
                <ReferenceLine x={avgPrice} stroke="#2c3340" strokeDasharray="4 4" />
              )}
              {hasUnpriced && knownCount > 0 && (
                <ReferenceLine
                  x={unpricedX}
                  stroke="#475569"
                  strokeDasharray="2 4"
                  label={{ value: 'Unpriced', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
                />
              )}
              <Tooltip content={<MapTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={mapData} shape={<MapLogoShape />}>
                <LabelList dataKey="name" content={<MapPointLabel />} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-3">
            {mapData.map((d) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"
                style={{ opacity: d.priceUnknown ? 0.65 : 1 }}
              >
                {d.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.logoUrl} alt="" className="h-4 w-4 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink-800 text-[9px] font-bold text-slate-300"
                    style={{
                      boxShadow: `0 0 0 1.5px ${d.isYou ? YOU_COLOR : '#2c3340'}`,
                      borderStyle: d.priceUnknown ? 'dashed' : undefined,
                    }}
                  >
                    {String(d.shortName || d.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
                {truncateLabel(d.shortName || d.name, 22)}
                {d.isYou && <span className="text-accent-soft">(you)</span>}
                {d.priceUnknown && <span className="text-slate-600">· no price</span>}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-slate-500">
          Need competitors to plot the map.
        </div>
      )}
    </div>
  );
}
