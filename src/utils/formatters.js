export const formatDate = (date, options = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en-US', options).format(new Date(date));

export const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

export const scoreColor = (score) => (score >= 85 ? 'good' : score >= 70 ? 'mid' : 'low');
