interface Props {
  currencies: string[];
  matrix: number[][];
}

function colorScale(v: number): string {
  if (v >= 0) {
    const t = Math.min(v, 1);
    const r = Math.round(255 - t * 218);
    const g = Math.round(255 - t * 218);
    return `rgb(${r}, ${g}, 255)`;
  }
  const t = Math.min(-v, 1);
  const g = Math.round(255 - t * 218);
  const b = Math.round(255 - t * 218);
  return `rgb(255, ${g}, ${b})`;
}

export function CorrelationHeatmap({ currencies, matrix }: Props) {
  const n = currencies.length;
  const cellSize = 56;
  const labelW = 44;
  const w = labelW + n * cellSize;
  const h = labelW + n * cellSize;

  return (
    <div className="chart-card">
      <h3>Currency Correlation Matrix</h3>
      <p className="chart-subtitle">
        Pairwise correlations between daily FX log returns.
      </p>
      <svg width={w} height={h} style={{ display: "block", margin: "0 auto" }}>
        {currencies.map((c, i) => (
          <text
            key={`col-${c}`}
            x={labelW + i * cellSize + cellSize / 2}
            y={labelW - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={600}
            fill="#475569"
          >
            {c}
          </text>
        ))}
        {currencies.map((c, i) => (
          <text
            key={`row-${c}`}
            x={labelW - 8}
            y={labelW + i * cellSize + cellSize / 2 + 4}
            textAnchor="end"
            fontSize={11}
            fontWeight={600}
            fill="#475569"
          >
            {c}
          </text>
        ))}
        {matrix.map((row, i) =>
          row.map((val, j) => (
            <g key={`${i}-${j}`}>
              <rect
                x={labelW + j * cellSize}
                y={labelW + i * cellSize}
                width={cellSize - 2}
                height={cellSize - 2}
                rx={4}
                fill={colorScale(val)}
              />
              <text
                x={labelW + j * cellSize + (cellSize - 2) / 2}
                y={labelW + i * cellSize + (cellSize - 2) / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={500}
                fill={Math.abs(val) > 0.6 ? "#fff" : "#0f172a"}
              >
                {val.toFixed(2)}
              </text>
            </g>
          ))
        )}
      </svg>
    </div>
  );
}
