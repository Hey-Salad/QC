/**
 * HeySalad QC - ThresholdSlider Component
 * 
 * Slider for confidence threshold 0.0-1.0.
 * Requirements: 4.2
 */

export interface ThresholdSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function ThresholdSlider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
}: ThresholdSliderProps) {
  const percentage = Math.round(value * 100);

  // Determine color based on threshold level
  const getThresholdColor = () => {
    if (value >= 0.8) return 'text-green-600';
    if (value >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getThresholdLabel = () => {
    if (value >= 0.9) return 'Very High';
    if (value >= 0.75) return 'High';
    if (value >= 0.5) return 'Medium';
    if (value >= 0.25) return 'Low';
    return 'Very Low';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Confidence Threshold
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${getThresholdColor()}`}>
            {percentage}%
          </span>
          <span className="text-xs text-gray-500">({getThresholdLabel()})</span>
        </div>
      </div>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-tomato"
          aria-label="Confidence threshold"
        />
        
        {/* Scale markers */}
        <div className="flex justify-between mt-1 px-1">
          <span className="text-xs text-gray-400">0%</span>
          <span className="text-xs text-gray-400">25%</span>
          <span className="text-xs text-gray-400">50%</span>
          <span className="text-xs text-gray-400">75%</span>
          <span className="text-xs text-gray-400">100%</span>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Objects detected with confidence below this threshold will be ignored. 
        Higher values mean stricter detection requirements.
      </p>
    </div>
  );
}
