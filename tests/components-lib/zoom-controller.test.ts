import Panzoom, { PanzoomEventDetail, PanzoomObject } from '@dermotduffy/panzoom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ZoomController } from '../../src/components-lib/zoom-controller';

vi.mock('@dermotduffy/panzoom');

// https://github.com/jsdom/jsdom/issues/2527
(window as any).PointerEvent = MouseEvent;

// @vitest-environment jsdom
describe('ZoomController', () => {
  const mediaMediSpy = vi.spyOn(window, 'matchMedia');

  const createMockPanZoom = (): PanzoomObject => {
    const panzoom = mock<PanzoomObject>();
    panzoom.getScale.mockReturnValue(1.0);
    return panzoom;
  };

  const createAndRegisterZoom = (element: HTMLElement): ZoomController => {
    const zoom = new ZoomController(element);
    zoom.activate();
    return zoom;
  };

  const createTouch = (target: HTMLElement): Touch => {
    return {
      clientX: 0,
      clientY: 0,
      force: 0,
      identifier: 0,
      pageX: 0,
      pageY: 0,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      screenX: 0,
      screenY: 0,
      target: target,
    };
  };

  beforeEach(() => {
    mediaMediSpy.mockReturnValue(<MediaQueryList>{ matches: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be creatable', () => {
    const element = document.createElement('div');
    const zoom = new ZoomController(element);
    expect(zoom).toBeTruthy();
  });

  it('should respond with pointer', () => {
    const element = document.createElement('div');

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element);

    // Won't zoom without control key.
    const ev_1 = new WheelEvent('wheel', { bubbles: false, deltaY: -120 });
    element.dispatchEvent(ev_1);
    expect(panzoom.zoomWithWheel).not.toBeCalled();

    const ev_2 = new WheelEvent('wheel', {
      bubbles: false,
      deltaY: -120,
      ctrlKey: true,
    });
    element.dispatchEvent(ev_2);
    expect(panzoom.zoomWithWheel).toBeCalledWith(ev_2);

    panzoom.getScale = vi.fn().mockReturnValue(1.2);

    const ev_3 = new PointerEvent('pointerdown');
    element.dispatchEvent(ev_3);
    expect(panzoom.handleDown).toBeCalledWith(ev_3);

    const ev_4 = new PointerEvent('pointermove');
    element.dispatchEvent(ev_4);
    expect(panzoom.handleMove).toBeCalledWith(ev_4);

    const ev_5 = new PointerEvent('pointerup');
    element.dispatchEvent(ev_5);
    expect(panzoom.handleUp).toBeCalledWith(ev_5);
  });

  it('should not respond to pointer when not zoomed', () => {
    const element = document.createElement('div');

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element);

    const ev_1 = new PointerEvent('pointerdown');
    element.dispatchEvent(ev_1);
    expect(panzoom.handleDown).not.toBeCalledWith(ev_1);

    const ev_2 = new PointerEvent('pointermove');
    element.dispatchEvent(ev_2);
    expect(panzoom.handleDown).not.toBeCalledWith(ev_2);

    const ev_3 = new PointerEvent('pointerup');
    element.dispatchEvent(ev_3);
    expect(panzoom.handleDown).not.toBeCalledWith(ev_3);
  });

  it('should respond with touch', () => {
    mediaMediSpy.mockReturnValue(<MediaQueryList>{ matches: false });

    const element = document.createElement('div');

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element);

    const ev_1 = new TouchEvent('touchstart', {
      bubbles: false,
      touches: [createTouch(element), createTouch(element)],
    });
    element.dispatchEvent(ev_1);
    expect(panzoom.handleDown).toBeCalledWith(ev_1);

    panzoom.getScale = vi.fn().mockReturnValue(1.2);

    const ev_3 = new TouchEvent('touchstart');
    element.dispatchEvent(ev_3);
    expect(panzoom.handleDown).toBeCalledWith(ev_3);

    const ev_4 = new TouchEvent('touchmove');
    element.dispatchEvent(ev_4);
    expect(panzoom.handleMove).toBeCalledWith(ev_4);

    const ev_5 = new TouchEvent('touchend');
    element.dispatchEvent(ev_5);
    expect(panzoom.handleUp).toBeCalledWith(ev_5);
  });

  it('should ignore click after pointerdown', () => {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(inner);
    const clickHandler = vi.fn();
    outer.addEventListener('click', clickHandler);

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(inner);

    // Simulate being zoomed in.
    panzoom.getScale = vi.fn().mockReturnValue(1.2);

    // A click on its own will be fine.
    const click_1 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_1);
    expect(clickHandler).toBeCalledTimes(1);

    // A click after a pointerdown will be ignored.
    const pointerdown_1 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_1);

    const click_2 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_2);

    // Click will have been ignored.
    expect(clickHandler).toBeCalledTimes(1);

    // Simulate being zoomed out.
    panzoom.getScale = vi.fn().mockReturnValue(1.0);
    const pointerdown_2 = new PointerEvent('pointerdown');
    inner.dispatchEvent(pointerdown_2);

    const click_3 = new MouseEvent('click', { bubbles: true });
    inner.dispatchEvent(click_3);

    // Click will have been processed.
    expect(clickHandler).toBeCalledTimes(2);
  });

  it('deactivate should remove event handlers', () => {
    const element = document.createElement('div');

    const panzoom = createMockPanZoom();
    vi.mocked(Panzoom).mockReturnValueOnce(panzoom);

    createAndRegisterZoom(element).deactivate();

    const ev_1 = new WheelEvent('wheel', {
      bubbles: false,
      deltaY: -120,
      ctrlKey: true,
    });
    element.dispatchEvent(ev_1);
    expect(panzoom.zoomWithWheel).not.toBeCalled();
  });

  it('should fire frigate cards on zoom/unzoom', () => {
    const element = document.createElement('div');

    const zoomedFunc = vi.fn();
    const unzoomedFunc = vi.fn();

    element.addEventListener('frigate-card:zoom:zoomed', zoomedFunc);
    element.addEventListener('frigate-card:zoom:unzoomed', unzoomedFunc);

    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    createAndRegisterZoom(element);

    const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1.2,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_1);
    expect(zoomedFunc).toBeCalled();
    expect(unzoomedFunc).not.toBeCalled();

    const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_2);
    expect(unzoomedFunc).toBeCalled();
  });

  it('should set touch action on zoom/unzoom', () => {
    const element = document.createElement('div');
    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    createAndRegisterZoom(element);

    const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1.2,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_1);
    expect(element.style.touchAction).toBe('none');

    const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_2);
    expect(element.style.touchAction).toBeFalsy();
  });

  it('should not fire frigate cards when state has not changed or spurious events received', () => {
    const element = document.createElement('div');

    const zoomedFunc = vi.fn();
    const unzoomedFunc = vi.fn();

    element.addEventListener('frigate-card:zoom:zoomed', zoomedFunc);
    element.addEventListener('frigate-card:zoom:unzoomed', unzoomedFunc);

    vi.mocked(Panzoom).mockReturnValueOnce(createMockPanZoom());

    createAndRegisterZoom(element);

    const ev_1 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_1);

    // Unzoomed event with scale === 1, this._zoomed will already be false.
    expect(unzoomedFunc).not.toBeCalled();
    expect(zoomedFunc).not.toBeCalled();

    const ev_2 = new CustomEvent<PanzoomEventDetail>('panzoomzoom', {
      detail: {
        x: 0,
        y: 0,
        scale: 1.2,
        isSVG: false,
        originalEvent: new PointerEvent('pointermove'),
      },
    });
    element.dispatchEvent(ev_2);
    expect(zoomedFunc).toBeCalledTimes(1);
    expect(unzoomedFunc).not.toBeCalled();

    // Another call when already zoomed will be ignored.
    element.dispatchEvent(ev_2);
    expect(zoomedFunc).toBeCalledTimes(1);
  });
});
