import _equals from './deepEquals.mjs';
import {
  _deepClone,
  _objectKeys,
  escapePathComponent,
  hasOwnProperty
} from './helpers.mjs';
import {
  applyPatch
} from './core.mjs';
export {
  applyOperation,
  applyPatch,
  applyReducer,
  getValueByPointer,
  validate,
  validator
}
from './core.mjs';
export {
  PatchError as JsonPatchError, _deepClone as deepClone, escapePathComponent, unescapePathComponent
}
from './helpers.mjs';

let beforeDict = [];
class Mirror {
  constructor(obj) {
    this.observers = [];
    this.obj = obj;
  }
}
class ObserverInfo {
  constructor(callback, observer) {
    this.callback = callback;
    this.observer = observer;
  }
}

function getMirror(obj) {
  for (let i = 0, length = beforeDict.length; i < length; i++) {
    if (beforeDict[i].obj === obj) {
      return beforeDict[i];
    }
  }
}

function getObserverFromMirror(mirror, callback) {
  for (let j = 0, length = mirror.observers.length; j < length; j++) {
    if (mirror.observers[j].callback === callback) {
      return mirror.observers[j].observer;
    }
  }
}

function removeObserverFromMirror(mirror, observer) {
  for (let j = 0, length = mirror.observers.length; j < length; j++) {
    if (mirror.observers[j].observer === observer) {
      mirror.observers.splice(j, 1);
      return;
    }
  }
}
/**
 * Detach an observer from an object
 */
export function unobserve(root, observer) {
  observer.unobserve();
}
/**
 * Observes changes made to an object, which can then be retrieved using generate
 */
export function observe(obj, callback) {
  let patches = [];
  let root = obj;
  let observer;
  let mirror = getMirror(obj);
  if (!mirror) {
    mirror = new Mirror(obj);
    beforeDict.push(mirror);
  } else {
    observer = getObserverFromMirror(mirror, callback);
  }
  if (observer) {
    return observer;
  }
  observer = {};
  mirror.value = _deepClone(obj);
  if (callback) {
    observer.callback = callback;
    observer.next = null;
    let dirtyCheck = () => {
      generate(observer);
    };
    let fastCheck = () => {
      clearTimeout(observer.next);
      observer.next = setTimeout(dirtyCheck);
    };
    if (typeof window !== 'undefined') {
      if (window.addEventListener) {
        window.addEventListener('mouseup', fastCheck);
        window.addEventListener('keyup', fastCheck);
        window.addEventListener('mousedown', fastCheck);
        window.addEventListener('keydown', fastCheck);
        window.addEventListener('change', fastCheck);
      } else {
        document.documentElement.attachEvent('onmouseup', fastCheck);
        document.documentElement.attachEvent('onkeyup', fastCheck);
        document.documentElement.attachEvent('onmousedown', fastCheck);
        document.documentElement.attachEvent('onkeydown', fastCheck);
        document.documentElement.attachEvent('onchange', fastCheck);
      }
    }
  }
  observer.patches = patches;
  observer.object = obj;
  observer.unobserve = () => {
    generate(observer);
    clearTimeout(observer.next);
    removeObserverFromMirror(mirror, observer);
    if (typeof window !== 'undefined') {
      if (window.removeEventListener) {
        window.removeEventListener('mouseup', fastCheck);
        window.removeEventListener('keyup', fastCheck);
        window.removeEventListener('mousedown', fastCheck);
        window.removeEventListener('keydown', fastCheck);
      } else {
        document.documentElement.detachEvent('onmouseup', fastCheck);
        document.documentElement.detachEvent('onkeyup', fastCheck);
        document.documentElement.detachEvent('onmousedown', fastCheck);
        document.documentElement.detachEvent('onkeydown', fastCheck);
      }
    }
  };
  mirror.observers.push(new ObserverInfo(callback, observer));
  return observer;
}
/**
 * Generate an array of patches from an observer
 */
export function generate(observer) {
  let mirror;
  for (let i = 0, length = beforeDict.length; i < length; i++) {
    if (beforeDict[i].obj === observer.object) {
      mirror = beforeDict[i];
      break;
    }
  }
  _generate(mirror.value, observer.object, observer.patches, "");
  if (observer.patches.length) {
    applyPatch(mirror.value, observer.patches);
  }
  let temp = observer.patches;
  if (temp.length > 0) {
    observer.patches = [];
    if (observer.callback) {
      observer.callback(temp);
    }
  }
  return temp;
}
// Dirty check if obj is different from mirror, generate patches and update mirror
function _generate(mirror, obj, patches, path) {
  if (obj === mirror) {
    return;
  }
  if (typeof obj.toJSON === "function") {
    obj = obj.toJSON();
  }
  let newKeys = _objectKeys(obj);
  let oldKeys = _objectKeys(mirror);
  let changed = false;
  let deleted = false;
  //if ever "move" operation is implemented here, make sure this test runs OK: "should not generate the same patch twice (move)"
  for (let t = oldKeys.length - 1; t >= 0; t--) {
    let key = oldKeys[t];
    let oldVal = mirror[key];
    if (hasOwnProperty(obj, key) && !(obj[key] === undefined && oldVal !== undefined && Array.isArray(obj) === false)) {
      let newVal = obj[key];
      if (typeof oldVal == "object" && oldVal != null && typeof newVal == "object" && newVal != null) {
        _generate(oldVal, newVal, patches, path + "/" + escapePathComponent(key));
      } else {
        if (oldVal !== newVal) {
          changed = true;
          patches.push({
            op: "replace",
            path: path + "/" + escapePathComponent(key),
            value: _deepClone(newVal)
          });
        }
      }
    } else {
      patches.push({
        op: "remove",
        path: path + "/" + escapePathComponent(key)
      });
      deleted = true; // property has been deleted
    }
  }
  if (!deleted && newKeys.length == oldKeys.length) {
    return;
  }
  for (let t = 0; t < newKeys.length; t++) {
    let key = newKeys[t];
    if (!hasOwnProperty(mirror, key) && obj[key] !== undefined) {
      patches.push({
        op: "add",
        path: path + "/" + escapePathComponent(key),
        value: _deepClone(obj[key])
      });
    }
  }
}
/**
 * Create an array of patches from the differences in two objects
 */
export function compare(tree1, tree2) {
  let patches = [];
  _generate(tree1, tree2, patches, '');
  return patches;
}
