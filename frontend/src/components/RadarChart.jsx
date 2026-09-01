import React from 'react';

export default function RadarChart({
  queryProfile = null,
  targetProfile = null,
  queryLabel = 'Incoming audio',
  targetLabel = 'Enrolled profile',
}) {
  const defaultMetrics = {
    'Vocal Tract': 65,
    'Glottal Pulse': 70,
    'Formant Space': 55,
    'Spectral Tilt': 60,
    'Nasality': 50,
    'Micro-Tremor': 75,
    'Harmonics': 68,
    'Flatness': 45,
  };

  const qData = queryProfile || defaultMetrics;
  const tData = targetProfile;

  const axes = Object.keys(qData);
  const totalAxes = axes.length;
  const center = 110;
  const radius = 75;

  const getCoordinates = (index, value) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const queryPoints = axes.map((axis, i) => {
    const val = qData[axis] || 50;
    const { x, y } = getCoordinates(i, val);
    return `${x},${y}`;
  }).join(' ');

  const targetPoints = tData ? axes.map((axis, i) => {
    const val = tData[axis] || 50;
    const { x, y } = getCoordinates(i, val);
    return `${x},${y}`;
  }).join(' ') : null;

  return (
    <div className="apple-card p-6 flex flex-col items-center space-y-4">
      <div className="w-full flex items-center justify-between text-xs">
        <span className="font-medium text-[#1D1D1F]">
          Biometric Voiceprint Radar
        </span>
        <div className="flex items-center space-x-4 text-xs">
          <span className="flex items-center space-x-1.5 text-[#0071E3] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#0071E3]"></span>
            <span>{queryLabel}</span>
          </span>
          {targetPoints && (
            <span className="flex items-center space-x-1.5 text-[#86868B] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#86868B]"></span>
              <span>{targetLabel}</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative w-[220px] h-[220px] my-1">
        <svg width="220" height="220" className="overflow-visible">
          {/* Concentric circles / polygons */}
          {[0.33, 0.66, 1.0].map((level, lIdx) => {
            const points = axes.map((_, i) => {
              const { x, y } = getCoordinates(i, level * 100);
              return `${x},${y}`;
            }).join(' ');
            return (
              <polygon
                key={lIdx}
                points={points}
                fill="none"
                stroke="#E5E5E7"
                strokeWidth="1"
              />
            );
          })}

          {/* Radial Spokes and Labels */}
          {axes.map((axis, i) => {
            const { x, y } = getCoordinates(i, 100);
            const labelPos = getCoordinates(i, 116);
            return (
              <g key={i}>
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#E5E5E7"
                  strokeWidth="1"
                />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#86868B"
                  fontSize="8.5"
                  fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                  fontWeight="400"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {axis}
                </text>
              </g>
            );
          })}

          {/* Stored Profile Polygon */}
          {targetPoints && (
            <polygon
              points={targetPoints}
              fill="rgba(134, 134, 139, 0.08)"
              stroke="#86868B"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Sample Polygon */}
          <polygon
            points={queryPoints}
            fill="rgba(0, 113, 227, 0.12)"
            stroke="#0071E3"
            strokeWidth="1.5"
          />

          {/* Vertex Nodes */}
          {axes.map((axis, i) => {
            const val = qData[axis] || 50;
            const { x, y } = getCoordinates(i, val);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2.5"
                fill="#0071E3"
              />
            );
          })}
        </svg>
      </div>

      <div className="text-[11px] text-[#86868B]">
        256-dimensional acoustic filterbank projection
      </div>
    </div>
  );
}
