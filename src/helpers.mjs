/*!
 * https://github.com/Starcounter-Jack/JSON-Patch
 * (c) 2017 Joachim Wester
 * MIT license
 */
const _hasOwnProperty = Object.prototype.hasOwnProperty;
export function hasOwnProperty(obj, key) {
  return _hasOwnProperty.call(obj, key);
}
export function _objectKeys(obj) {
  if (Array.isArray(obj)) {
    let keys = new Array(obj.length);
    for (let k = 0; k < keys.length; k++) {
      keys[k] = "" + k;
    }
    return keys;
  }
  if (Object.keys) {
    return Object.keys(obj);
  }
  let keys = [];
  for (let i in obj) {
    if (hasOwnProperty(obj, i)) {
      keys.push(i);
    }
  }
  return keys;
}
/**
 * Deeply clone the object.
 * https://jsperf.com/deep-copy-vs-json-stringify-json-parse/25 (recursiveDeepCopy)
 * @param  {any} obj value to clone
 * @return {any} cloned obj
 */
export function _deepClone(obj) {
  switch (typeof obj) {
    case "object":
      return JSON.parse(JSON.stringify(obj)); //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
    case "undefined":
      return null; //this is how JSON.stringify behaves for array items
    default:
      return obj; //no need to clone primitives
  }
}
//3x faster than cached /^\d+$/.test(str)
export function isInteger(str) {
  let i = 0;
  let len = str.length;
  let charCode;
  while (i < len) {
    charCode = str.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) {
      i++;
      continue;
    }
    return false;
  }
  return true;
}
/**
 * Escapes a json pointer path
 * @param path The raw pointer
 * @return the Escaped path
 */
export function escapePathComponent(path) {
  if (path.indexOf('/') === -1 && path.indexOf('~') === -1)
    return path;
  return path.replace(/~/g, '~0').replace(/\//g, '~1');
}
/**
 * Unescapes a json pointer path
 * @param path The escaped pointer
 * @return The unescaped path
 */
export function unescapePathComponent(path) {
  return path.replace(/~1/g, '/').replace(/~0/g, '~');
}
export function _getPathRecursive(root, obj) {
  let found;
  for (let key in root) {
    if (hasOwnProperty(root, key)) {
      if (root[key] === obj) {
        return escapePathComponent(key) + '/';
      } else if (typeof root[key] === 'object') {
        found = _getPathRecursive(root[key], obj);
        if (found !== '') {
          return escapePathComponent(key) + '/' + found;
        }
      }
    }
  }
  return '';
}
export function getPath(root, obj) {
  if (root === obj) {
    return '/';
  }
  let path = _getPathRecursive(root, obj);
  if (path === '') {
    throw new Error("Object not found in root");
  }
  return '/' + path;
}
/**
 * Recursively checks whether an object has any undefined values inside.
 */
export function hasUndefined(obj) {
  if (obj === undefined) {
    return true;
  }
  if (obj) {
    if (Array.isArray(obj)) {
      for (let i = 0, len = obj.length; i < len; i++) {
        if (hasUndefined(obj[i])) {
          return true;
        }
      }
    } else if (typeof obj === "object") {
      let objKeys = _objectKeys(obj);
      let objKeysLength = objKeys.length;
      for (let i = 0; i < objKeysLength; i++) {
        if (hasUndefined(obj[objKeys[i]])) {
          return true;
        }
      }
    }
  }
  return false;
}
export class PatchError extends Error {
  constructor(message, name, index, operation, tree) {
    super(message);
    this.message = message;
    this.name = name;
    this.index = index;
    this.operation = operation;
    this.tree = tree;
  }
}
