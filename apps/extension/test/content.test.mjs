import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.listeners = new Map();
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this.title = '';
    this.disabled = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  contains(target) {
    return this.children.includes(target);
  }

  closest(selector) {
    if (selector === 'img' && this instanceof MockImageElement) {
      return this;
    }

    return null;
  }
}

class MockImageElement extends MockElement {
  constructor() {
    super('img');
    this.width = 300;
    this.height = 200;
    this.src = 'https://example.com/image.jpg';
    this.currentSrc = 'https://example.com/image.jpg';
    this.alt = 'Test image';
    this.rect = {
      top: 120,
      right: 1275,
      width: 300,
      height: 200
    };
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

function createDocument() {
  const listeners = new Map();
  const body = new MockElement('body');

  return {
    body,
    title: 'Fixture page',
    createElement(tagName) {
      const element = new MockElement(tagName);
      if (tagName === 'button') {
        Object.defineProperty(element, 'offsetWidth', {
          get() {
            return element.style.display === 'none' ? 0 : 96;
          }
        });
        Object.defineProperty(element, 'offsetHeight', {
          get() {
            return element.style.display === 'none' ? 0 : 32;
          }
        });
      }

      return element;
    },
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type, event) {
      const handlers = listeners.get(type) ?? [];
      for (const handler of handlers) {
        handler(event);
      }
    }
  };
}

test('inline save button stays inside the viewport when first shown', async () => {
  const sourcePath = path.resolve('src/content.js');
  const source = fs.readFileSync(sourcePath, 'utf8');

  const document = createDocument();
  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {}
  };

  const context = {
    chrome: {
      runtime: {
        async sendMessage() {
          return { ok: true };
        }
      }
    },
    console,
    document,
    Element: MockElement,
    HTMLImageElement: MockImageElement,
    location: { href: 'https://example.com/page' },
    window
  };

  vm.runInNewContext(source, context, { filename: sourcePath });

  const image = new MockImageElement();
  document.dispatch('mousemove', { target: image });

  const [button] = document.body.children;
  assert.ok(button, 'expected content script to append a button to the page');
  assert.equal(button.style.display, 'block');
  assert.equal(button.style.left, '1171px');
  assert.equal(button.style.top, '128px');
});
