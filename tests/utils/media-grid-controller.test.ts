import Masonry from 'masonry-layout';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaLoadedInfo } from '../../src/types';
import {
  MediaGridConstructorOptions,
  MediaGridController,
} from '../../src/utils/media-grid-controller';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../../src/utils/media-info';
import {
  createMutationObserverImplementation,
  createResizeObserverImplementation,
} from '../test-utils';

vi.mock('lodash-es/throttle', () => ({
  default: vi.fn((fn) => fn),
}));

const masonry = mock<Masonry>();
vi.mock('masonry-layout', () => ({
  default: vi.fn().mockImplementation(() => {
    return masonry;
  }),
}));

const createChildren = (childIDs?: string[], idAttribute?: string): HTMLElement[] => {
  const children: HTMLElement[] = [];
  for (let i = 0; i < (childIDs?.length ?? 3); ++i) {
    const child = document.createElement('div');
    if (childIDs) {
      child.setAttribute(idAttribute ?? 'grid-id', childIDs[i]);
    }
    children.push(child);
  }
  return children;
};

const setElementWidth = (element: HTMLElement, width: number): void => {
  element.getBoundingClientRect = vi.fn().mockReturnValue({
    width: width,
  });
};

const createHost = (options?: {
  children?: HTMLElement[];
  width?: number;
}): HTMLElement => {
  const host = document.createElement('div');
  if (options?.children) {
    host.append(...options.children);
  }
  // Default Lovelace card width is 492.
  setElementWidth(host, options?.width ?? 492);
  return host;
};

const createSlotParent = (): HTMLElement => {
  const parent = document.createElement('div');
  parent.attachShadow({ mode: 'open' });
  return parent;
};

const createSlotHost = (options?: {
  children?: HTMLElement[];
  parent?: HTMLElement;
}): HTMLElement => {
  const parent = options?.parent ?? createSlotParent();
  const slot = document.createElement('slot');
  parent.shadowRoot?.append(slot);

  if (options?.children) {
    // Children will automatically be slotted into the default slot.
    parent.append(...options.children);
  }

  return slot;
};

const createController = (host: HTMLElement, options?: MediaGridConstructorOptions) => {
  return new MediaGridController(host, options);
};

const triggerMutationObserver = (): void => {
  const mutationObserverTrigger = vi.mocked(global.MutationObserver).mock.calls[0][0];
  mutationObserverTrigger([], mock<MutationObserver>());
};

const triggerResizeObserver = (cellOrHost: 'cell' | 'host'): void => {
  const resizeObserverTrigger = vi.mocked(global.ResizeObserver).mock.calls[
    cellOrHost === 'cell' ? 0 : 1
  ][0];
  resizeObserverTrigger([], mock<ResizeObserver>());
};

// @vitest-environment jsdom
describe('MediaGridController', () => {
  const mediaLoadedInfo: MediaLoadedInfo = {
    width: 10,
    height: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    global.ResizeObserver = vi
      .fn()
      // Caution: Order must match the order of initialization in
      // media-grid-controller.ts .
      .mockImplementationOnce(createResizeObserverImplementation())
      .mockImplementationOnce(createResizeObserverImplementation());

    global.MutationObserver = vi
      .fn()
      .mockImplementation(createMutationObserverImplementation());
    //global.MutationObserver = mock<MutationObserver>();
  });

  it('should be constructable', () => {
    const controller = createController(createHost());
    expect(controller).toBeTruthy();
    expect(masonry.layout).toBeCalled();
  });

  it('should set grid contents correctly from regular elements', () => {
    const children = createChildren();
    const host = createHost({ children: children });
    const controller = createController(host);
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['0', children[0]],
        ['1', children[1]],
        ['2', children[2]],
      ]),
    );
    expect(controller.getGridSize()).toBe(3);
    expect(masonry.layout).toBeCalled();
  });

  it('should set grid contents correctly from slotted elements', () => {
    const children = createChildren();
    const host = createSlotHost({ children: children });
    const controller = createController(host);
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['0', children[0]],
        ['1', children[1]],
        ['2', children[2]],
      ]),
    );
    expect(controller.getGridSize()).toBe(3);
  });

  it('should select element', () => {
    const children = createChildren();
    const controller = createController(createSlotHost({ children: children }));

    // All children should be unselected.
    expect(controller.getSelected()).toBeNull();
    for (const child of children) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    // 1st child should now be selected.
    expect(children[0].getAttribute('selected')).toEqual('');
    expect(children[0].getAttribute('unselected')).toBeNull();

    // 2nd and 3rd should be unselected.
    for (const child of children.slice(1)) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }
  });

  it('should re-select element', () => {
    const controller = createController(createSlotHost({ children: createChildren() }));

    // All children should be unselected.
    expect(controller.getSelected()).toBeNull();

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');
  });

  it('should dispatch media loaded info on selection', () => {
    const children = createChildren();
    const host = createSlotHost({ children: children });
    const controller = createController(host);

    const mediaLoadedInfoHandler = vi.fn();
    host.addEventListener('frigate-card:media:loaded', mediaLoadedInfoHandler);
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    // Nothing is selected, so the event should not have propagated.
    expect(mediaLoadedInfoHandler).not.toBeCalled();

    controller.selectCell('0');
    expect(mediaLoadedInfoHandler).toBeCalledWith(
      expect.objectContaining({
        detail: mediaLoadedInfo,
      }),
    );
  });

  it('should unselect', () => {
    const children = createChildren();
    const host = createSlotHost({ children: children });
    const controller = createController(host);

    const unselectedHandler = vi.fn();
    const unloadMediaHandler = vi.fn();
    host.addEventListener('frigate-card:media-grid:unselected', unselectedHandler);
    host.addEventListener('frigate-card:media:unloaded', unloadMediaHandler);

    controller.selectCell('0');
    expect(controller.getSelected()).toBe('0');

    // Unselect all elements.
    controller.unselectAll();

    // Expect selected to now be null.
    expect(controller.getSelected()).toBeNull();

    // Expect styles to have been updated.
    for (const child of children) {
      expect(child.getAttribute('selected')).toBeNull();
      expect(child.getAttribute('unselected')).toEqual('');
    }

    // Expect handlers to have been called.
    expect(unselectedHandler).toBeCalled();
    expect(unloadMediaHandler).toBeCalled();
  });

  it('should select in constructor', () => {
    const children = createChildren();
    const host = createSlotHost({ children: children });
    const controller = createController(host, { selected: '2' });
    expect(controller.getSelected()).toBe('2');
  });

  it('should respect grid attribute option', () => {
    const children = createChildren(['one', 'two', 'three'], 'test-id');
    const host = createSlotHost({ children: children });
    const controller = createController(host, { idAttribute: 'test-id' });
    expect(controller.getGridContents()).toEqual(
      new Map([
        ['one', children[0]],
        ['two', children[1]],
        ['three', children[2]],
      ]),
    );
  });

  it('should destroy', () => {
    const children = createChildren();
    const host = createSlotHost({ children: children });
    const controller = createController(host);
    expect(controller.getGridSize()).toBe(3);
    controller.destroy();
    expect(controller.getGridSize()).toBe(0);
  });

  it('should replace children when they change', () => {
    const children = createChildren();
    const host = createHost({ children: children });
    const controller = createController(host, { selected: '1' });
    dispatchExistingMediaLoadedInfoAsEvent(children[0], mediaLoadedInfo);

    expect(controller.getSelected()).toBe('1');
    expect(controller.getGridSize()).toBe(3);

    children.forEach((child) => host.removeChild(child));
    const newChildren = createChildren(['one', 'two', 'three']);
    newChildren.forEach((child) => host.appendChild(child));

    triggerMutationObserver();

    expect(controller.getGridContents()).toEqual(
      new Map([
        ['one', newChildren[0]],
        ['two', newChildren[1]],
        ['three', newChildren[2]],
      ]),
    );
    expect(controller.getSelected()).toBeNull();
  });

  it('should construct masonry correctly', () => {
    const children = createChildren();
    const host = createHost({ children: children });
    createController(host);
    expect(Masonry).toBeCalledWith(
      host,
      expect.objectContaining({
        initLayout: false,
        percentPosition: true,
        transitionDuration: '0.3s',
      }),
    );
  });

  it('should set default column size correctly', () => {
    const host = createHost({ children: createChildren() });
    createController(host);
    expect(Masonry).toBeCalledWith(
      host,
      expect.objectContaining({
        columnWidth: 246,
      }),
    );
    expect(host.style.getPropertyValue('--frigate-card-grid-column-size')).toBe('246px');
  });

  it('should respect exact columns', () => {
    const host = createHost({ children: createChildren(), width: 2000 });
    const controller = createController(host);
    controller.setDisplayConfig({ mode: 'grid', grid_columns: 2 });

    // Will have been called once on construction, and then again when the
    // number of columns changes.
    expect(Masonry).toBeCalledTimes(2);
    expect(Masonry).toBeCalledWith(
      host,
      expect.objectContaining({
        columnWidth: 1000,
      }),
    );
    expect(host.style.getPropertyValue('--frigate-card-grid-column-size')).toBe(
      '1000px',
    );
  });

  it('should respect selected width factor', () => {
    const host = createHost({ children: createChildren(), width: 2000 });
    const controller = createController(host);
    controller.setDisplayConfig({ mode: 'grid', grid_selected_width_factor: 3 });
    expect(
      host.style.getPropertyValue('--frigate-card-grid-selected-width-factor'),
    ).toBe('3');
  });

  it('should select cell with interacted with', () => {
    const children = createChildren();
    const host = createHost({ children: children, width: 2000 });
    const controller = createController(host);

    expect(controller.getSelected()).toBeNull();

    const touchEvent = new TouchEvent('touchend');
    children[1].dispatchEvent(touchEvent);

    expect(controller.getSelected()).toBe('1');
  });

  it('should re-layout when child size changes', () => {
    createController(createHost({ children: createChildren() }));

    vi.mocked(masonry.layout)?.mockClear();
    triggerResizeObserver('cell');
    expect(masonry.layout).toBeCalled();
  });

  it('should re-create masonry when host size changes', () => {
    const children = createChildren();
    const host = createHost({ children: children });
    const controller = createController(host);
    expect(Masonry).toBeCalledWith(
      host,
      expect.objectContaining({
        columnWidth: 246,
      }),
    );
    expect(host.style.getPropertyValue('--frigate-card-grid-column-size')).toBe('246px');

    // Clear mock state.
    vi.mocked(Masonry).mockClear();
    vi.mocked(masonry.layout)?.mockClear();

    // Resize the host.
    setElementWidth(host, 2000);
    triggerResizeObserver('host');

    // Masonry should be reconstructed, styles set and layout called.
    expect(Masonry).toBeCalledWith(
      host,
      expect.objectContaining({
        columnWidth: 667,
      }),
    );
    expect(host.style.getPropertyValue('--frigate-card-grid-column-size')).toBe('667px');
    expect(masonry.layout).toBeCalled();
  });
});
