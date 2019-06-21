import {
  HTMLAttributes,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { UserInteractionMode } from "@react-md/states/types/useModeDetection";
import { useRefCache, useTimeout } from "@react-md/utils";

import {
  useTooltipHoverModeActions,
  useTooltipHoverModeDelay,
  useTooltipHoverModeEnabled,
} from "./useTooltipHoverMode";

export type TooltipInitiated = UserInteractionMode | null;

interface HandlersBaseOptions {
  mode: UserInteractionMode;
  showTooltip: () => void;
  hideTooltip: () => void;
  /**
   * This is _normally_ triggered at when a timeout starts to help determine what the
   * animation position for the tooltip should be. If this isn't set before the animation
   * starts, the tooltip will animate weirdly.
   */
  setEstimatedPosition: (container: HTMLElement) => void;

  /**
   * The type of interaction that initiated the tooltip. When this value is `null`,
   * the tooltip hasn't been initiated yet and _should_ not be visible within the
   * page as well.
   *
   * When this is set to "window", it means that the tooltip was visible when the entire
   * window was blurred. Check out the keyboard `onFocus` comment for more info about
   * this flow.
   */
  initiated: MutableRefObject<TooltipInitiated>;

  /**
   * A small callback that will set the current initiation type for the tooltip.
   */
  setInitiated: (mode: TooltipInitiated) => void;

  /**
   * The amount of delay to wait before showing the tooltip for the mouse and keyboard
   * flows. In the touch flow, this is the amount of time before the tooltip will hide
   * after the user releases their finger from the phone.
   */
  delay: number;
}

type MergableMouseHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  "onMouseEnter" | "onMouseLeave"
>;

interface MouseOptions extends MergableMouseHandlers, HandlersBaseOptions {
  disableHoverMode?: boolean;
}

type MergableKeyboardHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  "onFocus" | "onBlur" | "onKeyDown"
>;

interface KeyboardOptions
  extends MergableKeyboardHandlers,
    HandlersBaseOptions {}

type MergableTouchHandlers = Pick<
  HTMLAttributes<HTMLElement>,
  "onTouchStart" | "onTouchMove" | "onContextMenu"
>;

interface TouchOptions extends MergableTouchHandlers, HandlersBaseOptions {
  visible: boolean;
}

export type MergableHandlers = MergableMouseHandlers &
  MergableKeyboardHandlers &
  MergableTouchHandlers;

/**
 * This handles creating and returning the required mouse event listeners
 * to show and hide tooltips as needed. If there were any mouse event listeners
 * passed in, they will be merged with the tooltip logic automatically and
 * memoized.
 */
export function useMouseState({
  mode,
  showTooltip,
  hideTooltip,
  initiated,
  setInitiated,
  delay: propDelay,
  onMouseEnter,
  onMouseLeave,
  setEstimatedPosition,
  disableHoverMode,
}: MouseOptions) {
  const handlers = useRefCache({ onMouseEnter, onMouseLeave });

  let isHoverModeable = useTooltipHoverModeEnabled();
  if (typeof disableHoverMode === "boolean") {
    isHoverModeable = !disableHoverMode;
  }

  let delay = useTooltipHoverModeDelay();
  if (!isHoverModeable) {
    delay = propDelay;
  }

  const hoverModeActions = useTooltipHoverModeActions();

  const { start, stop } = useTimeout(() => {
    if (initiated.current === "mouse") {
      showTooltip();

      if (isHoverModeable) {
        hoverModeActions.enable();
      }
    }
  }, delay);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const { onMouseEnter } = handlers.current;
      if (onMouseEnter) {
        onMouseEnter(event);
      }

      if (initiated.current !== null) {
        return;
      }

      setInitiated("mouse");
      setEstimatedPosition(event.currentTarget);
      start();
    },
    []
  );

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const { onMouseLeave } = handlers.current;
      if (onMouseLeave) {
        onMouseLeave(event);
      }

      if (initiated.current !== "mouse") {
        return;
      }

      stop();
      hideTooltip();
      if (isHoverModeable) {
        hoverModeActions.startDisableTimer();
      }
    },
    [isHoverModeable]
  );

  return {
    stopMouseTimer: stop,
    mouseHandlers: {
      // the mouse flows should not be returned for the touch mode since
      // the mouseenter event is still triggered after a touch
      onMouseEnter: mode !== "touch" ? handleMouseEnter : onMouseEnter,
      onMouseLeave: mode !== "touch" ? handleMouseLeave : onMouseLeave,
    },
  };
}

/**
 * This handles creating and returning the required keyboard event listeners
 * to show and hide tooltips as needed. If there were any keyboard event listeners
 * passed in, they will be merged with the tooltip logic automatically and
 * memoized.
 */
export function useKeyboardState({
  mode,
  showTooltip,
  hideTooltip,
  delay,
  initiated,
  setInitiated,
  onFocus,
  onBlur,
  onKeyDown,
  setEstimatedPosition,
}: KeyboardOptions) {
  const handlers = useRefCache({ onFocus, onBlur, onKeyDown });
  const isWindowBlurred = useRef(false);

  const { start, stop } = useTimeout(() => {
    if (initiated.current === "keyboard") {
      showTooltip();
    }
  }, delay);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const { onFocus } = handlers.current;
    if (onFocus) {
      onFocus(event);
    }

    // if the entire browser window was blurred, we don't want to show the tooltip
    // on the next focus event since it is confusing to see a tooltip appear again
    // after re-focusing a window.
    if (isWindowBlurred.current) {
      isWindowBlurred.current = false;
      return;
    }

    setInitiated("keyboard");
    setEstimatedPosition(event.currentTarget);
    start();
  }, []);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const { onBlur } = handlers.current;
    if (onBlur) {
      onBlur(event);
    }

    stop();
    hideTooltip();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const { onKeyDown } = handlers.current;
      if (onKeyDown) {
        onKeyDown(event);
      }

      if (initiated.current === "keyboard" && event.key === "Escape") {
        stop();
        hideTooltip();
      }
    },
    []
  );

  useEffect(() => {
    if (mode !== "keyboard") {
      return;
    }

    // whenever the browser loses focus, need to ensure that when the browser is re-focused
    // the last focused element (that had a tooltip) does not make the tooltip appear
    const handleWindowBlur = () => {
      if (document.hidden) {
        isWindowBlurred.current = true;
        hideTooltip();
      } else {
        window.requestAnimationFrame(() => {
          isWindowBlurred.current = false;
        });
      }
    };

    window.addEventListener("visibilitychange", handleWindowBlur);
    return () => {
      window.removeEventListener("visibilitychange", handleWindowBlur);
    };
  }, [mode, hideTooltip]);

  return {
    stopKeyboardTimer: stop,
    keyboardHandlers: {
      onFocus: mode === "keyboard" ? handleFocus : onFocus,
      onBlur: mode === "keyboard" ? handleBlur : onBlur,
      onKeyDown: mode === "keyboard" ? handleKeyDown : onKeyDown,
    },
  };
}

/**
 * This handles creating and returning the required touch event listeners
 * to show and hide tooltips as needed. If there were any touch event listeners
 * passed in, they will be merged with the tooltip logic automatically and
 * memoized.
 *
 * Tooltips on touch devices are a bit different than mouse and keyboard. Since tooltips
 * appear after a long press on mobile and long presses on mobile cause a context menu
 * to appear, no timeouts for showing the tooltip are started after a touchstart event.
 * The tooltip will only appear after a contextmenu event which has the default behavior
 * prevented so the tooltip appears instead. After the tooltip appears, it will stay
 * visible as long as the user keeps their finter on their phone. Once they remove their
 * finger, the tooltip will be visible for another `x`ms to make it easier to read without
 * their finter in the way and finally hide.
 */
export function useTouchState({
  mode,
  visible,
  showTooltip,
  hideTooltip,
  delay,
  setInitiated,
  onTouchStart,
  onTouchMove,
  onContextMenu,
  setEstimatedPosition,
}: TouchOptions) {
  const touched = useRef(false);
  const handlers = useRefCache({ onTouchStart, onTouchMove, onContextMenu });

  const { start, stop } = useTimeout(() => {
    touched.current = false;
    hideTooltip();
  }, delay);

  useEffect(() => {
    if (!visible) {
      return;
    } else if (mode !== "touch") {
      touched.current = false;
      return;
    }

    const cb = () => {
      start();
      window.removeEventListener("touchend", cb, true);
    };

    window.addEventListener("touchend", cb, true);
    return () => {
      window.removeEventListener("touchend", cb, true);
    };
  }, [visible, mode]);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const { onTouchStart } = handlers.current;
      if (onTouchStart) {
        onTouchStart(event);
      }

      touched.current = true;
      stop();
      setEstimatedPosition(event.currentTarget);
    },
    []
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const { onTouchMove } = handlers.current;
      if (onTouchMove) {
        onTouchMove(event);
      }

      touched.current = false;
    },
    []
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const { onContextMenu } = handlers.current;
      if (onContextMenu) {
        onContextMenu(event);
      }

      if (!touched.current) {
        return;
      }

      // need to prevent the context menu from appearing and instead show the tooltip
      event.preventDefault();

      // since the context menu might also select text by default, we want to deselect any
      // selected text if it is within the container element
      const selection = window.getSelection();
      const selectionNode =
        selection && selection.anchorNode && selection.anchorNode.parentElement;
      if (
        selection &&
        selectionNode &&
        event.currentTarget.contains(selectionNode)
      ) {
        selection.empty();
      }

      setInitiated("touch");
      showTooltip();
    },
    []
  );

  return {
    stopTouchTimer: stop,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onContextMenu: mode === "touch" ? handleContextMenu : onContextMenu,
    },
  };
}
