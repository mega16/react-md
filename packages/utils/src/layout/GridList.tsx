import React, {
  FC,
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import cn from "classnames";

import applyRef from "../applyRef";
import bem from "../css/bem";
import useResizeObserver from "../sizing/useResizeObserver";
import { WithForwardedRef } from "../types";
import getScrollbarWidth from "./scrollbarWidth";

/**
 * This is the css variable that is used store the current size of each cell.
 */
export const CELL_SIZE_VAR = "--rmd-cell-size";

/**
 * This is the css variable that is used store the current margin of each cell.
 */
export const CELL_MARGIN_VAR = "--rmd-cell-margin";

export interface GridListSize {
  /**
   * The current number of columns in the `GridList`.
   */
  columns: number;

  /**
   * The current width of each cell within the grid.
   */
  cellWidth: number;
}

/**
 * The children render function that will be provided the current grid list size object and should
 * return renderable elements.
 *
 * Note: The first time this is called, the `columns` and `cellWidth` will be the `defaultSize`.
 * Once the `GridList` has been fully mounted in the DOM, it will begin the sizing calculations
 * and update with the "real" values. This doesn't cause any problems if you are only rendering
 * client side, but it might mess up server-side rendering, so it is recommended to update the
 * `defaultSize` when server-side rendering if this can be "known" service-side in your app.
 */
export type RenderGridListChildren = (size: GridListSize) => ReactNode;

export interface GridListProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * An optional margin to apply to each cell as the `CELL_MARGIN_VAR` css variable only when
   * it is defined. This has to be a number string with a `px`, `em`, `rem` or `%` suffix or
   * else the grid will break.
   */
  cellMargin?: string;

  /**
   * The max size that each cell can be.
   */
  maxCellSize?: number;

  /**
   * Since the `GridList` requires being fully rendered in the DOM to be able to correctly calculate
   * the number of `columns` and `cellWidth`, this _might_ cause problems when server-side rendering when
   * using the children renderer to create a grid list dynamically based on the number of columns. If
   * the number of columns and default `cellWidth` can be guessed server-side, you should provide this
   * prop. Otherwise it will be: `{ cellSize; maxCellSize, columns: -1 }`
   */
  defaultSize?: GridListSize | (() => GridListSize);

  /**
   * This is _normally_ the amount of padding on the grid list item itself to subtract from
   * the `offsetWidth` since `padding`, `border`, and vertical scrollbars will be included.
   * If you add a border or change the padding or add borders to this component, you'll need
   * to update the `containerPadding` to be the new number.
   */
  containerPadding?: number;

  /**
   * Boolean if the current scrollbar width should no longer be subtracted from the total width
   * of the grid list. This should only be disabled if your `containerPadding` is updated to
   * include scrollbar width as well since it'll mess up the grid on OSes that display scrollbars.
   */
  disableScrollbarWidth?: boolean;

  /**
   * Boolean if the resize observer should stop tracking width changes within the `GridList`. This
   * should normally stay as `false` since tracking width changes will allow for dynamic content
   * being added to the list to not mess up the grid calculation when the user is on an OS that shows
   * scrollbars.
   */
  disableHeightObserver?: boolean;

  /**
   * Boolean if the resize observer should stop tracking width changes within the `GridList`. This
   * should normally stay as `false` since tracking width changes will allow for dynamic content
   * being added to the list to not mess up the grid calculation when the user is on an OS that shows
   * scrollbars.
   */
  disableWidthObserver?: boolean;

  /**
   * The children to display within the grid list. This can either be a callback function that will
   * provide the current calculated width for each cell that should return renderable elements or any
   * renderable elements that are sized with the `--rmd-cell-width` css variable.
   */
  children: ReactNode | RenderGridListChildren;
}

type WithRef = WithForwardedRef<HTMLDivElement>;
type DefaultProps = Required<
  Pick<
    GridListProps,
    | "maxCellSize"
    | "containerPadding"
    | "disableHeightObserver"
    | "disableWidthObserver"
  >
>;
type WithDefaultProps = GridListProps & DefaultProps & WithRef;
type CSSProperties = React.CSSProperties & {
  [CELL_SIZE_VAR]: string;
  [CELL_MARGIN_VAR]?: string;
};

const block = bem("rmd-grid-list");

/**
 * The `GridList` component is a different way to render a list of data where the number of columns
 * is dynamic and based on the max-width for each cell. Instead of setting a percentage width to each
 * cell based on the number of columns, this will dynamically add columns to fill up the remaining
 * space and have each cell grow up to a set max-width. A really good use-case for this is displaying
 * a list of images or thumbnails and allowing the user to see a full screen preview once selected/clicked.
 */
const GridList: FC<GridListProps & WithRef> = providedProps => {
  const {
    style,
    className,
    children,
    cellMargin,
    maxCellSize,
    forwardedRef,
    defaultSize,
    containerPadding,
    disableHeightObserver,
    disableWidthObserver,
    ...props
  } = providedProps as WithDefaultProps;

  const [gridSize, setGridSize] = useState(
    defaultSize || { columns: -1, cellWidth: maxCellSize }
  );
  const ref = useRef<HTMLDivElement | null>(null);
  const recalculate = useCallback(() => {
    if (!ref.current) {
      return;
    }

    let width = ref.current.offsetWidth - containerPadding;
    if (ref.current.offsetHeight < ref.current.scrollHeight) {
      width -= getScrollbarWidth();
    }

    const columns = Math.ceil(width / maxCellSize);
    setGridSize({
      cellWidth: width / columns,
      columns,
    });
  }, [maxCellSize, containerPadding]);

  const refHandler = useCallback(
    (instance: HTMLDivElement | null) => {
      applyRef(instance, forwardedRef);
      ref.current = instance;

      if (instance) {
        recalculate();
      }
    },
    [forwardedRef, recalculate]
  );

  useResizeObserver({
    disableHeight: disableHeightObserver,
    disableWidth: disableWidthObserver,
    onResize: recalculate,
    getTarget: () => ref.current,
  });
  const mergedStyle: CSSProperties = {
    ...style,
    [CELL_SIZE_VAR]: `${gridSize.cellWidth}px`,
    [CELL_MARGIN_VAR]: cellMargin || undefined,
  };

  return (
    <div
      {...props}
      ref={refHandler}
      style={mergedStyle}
      className={cn(block(), className)}
    >
      {typeof children === "function" ? children(gridSize) : children}
    </div>
  );
};

const defaultProps: DefaultProps = {
  maxCellSize: 150,
  containerPadding: 16,
  disableHeightObserver: false,
  disableWidthObserver: false,
};

GridList.defaultProps = defaultProps;

if (process.env.NODE_ENV !== "production") {
  GridList.displayName = "GridList";

  let PropTypes;
  try {
    PropTypes = require("prop-types");
  } catch (e) {}

  if (PropTypes) {
    GridList.propTypes = {
      className: PropTypes.string,
      children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
      forwardedRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
      cellMargin: PropTypes.string,
      maxCellSize: PropTypes.number,
      containerPadding: PropTypes.number,
      disableHeightObserver: PropTypes.bool,
      disableWidthObserver: PropTypes.bool,
    };
  }
}

export default forwardRef<HTMLDivElement, GridListProps>((props, ref) => (
  <GridList {...props} forwardedRef={ref} />
));
