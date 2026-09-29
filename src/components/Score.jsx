import { scoreColor } from '../utils/formatters.js';

function Score({ value, compact = false }) {
  return (
    <span className={`score ${scoreColor(value)} ${compact ? 'score-compact' : ''}`}>
      {value}
      <small>/100</small>
    </span>
  );
}

export default Score;
