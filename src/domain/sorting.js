export function mergeSort(items, compare) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }
  if (typeof compare !== 'function') {
    throw new TypeError('compare must be a function');
  }

  const source = [...items];

  function sort(left, right) {
    if (right - left <= 1) return source.slice(left, right);

    const middle = Math.floor((left + right) / 2);
    const a = sort(left, middle);
    const b = sort(middle, right);
    const merged = [];
    let ai = 0;
    let bi = 0;

    while (ai < a.length && bi < b.length) {
      if (compare(a[ai], b[bi]) <= 0) merged.push(a[ai++]);
      else merged.push(b[bi++]);
    }
    while (ai < a.length) merged.push(a[ai++]);
    while (bi < b.length) merged.push(b[bi++]);
    return merged;
  }

  return source.length === 0 ? [] : sort(0, source.length);
}
