export default function equal(a, b) {
  if (a === b) return true;

  let arrA = Array.isArray(a);
  let arrB = Array.isArray(b);
  let i;

  if (arrA && arrB) {
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++)
      if (!equal(a[i], b[i])) return false;
    return true;
  }

  if (arrA !== arrB) return false;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;

    let dateA = a instanceof Date;
    let dateB = b instanceof Date;
    if (dateA && dateB) return a.getTime() === b.getTime();
    if (dateA !== dateB) return false;

    let regexpA = a instanceof RegExp;
    let regexpB = b instanceof RegExp;
    if (regexpA && regexpB) return a.toString() === b.toString();
    if (regexpA !== regexpB) return false;

    for (i = 0; i < keys.length; i++)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = 0; i < keys.length; i++)
      if(!equal(a[keys[i]], b[keys[i]])) return false;

    return true;
  }

  return false;
}
