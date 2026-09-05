import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

interface WaveChartProps {
  title?: string;
  onOptimizeClick?: () => void;
  weeklyData?: { date: string; revenue: number; sales: number }[];
}

interface DataPoint {
  label: string;
  sublabel: string;
  robux: number;
  sales: number;
}

export function WaveChart({ title = "Receita & Desempenho", onOptimizeClick, weeklyData }: WaveChartProps) {
  const [metricType, setMetricType] = useState<"robux" | "vendas">("robux");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const currentData: DataPoint[] = useMemo(
    () =>
      (weeklyData || []).map((d, i) => {
        const date = new Date(`${d.date}T00:00:00`);
        const label = i === (weeklyData?.length || 0) - 1
          ? "Hoje"
          : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
        return {
          label,
          sublabel: `${label} · ${d.revenue.toLocaleString("pt-BR")} R$`,
          robux: d.revenue,
          sales: d.sales,
        };
      }),
    [weeklyData]
  );

  // SVG Geometry
  const width = 960;
  const height = 340;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const baseline = height - padBottom;

  const maxY = useMemo(() => {
    const vals = currentData.map((d) => (metricType === "robux" ? d.robux : d.sales));
    const maxVal = Math.max(...vals, 1);
    const ceiling = Math.ceil(maxVal * 1.35);
    return Math.max(ceiling, metricType === "robux" ? 75 : 10);
  }, [currentData, metricType]);

  // Y-axis grid levels matching the scale
  const gridLevels = useMemo(() => {
    return [
      { yVal: maxY, label: maxY >= 1000 ? `${(maxY / 1000).toFixed(1)}k` : `${Math.round(maxY)}` },
      { yVal: maxY * 0.75, label: (maxY * 0.75) >= 1000 ? `${((maxY * 0.75) / 1000).toFixed(1)}k` : `${Math.round(maxY * 0.75)}` },
      { yVal: maxY * 0.5, label: (maxY * 0.5) >= 1000 ? `${((maxY * 0.5) / 1000).toFixed(1)}k` : `${Math.round(maxY * 0.5)}` },
      { yVal: maxY * 0.25, label: (maxY * 0.25) >= 1000 ? `${((maxY * 0.25) / 1000).toFixed(1)}k` : `${Math.round(maxY * 0.25)}` },
      { yVal: 0, label: "0" },
    ];
  }, [maxY]);

  // Compute (x, y) coordinates for each point
  const points = useMemo(() => {
    return currentData.map((d, idx) => {
      const val = metricType === "robux" ? d.robux : d.sales;
      const x = padLeft + (idx / (currentData.length - 1)) * plotWidth;
      const normalized = Math.min(val, maxY) / maxY;
      const y = padTop + (1 - normalized) * plotHeight;
      return { ...d, x, y, val };
    });
  }, [currentData, metricType, maxY, padLeft, plotWidth, padTop, plotHeight]);

  // Compute smooth cubic bezier path
  const { curvePath, areaPath } = useMemo(() => {
    if (points.length < 2) return { curvePath: "", areaPath: "" };

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];

      // Smooth horizontal tangent S-curves exactly as in Adminly mockup
      const dx = next.x - curr.x;
      const cp1x = curr.x + dx * 0.45;
      const cp1y = curr.y;
      const cp2x = curr.x + dx * 0.55;
      const cp2y = next.y;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    const area = `${d} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;

    return { curvePath: d, areaPath: area };
  }, [points, baseline]);

  // Mouse hover tracking
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    let closestIdx = 0;
    let minDiff = Math.abs(points[0].x - mouseX);

    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoveredIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="rounded-[24px] bg-[#0a0a0a] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.45)] relative overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Left Dropdown Pill (Segler style) */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1a1a1a] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm">
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as any)}
              className="bg-transparent text-white focus:outline-none cursor-pointer appearance-none pr-4 font-medium"
            >
              <option value="robux" className="bg-[#0a0a0a] text-white">
                Receita Robux
              </option>
              <option value="vendas" className="bg-[#0a0a0a] text-white">
                Volume de Vendas
              </option>
            </select>
            <ChevronRight className="w-3.5 h-3.5 text-white/50 absolute right-2.5 pointer-events-none" />
          </div>

          <span className="text-xs text-white/35 font-medium hidden sm:inline">
            Catálogo Sincronizado &bull; Meta: 1.000 R$/dia
          </span>
        </div>

        <div className="rounded-full bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-white/65">
          Últimos 7 dias
        </div>
      </div>

      {/* Main SVG Graph */}
      <div className="relative w-full max-h-[380px]" style={{ aspectRatio: '960 / 340' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair select-none overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* The Signature Adminly Multi-Color Horizontal Gradient */}
            <linearGradient id="adminlyRainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="18%" stopColor="#1d4ed8" />
              <stop offset="42%" stopColor="#8b5cf6" />
              <stop offset="68%" stopColor="#ec4899" />
              <stop offset="88%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            {/* Vertical Alpha Fade Mask: Vibrant at curve apex, fading down to 0 */}
            <linearGradient id="verticalFadeMaskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>

            <mask id="adminlyAreaMask">
              {areaPath && <path d={areaPath} fill="url(#verticalFadeMaskGrad)" />}
            </mask>

            {/* White Glow Filter for the White Stroke */}
            <filter id="whiteLineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.65" />
            </filter>

            {/* Soft Ambient Neon Glow Filter */}
            <filter id="neonBackdropGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
            </filter>
          </defs>

          {/* Horizontal Dashed Grid Lines & Y-Axis Labels */}
          {gridLevels.map((lvl) => {
            const yCoord = padTop + (1 - lvl.yVal / maxY) * plotHeight;
            return (
              <g key={lvl.label}>
                {/* Y-Axis Label */}
                <text
                  x={padLeft - 16}
                  y={yCoord + 4}
                  textAnchor="end"
                  fill="rgba(255, 255, 255, 0.35)"
                  fontSize="12"
                  fontWeight="500"
                  fontFamily="inherit"
                  className="select-none"
                >
                  {lvl.label}
                </text>

                {/* Dashed Horizontal Line */}
                <line
                  x1={padLeft}
                  y1={yCoord}
                  x2={width - padRight}
                  y2={yCoord}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* 1. Neon Backlight Glow (Duplicate curve with heavy blur) */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="url(#adminlyRainbowGrad)"
              strokeWidth="10"
              opacity="0.5"
              filter="url(#neonBackdropGlow)"
            />
          )}

          {/* 2. Vibrant Multi-Color Area Fill with Vertical Alpha Fade */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#adminlyRainbowGrad)"
              mask="url(#adminlyAreaMask)"
            />
          )}

          {/* 3. The Pure White Glowing Line */}
          {curvePath && (
            <motion.path
              d={curvePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#whiteLineGlow)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          )}

          {/* 4. Prominent Circular Nodes (White with Dark Center) */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g key={`node-${idx}`} className="cursor-pointer">
                {/* Interactive Pulsing Outer Halo */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="rgba(255, 255, 255, 0.25)"
                    className="animate-ping"
                  />
                )}

                {/* Outer White Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "6.5" : "5"}
                  fill="#ffffff"
                  filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
                  className="transition-all duration-150"
                />

                {/* Inner Dark Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "3.2" : "2.5"}
                  fill="#0a0a0a"
                  className="transition-all duration-150"
                />
              </g>
            );
          })}

          {/* 5. X-Axis Labels placed directly below each node */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <text
                key={`label-${idx}`}
                x={pt.x}
                y={baseline + 22}
                textAnchor="middle"
                fill={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.45)"}
                fontSize="12"
                fontWeight={isHovered ? "700" : "500"}
                fontFamily="inherit"
                className="select-none transition-colors"
              >
                {pt.label}
              </text>
            );
          })}

          {/* Scrubber Vertical Line on Hover */}
          {hoveredIndex !== null && activePoint && (
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={baseline}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeDasharray="2 3"
              strokeWidth="1"
            />
          )}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && (
          <div
            className={`absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-[120%] bg-[#0a0a0a] p-3 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-md min-w-[150px] transition-all duration-150 ${
              hoveredIndex !== null ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <div className="text-[11px] font-medium text-white/50 mb-1 pb-1">
              {activePoint.sublabel}
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-white/60">
                {metricType === "robux" ? "Receita:" : "Vendas:"}
              </span>
              <span className="text-base font-bold text-white tracking-tight">
                {metricType === "robux"
                  ? `${activePoint.robux.toLocaleString("pt-BR")} R$`
                  : `${activePoint.sales} peças`}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/50 mt-1">
              <span>{metricType === "robux" ? `${activePoint.sales} vendas` : `${activePoint.robux} R$`}</span>
              <span className="text-emerald-400 font-semibold">
                {Math.round((activePoint.robux / 1000) * 100)}% meta
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
