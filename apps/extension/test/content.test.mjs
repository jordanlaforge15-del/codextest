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
    if (this.children.includes(target)) {
      return true;
    }

    return this.children.some((child) => child.contains?.(target));
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
  const documentElement = new MockElement('html');

  return {
    body,
    documentElement,
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
  document.dispatch('mousemove', { target: image, isTrusted: true });

  const [button] = document.body.children;
  assert.ok(button, 'expected content script to append a button to the page');
  assert.equal(button.style.display, 'block');
  assert.equal(button.style.left, '1171px');
  assert.equal(button.style.top, '128px');
});

test('synthetic hover and click events do not trigger inline saves', async () => {
  const sourcePath = path.resolve('src/content.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const document = createDocument();
  const sentMessages = [];
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
        async sendMessage(message) {
          sentMessages.push(message);
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
  document.dispatch('mousemove', { target: image, isTrusted: false });

  const [button] = document.body.children;
  assert.ok(button, 'expected button to mount');
  assert.equal(button.style.display, 'none');

  for (const listener of button.listeners.get('click') ?? []) {
    await listener({ isTrusted: false });
  }

  assert.equal(sentMessages.length, 0);
});

test('content script mounts without body and falls back to documentElement', async () => {
  const sourcePath = path.resolve('src/content.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const document = createDocument();
  document.body = null;
  const sentMessages = [];
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
        async sendMessage(message) {
          sentMessages.push(message);
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

  assert.equal(document.documentElement.children.length, 1);

  const image = new MockImageElement();
  document.dispatch('contextmenu', { target: image });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].type, 'IMAGE_CONTEXT_UPDATED');
});

test('inline save button is disabled on app pages while context menu updates still work', async () => {
  const sourcePath = path.resolve('src/content.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const document = createDocument();
  const sentMessages = [];
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
    URL,
    chrome: {
      runtime: {
        async sendMessage(message) {
          sentMessages.push(message);
          return { ok: true };
        }
      }
    },
    console,
    document,
    Element: MockElement,
    HTMLImageElement: MockImageElement,
    location: { href: 'http://localhost:3000/workspaces/test-workspace' },
    window
  };

  vm.runInNewContext(source, context, { filename: sourcePath });

  assert.equal(document.body.children.length, 0);

  const image = new MockImageElement();
  document.dispatch('mousemove', { target: image, isTrusted: true });
  assert.equal(document.body.children.length, 0);

  document.dispatch('contextmenu', { target: image });
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].type, 'IMAGE_CONTEXT_UPDATED');
});
