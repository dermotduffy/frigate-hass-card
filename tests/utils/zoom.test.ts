import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Zoom } from '../../src/utils/zoom/zoom';
import { PanzoomObject, PanzoomEventDetail } from '@dermotduffy/panzoom';
import Panzoom from '@dermotduffy/panzoom';
import { mock } from 'vitest-mock-extended';

vi.mock('@dermotduffy/panzoom');

// https://github.com/jsdom/jsdom/issues/2527
(window as any).PointerEvent = MouseEvent;

// @vitest-environment jsdom
describe('Zoom', () => {
  const mediaMediSpy = vi.spyOn(window, 'matchMedia');

  const createMockPanZoom = (): PanzoomObject => {
    const panzoom = mock<PanzoomObject>();
    panzoom.getScale.mockReturnValue(1.0);
    return panzoom;
  };

  const createAndRegisterZoom = (element: HTMLElement): Zoom => {
    const zoom = new Zoom(element);
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
    const zoom = new Zoom(element);
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
});
