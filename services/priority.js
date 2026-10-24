// Pure priority and suitability rules (no database) so they can be unit tested. REQ-PA-02, REQ-PA-04
const RANK = { Emergency: 3, Urgent: 2, Routine: 1 };

const rank = (p) => RANK[p] || 0;

// > 0 when a is a higher priority than b, < 0 when lower, 0 when equal
const comparePriority = (a, b) => rank(a) - rank(b);

// Ward types a patient may be placed in (first = preferred)
function suitableWards(department, priority) {
  if (department === 'Pediatrics') return ['Pediatric'];
  if (priority === 'Emergency') return ['ICU', 'General'];
  return ['General'];
}

// Beds that are really free for a patient after those held back for higher-priority patients waiting
function usableCount(available, higherPriorityWaiting) {
  return Math.max(0, available - higherPriorityWaiting);
}

module.exports = { rank, comparePriority, suitableWards, usableCount };
