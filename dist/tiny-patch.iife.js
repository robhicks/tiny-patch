var TinyPatch = (function (exports) {
'use strict';

function equal(a, b) {
  if (a === b) { return true; }

  var arrA = Array.isArray(a);
  var arrB = Array.isArray(b);
  var i;

  if (arrA && arrB) {
    if (a.length !== b.length) { return false; }
    for (i = 0; i < a.length; i++)
      { if (!equal(a[i], b[i])) { return false; } }
    return true;
  }

  if (arrA !== arrB) { return false; }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    var keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) { return false; }

    var dateA = a instanceof Date;
    var dateB = b instanceof Date;
    if (dateA && dateB) { return a.getTime() === b.getTime(); }
    if (dateA !== dateB) { return false; }

    var regexpA = a instanceof RegExp;
    var regexpB = b instanceof RegExp;
    if (regexpA && regexpB) { return a.toString() === b.toString(); }
    if (regexpA !== regexpB) { return false; }

    for (i = 0; i < keys.length; i++)
      { if (!Object.prototype.hasOwnProperty.call(b, keys[i])) { return false; } }

    for (i = 0; i < keys.length; i++)
      { if(!equal(a[keys[i]], b[keys[i]])) { return false; } }

    return true;
  }

  return false;
}

/*!
 * https://github.com/Starcounter-Jack/JSON-Patch
 * (c) 2017 Joachim Wester
 * MIT license
 */
var _hasOwnProperty = Object.prototype.hasOwnProperty;
function hasOwnProperty(obj, key) {
  return _hasOwnProperty.call(obj, key);
}
function _objectKeys(obj) {
  if (Array.isArray(obj)) {
    var keys$1 = new Array(obj.length);
    for (var k = 0; k < keys$1.length; k++) {
      keys$1[k] = "" + k;
    }
    return keys$1;
  }
  if (Object.keys) {
    return Object.keys(obj);
  }
  var keys = [];
  for (var i in obj) {
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
function _deepClone(obj) {
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
function isInteger(str) {
  var i = 0;
  var len = str.length;
  var charCode;
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
function escapePathComponent(path) {
  if (path.indexOf('/') === -1 && path.indexOf('~') === -1)
    { return path; }
  return path.replace(/~/g, '~0').replace(/\//g, '~1');
}
/**
 * Unescapes a json pointer path
 * @param path The escaped pointer
 * @return The unescaped path
 */
function unescapePathComponent(path) {
  return path.replace(/~1/g, '/').replace(/~0/g, '~');
}


/**
 * Recursively checks whether an object has any undefined values inside.
 */
function hasUndefined(obj) {
  if (obj === undefined) {
    return true;
  }
  if (obj) {
    if (Array.isArray(obj)) {
      for (var i = 0, len = obj.length; i < len; i++) {
        if (hasUndefined(obj[i])) {
          return true;
        }
      }
    } else if (typeof obj === "object") {
      var objKeys = _objectKeys(obj);
      var objKeysLength = objKeys.length;
      for (var i$1 = 0; i$1 < objKeysLength; i$1++) {
        if (hasUndefined(obj[objKeys[i$1]])) {
          return true;
        }
      }
    }
  }
  return false;
}
var PatchError = (function (Error) {
  function PatchError(message, name, index, operation, tree) {
    Error.call(this, message);
    this.message = message;
    this.name = name;
    this.index = index;
    this.operation = operation;
    this.tree = tree;
  }

  if ( Error ) PatchError.__proto__ = Error;
  PatchError.prototype = Object.create( Error && Error.prototype );
  PatchError.prototype.constructor = PatchError;

  return PatchError;
}(Error));

var JsonPatchError = PatchError;

/* We use a Javascript hash to store each
 function. Each hash entry (property) uses
 the operation identifiers specified in rfc6902.
 In this way, we can map each patch operation
 to its dedicated function in efficient way.
 */
/* The operations applicable to an object */
var objOps = {
  add: function(obj, key, document) {
    obj[key] = this.value;
    return {
      newDocument: document
    };
  },
  remove: function(obj, key, document) {
    var removed = obj[key];
    delete obj[key];
    return {
      newDocument: document,
      removed: removed
    };
  },
  replace: function(obj, key, document) {
    var removed = obj[key];
    obj[key] = this.value;
    return {
      newDocument: document,
      removed: removed
    };
  },
  move: function(obj, key, document) {
    /* in case move target overwrites an existing value,
    return the removed value, this can be taxing performance-wise,
    and is potentially unneeded */
    var removed = getValueByPointer(document, this.path);
    if (removed) {
      removed = _deepClone(removed);
    }
    var originalValue = applyOperation(document, {
      op: "remove",
      path: this.from
    }).removed;
    applyOperation(document, {
      op: "add",
      path: this.path,
      value: originalValue
    });
    return {
      newDocument: document,
      removed: removed
    };
  },
  copy: function(obj, key, document) {
    var valueToCopy = getValueByPointer(document, this.from);
    // enforce copy by value so further operations don't affect source (see issue #177)
    applyOperation(document, {
      op: "add",
      path: this.path,
      value: _deepClone(valueToCopy)
    });
    return {
      newDocument: document
    };
  },
  test: function(obj, key, document) {
    return {
      newDocument: document,
      test: equal(obj[key], this.value)
    };
  },
  _get: function(obj, key, document) {
    this.value = obj[key];
    return {
      newDocument: document
    };
  }
};
/* The operations applicable to an array. Many are the same as for the object */
var arrOps = {
  add: function(arr, i, document) {
    if (isInteger(i)) {
      arr.splice(i, 0, this.value);
    } else {
      arr[i] = this.value;
    }
    // this may be needed when using '-' in an array
    return {
      newDocument: document,
      index: i
    };
  },
  remove: function(arr, i, document) {
    var removedList = arr.splice(i, 1);
    return {
      newDocument: document,
      removed: removedList[0]
    };
  },
  replace: function(arr, i, document) {
    var removed = arr[i];
    arr[i] = this.value;
    return {
      newDocument: document,
      removed: removed
    };
  },
  move: objOps.move,
  copy: objOps.copy,
  test: objOps.test,
  _get: objOps._get
};
/**
 * Retrieves a value from a JSON document by a JSON pointer.
 * Returns the value.
 *
 * @param document The document to get the value from
 * @param pointer an escaped JSON pointer
 * @return The retrieved value
 */
function getValueByPointer(document, pointer) {
  if (pointer == '') {
    return document;
  }
  var getOriginalDestination = {
    op: "_get",
    path: pointer
  };
  applyOperation(document, getOriginalDestination);
  return getOriginalDestination.value;
}
/**
 * Apply a single JSON Patch Operation on a JSON document.
 * Returns the {newDocument, result} of the operation.
 * It modifies the `document` and `operation` objects - it gets the values by reference.
 * If you would like to avoid touching your values, clone them:
 * `jsonpatch.applyOperation(document, jsonpatch._deepClone(operation))`.
 *
 * @param document The document to patch
 * @param operation The operation to apply
 * @param validateOperation `false` is without validation, `true` to use default jsonpatch's validation, or you can pass a `validateOperation` callback to be used for validation.
 * @param mutateDocument Whether to mutate the original document or clone it before applying
 * @return `{newDocument, result}` after the operation
 */
function applyOperation(document, operation, validateOperation, mutateDocument) {
  if ( validateOperation === void 0 ) validateOperation = false;
  if ( mutateDocument === void 0 ) mutateDocument = true;

  if (validateOperation) {
    if (typeof validateOperation == 'function') {
      validateOperation(operation, 0, document, operation.path);
    } else {
      validator(operation, 0);
    }
  }
  /* ROOT OPERATIONS */
  if (operation.path === "") {
    var returnValue = {
      newDocument: document
    };
    if (operation.op === 'add') {
      returnValue.newDocument = operation.value;
      return returnValue;
    } else if (operation.op === 'replace') {
      returnValue.newDocument = operation.value;
      returnValue.removed = document; //document we removed
      return returnValue;
    } else if (operation.op === 'move' || operation.op === 'copy') {
      returnValue.newDocument = getValueByPointer(document, operation.from); // get the value by json-pointer in `from` field
      if (operation.op === 'move') {
        returnValue.removed = document;
      }
      return returnValue;
    } else if (operation.op === 'test') {
      returnValue.test = equal(document, operation.value);
      if (returnValue.test === false) {
        throw new JsonPatchError("Test operation failed", 'TEST_OPERATION_FAILED', 0, operation, document);
      }
      returnValue.newDocument = document;
      return returnValue;
    } else if (operation.op === 'remove') {
      returnValue.removed = document;
      returnValue.newDocument = null;
      return returnValue;
    } else if (operation.op === '_get') {
      operation.value = document;
      return returnValue;
    } else {
      if (validateOperation) {
        throw new JsonPatchError('Operation `op` property is not one of operations defined in RFC-6902', 'OPERATION_OP_INVALID', 0, operation, document);
      } else {
        return returnValue;
      }
    }
  } /* END ROOT OPERATIONS */
  else {
    if (!mutateDocument) {
      document = _deepClone(document);
    }
    var path = operation.path || "";
    var keys = path.split('/');
    var obj = document;
    var t = 1; //skip empty element - http://jsperf.com/to-shift-or-not-to-shift
    var len = keys.length;
    var existingPathFragment = undefined;
    var key;
    var validateFunction;
    if (typeof validateOperation == 'function') {
      validateFunction = validateOperation;
    } else {
      validateFunction = validator;
    }
    while (true) {
      key = keys[t];
      if (validateOperation) {
        if (existingPathFragment === undefined) {
          if (obj[key] === undefined) {
            existingPathFragment = keys.slice(0, t).join('/');
          } else if (t == len - 1) {
            existingPathFragment = operation.path;
          }
          if (existingPathFragment !== undefined) {
            validateFunction(operation, 0, document, existingPathFragment);
          }
        }
      }
      t++;
      if (Array.isArray(obj)) {
        if (key === '-') {
          key = obj.length;
        } else {
          if (validateOperation && !isInteger(key)) {
            throw new JsonPatchError("Expected an unsigned base-10 integer value, making the new referenced value the array element with the zero-based index", "OPERATION_PATH_ILLEGAL_ARRAY_INDEX", 0, operation.path, operation);
          } // only parse key when it's an integer for `arr.prop` to work
          else if (isInteger(key)) {
            key = ~~key;
          }
        }
        if (t >= len) {
          if (validateOperation && operation.op === "add" && key > obj.length) {
            throw new JsonPatchError("The specified index MUST NOT be greater than the number of elements in the array", "OPERATION_VALUE_OUT_OF_BOUNDS", 0, operation.path, operation);
          }
          var returnValue$1 = arrOps[operation.op].call(operation, obj, key, document); // Apply patch
          if (returnValue$1.test === false) {
            throw new JsonPatchError("Test operation failed", 'TEST_OPERATION_FAILED', 0, operation, document);
          }
          return returnValue$1;
        }
      } else {
        if (key && key.indexOf('~') != -1) {
          key = unescapePathComponent(key);
        }
        if (t >= len) {
          var returnValue$2 = objOps[operation.op].call(operation, obj, key, document); // Apply patch
          if (returnValue$2.test === false) {
            throw new JsonPatchError("Test operation failed", 'TEST_OPERATION_FAILED', 0, operation, document);
          }
          return returnValue$2;
        }
      }
      obj = obj[key];
    }
  }
}
/**
 * Apply a full JSON Patch array on a JSON document.
 * Returns the {newDocument, result} of the patch.
 * It modifies the `document` object and `patch` - it gets the values by reference.
 * If you would like to avoid touching your values, clone them:
 * `jsonpatch.applyPatch(document, jsonpatch._deepClone(patch))`.
 *
 * @param document The document to patch
 * @param patch The patch to apply
 * @param validateOperation `false` is without validation, `true` to use default jsonpatch's validation, or you can pass a `validateOperation` callback to be used for validation.
 * @param mutateDocument Whether to mutate the original document or clone it before applying
 * @return An array of `{newDocument, result}` after the patch
 */
function applyPatch(document, patch, validateOperation, mutateDocument) {
  if ( mutateDocument === void 0 ) mutateDocument = true;

  if (validateOperation) {
    if (!Array.isArray(patch)) {
      throw new JsonPatchError('Patch sequence must be an array', 'SEQUENCE_NOT_AN_ARRAY');
    }
  }
  if (!mutateDocument) {
    document = _deepClone(document);
  }
  var results = new Array(patch.length);
  for (var i = 0, length = patch.length; i < length; i++) {
    results[i] = applyOperation(document, patch[i], validateOperation);
    document = results[i].newDocument; // in case root was replaced
  }
  results.newDocument = document;
  return results;
}
/**
 * Apply a single JSON Patch Operation on a JSON document.
 * Returns the updated document.
 * Suitable as a reducer.
 *
 * @param document The document to patch
 * @param operation The operation to apply
 * @return The updated document
 */
function applyReducer(document, operation) {
  var operationResult = applyOperation(document, operation);
  if (operationResult.test === false) {
    throw new JsonPatchError("Test operation failed", 'TEST_OPERATION_FAILED', 0, operation, document);
  }
  return operationResult.newDocument;
}
/**
 * Validates a single operation. Called from `jsonpatch.validate`. Throws `JsonPatchError` in case of an error.
 * @param {object} operation - operation object (patch)
 * @param {number} index - index of operation in the sequence
 * @param {object} [document] - object where the operation is supposed to be applied
 * @param {string} [existingPathFragment] - comes along with `document`
 */
function validator(operation, index, document, existingPathFragment) {
  if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) {
    throw new JsonPatchError('Operation is not an object', 'OPERATION_NOT_AN_OBJECT', index, operation, document);
  } else if (!objOps[operation.op]) {
    throw new JsonPatchError('Operation `op` property is not one of operations defined in RFC-6902', 'OPERATION_OP_INVALID', index, operation, document);
  } else if (typeof operation.path !== 'string') {
    throw new JsonPatchError('Operation `path` property is not a string', 'OPERATION_PATH_INVALID', index, operation, document);
  } else if (operation.path.indexOf('/') !== 0 && operation.path.length > 0) {
    // paths that aren't empty string should start with "/"
    throw new JsonPatchError('Operation `path` property must start with "/"', 'OPERATION_PATH_INVALID', index, operation, document);
  } else if ((operation.op === 'move' || operation.op === 'copy') && typeof operation.from !== 'string') {
    throw new JsonPatchError('Operation `from` property is not present (applicable in `move` and `copy` operations)', 'OPERATION_FROM_REQUIRED', index, operation, document);
  } else if ((operation.op === 'add' || operation.op === 'replace' || operation.op === 'test') && operation.value === undefined) {
    throw new JsonPatchError('Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)', 'OPERATION_VALUE_REQUIRED', index, operation, document);
  } else if ((operation.op === 'add' || operation.op === 'replace' || operation.op === 'test') && hasUndefined(operation.value)) {
    throw new JsonPatchError('Operation `value` property is not present (applicable in `add`, `replace` and `test` operations)', 'OPERATION_VALUE_CANNOT_CONTAIN_UNDEFINED', index, operation, document);
  } else if (document) {
    if (operation.op == "add") {
      var pathLen = operation.path.split("/").length;
      var existingPathLen = existingPathFragment.split("/").length;
      if (pathLen !== existingPathLen + 1 && pathLen !== existingPathLen) {
        throw new JsonPatchError('Cannot perform an `add` operation at the desired path', 'OPERATION_PATH_CANNOT_ADD', index, operation, document);
      }
    } else if (operation.op === 'replace' || operation.op === 'remove' || operation.op === '_get') {
      if (operation.path !== existingPathFragment) {
        throw new JsonPatchError('Cannot perform the operation at a path that does not exist', 'OPERATION_PATH_UNRESOLVABLE', index, operation, document);
      }
    } else if (operation.op === 'move' || operation.op === 'copy') {
      var existingValue = {
        op: "_get",
        path: operation.from,
        value: undefined
      };
      var error = validate([existingValue], document);
      if (error && error.name === 'OPERATION_PATH_UNRESOLVABLE') {
        throw new JsonPatchError('Cannot perform the operation from a path that does not exist', 'OPERATION_FROM_UNRESOLVABLE', index, operation, document);
      }
    }
  }
}
/**
 * Validates a sequence of operations. If `document` parameter is provided, the sequence is additionally validated against the object document.
 * If error is encountered, returns a JsonPatchError object
 * @param sequence
 * @param document
 * @returns {JsonPatchError|undefined}
 */
function validate(sequence, document, externalValidator) {
  try {
    if (!Array.isArray(sequence)) {
      throw new JsonPatchError('Patch sequence must be an array', 'SEQUENCE_NOT_AN_ARRAY');
    }
    if (document) {
      //clone document and sequence so that we can safely try applying operations
      applyPatch(_deepClone(document), _deepClone(sequence), externalValidator || true);
    } else {
      externalValidator = externalValidator || validator;
      for (var i = 0; i < sequence.length; i++) {
        externalValidator(sequence[i], i, document, undefined);
      }
    }
  } catch (e) {
    if (e instanceof JsonPatchError) {
      return e;
    } else {
      throw e;
    }
  }
}

var beforeDict = [];
var Mirror = function Mirror(obj) {
  this.observers = [];
  this.obj = obj;
};
var ObserverInfo = function ObserverInfo(callback, observer) {
  this.callback = callback;
  this.observer = observer;
};

function getMirror(obj) {
  for (var i = 0, length = beforeDict.length; i < length; i++) {
    if (beforeDict[i].obj === obj) {
      return beforeDict[i];
    }
  }
}

function getObserverFromMirror(mirror, callback) {
  for (var j = 0, length = mirror.observers.length; j < length; j++) {
    if (mirror.observers[j].callback === callback) {
      return mirror.observers[j].observer;
    }
  }
}

function removeObserverFromMirror(mirror, observer) {
  for (var j = 0, length = mirror.observers.length; j < length; j++) {
    if (mirror.observers[j].observer === observer) {
      mirror.observers.splice(j, 1);
      return;
    }
  }
}
/**
 * Detach an observer from an object
 */
function unobserve(root, observer) {
  observer.unobserve();
}
/**
 * Observes changes made to an object, which can then be retrieved using generate
 */
function observe(obj, callback) {
  var patches = [];
  var observer;
  var mirror = getMirror(obj);
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
    var dirtyCheck = function () {
      generate(observer);
    };
    var fastCheck$1 = function () {
      clearTimeout(observer.next);
      observer.next = setTimeout(dirtyCheck);
    };
    if (typeof window !== 'undefined') {
      if (window.addEventListener) {
        window.addEventListener('mouseup', fastCheck$1);
        window.addEventListener('keyup', fastCheck$1);
        window.addEventListener('mousedown', fastCheck$1);
        window.addEventListener('keydown', fastCheck$1);
        window.addEventListener('change', fastCheck$1);
      } else {
        document.documentElement.attachEvent('onmouseup', fastCheck$1);
        document.documentElement.attachEvent('onkeyup', fastCheck$1);
        document.documentElement.attachEvent('onmousedown', fastCheck$1);
        document.documentElement.attachEvent('onkeydown', fastCheck$1);
        document.documentElement.attachEvent('onchange', fastCheck$1);
      }
    }
  }
  observer.patches = patches;
  observer.object = obj;
  observer.unobserve = function () {
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
function generate(observer) {
  var mirror;
  for (var i = 0, length = beforeDict.length; i < length; i++) {
    if (beforeDict[i].obj === observer.object) {
      mirror = beforeDict[i];
      break;
    }
  }
  _generate(mirror.value, observer.object, observer.patches, "");
  if (observer.patches.length) {
    applyPatch(mirror.value, observer.patches);
  }
  var temp = observer.patches;
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
  var newKeys = _objectKeys(obj);
  var oldKeys = _objectKeys(mirror);
  var deleted = false;
  //if ever "move" operation is implemented here, make sure this test runs OK: "should not generate the same patch twice (move)"
  for (var t = oldKeys.length - 1; t >= 0; t--) {
    var key = oldKeys[t];
    var oldVal = mirror[key];
    if (hasOwnProperty(obj, key) && !(obj[key] === undefined && oldVal !== undefined && Array.isArray(obj) === false)) {
      var newVal = obj[key];
      if (typeof oldVal == "object" && oldVal != null && typeof newVal == "object" && newVal != null) {
        _generate(oldVal, newVal, patches, path + "/" + escapePathComponent(key));
      } else {
        if (oldVal !== newVal) {
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
  for (var t$1 = 0; t$1 < newKeys.length; t$1++) {
    var key$1 = newKeys[t$1];
    if (!hasOwnProperty(mirror, key$1) && obj[key$1] !== undefined) {
      patches.push({
        op: "add",
        path: path + "/" + escapePathComponent(key$1),
        value: _deepClone(obj[key$1])
      });
    }
  }
}
/**
 * Create an array of patches from the differences in two objects
 */
function compare(tree1, tree2) {
  var patches = [];
  _generate(tree1, tree2, patches, '');
  return patches;
}

exports.unobserve = unobserve;
exports.observe = observe;
exports.generate = generate;
exports.compare = compare;
exports.applyOperation = applyOperation;
exports.applyPatch = applyPatch;
exports.applyReducer = applyReducer;
exports.getValueByPointer = getValueByPointer;
exports.validate = validate;
exports.validator = validator;
exports.JsonPatchError = PatchError;
exports.deepClone = _deepClone;
exports.escapePathComponent = escapePathComponent;
exports.unescapePathComponent = unescapePathComponent;

return exports;

}({}));
