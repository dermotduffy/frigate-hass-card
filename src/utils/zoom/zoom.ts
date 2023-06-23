import Panzoom, { PanzoomEventDetail, PanzoomObject } from '@dermotduffy/panzoom';
import round from 'lodash-es/round';
import { dispatchFrigateCardEvent, isHoverableDevice } from '../basic';

export class Zoom {
  constructor(element: HTMLElement) {
    this._element = element;
  }

  protected _element: HTMLElement;
  protected _panzoom?: PanzoomObject;
  protected _zoomed = false;
  protected _allowClick = true;

  protected _events = isHoverableDevice()
    ? {
        down: ['pointerdown'],
        move: ['pointermove'],
        up: ['pointerup', 'pointerleave', 'pointercancel'],
      }
    : {
        down: ['touchstart'],
        move: ['touchmove'],
        up: ['touchend', 'touchcancel'],
      };

  protected _downHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._panzoom?.handleDown(ev as PointerEvent);
      ev.stopPropagation();

      // If we do not prevent default here, the media carousels scroll.
      ev.preventDefault();
      this._allowClick = false;
    } else {
      this._allowClick = true;
    }
  };

  protected _clickHandler = (ev: Event) => {
    // When mouse clicking is used to pan, need to avoid that causing a click
    // handler elsewhere in the card being called. Example: Viewing a snapshot,
    // and panning within it should not cause a related clip to play (the click
    // handler in the viewer).
    if (!this._allowClick) {
      ev.stopPropagation();
    }
    this._allowClick = true;
  };

  protected _moveHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._panzoom?.handleMove(ev as PointerEvent);
      ev.stopPropagation();
    }
  };

  protected _upHandler = (ev: Event) => {
    if (this._shouldZoomOrPan(ev)) {
      this._panzoom?.handleUp(ev as PointerEvent);
      ev.stopPropagation();
    }
  };

  protected _wheelHandler = (ev: Event) => {
    if (ev instanceof WheelEvent && this._shouldZoomOrPan(ev)) {
      this._panzoom?.zoomWithWheel(ev);
      ev.stopPropagation();
    }
  };

  protected _isScaleNormal(scale?: number): boolean {
    // Floating point arithmetic warning: comparing floating point numbers,
    // round them first.
    return scale !== undefined && round(scale, 4) <= 1;
  }

  protected _shouldZoomOrPan(ev: Event): boolean {
    return (
      !this._isScaleNormal(this._panzoom?.getScale()) ||
      // TouchEvent does not exist on Firefox on non-touch events.
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/1174
      (window.TouchEvent && ev instanceof TouchEvent && ev.touches.length > 1) ||
      (ev instanceof WheelEvent && ev.ctrlKey)
    );
  }

  protected _setTouchAction(touchEnabled: boolean): void {
    this._element.style.touchAction = touchEnabled ? '' : 'none';
  }

  public activate(): void {
    this._panzoom = Panzoom(this._element, {
      contain: 'outside',
      maxScale: 10,
      minScale: 1,
      noBind: true,
      // Do not force the cursor style (by default it will always show the
      // 'move' type cursor whether or not it is zoomed in).
      cursor: undefined,

      // Disable automatic touchAction setting from Panzoom() as otherwise it
      // effectively disables dashboard scrolling.
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/1181
      touchAction: '',
    });

    const registerListeners = (
      events: string[],
      func: (ev: Event) => void,
      options?: AddEventListenerOptions,
    ) => {
      events.forEach((eventName) => {
        this._element.addEventListener(eventName, func, options);
      });
    };

    registerListeners(this._events['down'], this._downHandler, { capture: true });
    registerListeners(this._events['move'], this._moveHandler, { capture: true });
    registerListeners(this._events['up'], this._upHandler, { capture: true });
    registerListeners(['wheel'], this._wheelHandler);
    registerListeners(['click'], this._clickHandler, { capture: true });

    this._element.addEventListener('panzoomzoom', (ev: Event) => {
      // Take care here to only dispatch the zoomed/unzoomed events when the
      // absolute state changes (rather than on every single zoom adjustment).
      if (this._isScaleNormal((<CustomEvent<PanzoomEventDetail>>ev).detail.scale)) {
        if (this._zoomed) {
          this._setTouchAction(true);
          dispatchFrigateCardEvent(this._element, 'zoom:unzoomed');
        }
        this._zoomed = false;
      } else {
        if (!this._zoomed) {
          this._setTouchAction(false);
          dispatchFrigateCardEvent(this._element, 'zoom:zoomed');
        }
        this._zoomed = true;
      }
    });
  }

  public deactivate(): void {
    const unregisterListener = (events: string[], func: (ev: Event) => void) => {
      events.forEach((eventName) => {
        this._element.removeEventListener(eventName, func);
      });
    };

    unregisterListener(this._events['down'], this._downHandler);
    unregisterListener(this._events['move'], this._moveHandler);
    unregisterListener(this._events['up'], this._upHandler);
    unregisterListener(['wheel'], this._wheelHandler);
  }
}
