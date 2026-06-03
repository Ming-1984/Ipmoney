export function classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

function defineProperties(target, props) {
  for (let i = 0; i < props.length; i += 1) {
    const descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ('value' in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

export function createClass(Constructor, protoProps, staticProps) {
  if (protoProps) defineProperties(Constructor.prototype, protoProps);
  if (staticProps) defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, 'prototype', { writable: false });
  return Constructor;
}

export function defineProperty(obj, key, value) {
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return obj;
}

export function createForOfIteratorHelper(iterable, allowArrayLike = false) {
  let iterator;
  if (typeof Symbol !== 'undefined' && iterable != null && iterable[Symbol.iterator] != null) {
    iterator = iterable[Symbol.iterator]();
  } else if (Array.isArray(iterable) || (allowArrayLike && iterable && typeof iterable.length === 'number')) {
    let index = 0;
    iterator = {
      next() {
        if (!iterable || index >= iterable.length) return { done: true };
        return { done: false, value: iterable[index++] };
      },
    };
  } else {
    throw new TypeError('Invalid attempt to iterate non-iterable instance.');
  }

  let normalCompletion = true;
  let didErr = false;
  let err;

  return {
    s() {},
    n() {
      const step = iterator.next();
      normalCompletion = step.done;
      return step;
    },
    e(e) {
      didErr = true;
      err = e;
    },
    f() {
      try {
        if (!normalCompletion && iterator && typeof iterator.return === 'function') {
          iterator.return();
        }
      } finally {
        if (didErr) throw err;
      }
    },
  };
}

