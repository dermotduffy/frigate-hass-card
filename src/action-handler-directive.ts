import { fireEvent } from 'custom-card-helpers';
import type {
  ActionHandlerDetail,
  ActionHandlerOptions,
} from 'custom-card-helpers/dist/types.d.js';
import { noChange } from 'lit';
import {
  AttributePart,
  directive,
  Directive,
  DirectiveParameters,
} from 'lit/directive.js';
import { stopEventFromActivatingCardWideActions } from './utils/action.js';
import { Timer } from './utils/timer.js';

interface ActionHandler extends HTMLElement {
  holdTime: number;
  bind(element: Element, options): void;
}
interface ActionHandlerElement extends HTMLElement {
  actionHandlerOptions?: FrigateCardActionHandlerOptions;
}

interface FrigateCardActionHandlerOptions extends ActionHandlerOptions {
  allowPropagation?: boolean;
}

class ActionHandler extends HTMLElement implements ActionHandler {
  public holdTime = 0.4;

  protected holdTimer = new Timer();
  protected doubleClickTimer = new Timer();

  protected held = false;

  public connectedCallback(): void {
    [
      'touchcancel',
      'mouseout',
      'mouseup',
      'touchmove',
      'mousewheel',
      'wheel',
      'scroll',
    ].forEach((ev) => {
      document.addEventListener(
        ev,
        () => {
          this.holdTimer.stop();
        },
        { passive: true },
      );
    });
  }

  public bind(element: ActionHandlerElement, options): void {
    if (element.actionHandlerOptions) {
      // Reset the options on an existing actionHandler.
      element.actionHandlerOptions = options;
      return;
    }
    element.actionHandlerOptions = options;

    element.addEventListener('contextmenu', (ev: Event) => {
      const e = ev || window.event;
      if (e.preventDefault) {
        e.preventDefault();
      }
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      e.cancelBubble = true;
      e.returnValue = false;
      return false;
    });

    const start = (): void => {
      this.held = false;
      this.holdTimer.start(this.holdTime, () => {
        this.held = true;
      });

      fireEvent(element, 'action', { action: 'start_tap' });
    };

    const end = (ev: Event): void => {
      const options = element.actionHandlerOptions;
      if (!options?.allowPropagation) {
        // This will ensure only 1 actionHandler is invoked for a given interaction.
        stopEventFromActivatingCardWideActions(ev);
      }

      if (
        ['touchend', 'touchcancel'].includes(ev.type) &&
        // This action handler by default relies on synthetic click events for
        // touch devices, in order to ensure that embedded cards (e.g. WebRTC)
        // can use stock click handlers. The exception is for hold events.
        !this.held
      ) {
        return;
      }

      this.holdTimer.stop();

      fireEvent(element, 'action', { action: 'end_tap' });

      if (options?.hasHold && this.held) {
        fireEvent(element, 'action', { action: 'hold' });
      } else if (options?.hasDoubleClick) {
        if (
          (ev.type === 'click' && (ev as MouseEvent).detail < 2) ||
          !this.doubleClickTimer.isRunning()
        ) {
          this.doubleClickTimer.start(0.25, () =>
            fireEvent(element, 'action', { action: 'tap' }),
          );
        } else {
          this.doubleClickTimer.stop();
          fireEvent(element, 'action', { action: 'double_tap' });
        }
      } else {
        fireEvent(element, 'action', { action: 'tap' });
      }
    };

    const handleEnter = (ev: KeyboardEvent): void => {
      if (ev.key === 'Enter') {
        end(ev);
      }
    };

    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);

    element.addEventListener('mousedown', start, { passive: true });
    element.addEventListener('click', end);

    element.addEventListener('keyup', handleEnter);
  }
}

customElements.define('action-handler-frigate-card', ActionHandler);

const getActionHandler = (): ActionHandler => {
  const body = document.body;
  if (body.querySelector('action-handler-frigate-card')) {
    return body.querySelector('action-handler-frigate-card') as ActionHandler;
  }

  const actionhandler = document.createElement('action-handler-frigate-card');
  body.appendChild(actionhandler);

  return actionhandler as ActionHandler;
};

const actionHandlerBind = (
  element: ActionHandlerElement,
  options?: FrigateCardActionHandlerOptions,
): void => {
  const actionhandler: ActionHandler = getActionHandler();
  if (!actionhandler) {
    return;
  }
  actionhandler.bind(element, options);
};

export const actionHandler = directive(
  class extends Directive {
    update(part: AttributePart, [options]: DirectiveParameters<this>) {
      actionHandlerBind(part.element as ActionHandlerElement, options);
      return noChange;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    render(_options?: FrigateCardActionHandlerOptions) {}
  },
);

declare global {
  interface HTMLElementTagNameMap {
    'action-handler-frigate-card': ActionHandler;
  }
  interface HASSDomEvents {
    action: ActionHandlerDetail;
  }
}
