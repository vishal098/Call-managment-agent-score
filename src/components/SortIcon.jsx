import { ArrowDown, ArrowUp } from 'lucide-react';

function SortIcon({ active, order }) {
  if (!active) return <ArrowDown size={12} className="sort-muted" />;
  return order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export default SortIcon;
