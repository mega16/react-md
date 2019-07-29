import React from "react";
import { cleanup, render } from "@testing-library/react";

import GridList from "../GridList";

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      get() {
        return 1000;
      },
    },
  });
});

afterAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      get() {
        return 0;
      },
    },
  });
});

describe("GridList", () => {
  // NOTE: jsdom currently does not support rendering custom css properties (css variables)
  // so we can't actually test that part.
  it("should provide the number of columns and cellWidth to a children render function with the default of 8 padding and 150 maxCellSize", () => {
    const children = jest.fn(({ columns, cellWidth }) => (
      <span>{`Columns: ${columns}, cellWidth: ${cellWidth}`}</span>
    ));
    const { rerender } = render(<GridList>{children}</GridList>);

    const containerWidth = 1000 - 16;

    expect(children).toBeCalledTimes(2);
    expect(children).toBeCalledWith({ cellWidth: 150, columns: -1 });
    expect(children).toBeCalledWith({
      columns: 7,
      cellWidth: containerWidth / Math.ceil(containerWidth / 150),
    });
    children.mockClear();

    rerender(<GridList maxCellSize={400}>{children}</GridList>);
    expect(children).toBeCalledTimes(2);
    // first render then it recalculates
    expect(children).toBeCalledWith({
      columns: 7,
      cellWidth: containerWidth / Math.ceil(containerWidth / 150),
    });
    expect(children).toBeCalledWith({
      columns: 3,
      cellWidth: containerWidth / Math.ceil(containerWidth / 400),
    });
  });

  it("should provide the number of columns and cellWidth to a children render function with a custom maxCellSize", () => {
    const containerWidth = 1000 - 16;
    const children = jest.fn(({ columns, cellWidth }) => (
      <span>{`Columns: ${columns}, cellWidth: ${cellWidth}`}</span>
    ));

    render(<GridList maxCellSize={400}>{children}</GridList>);
    expect(children).toBeCalledTimes(2);
    expect(children).toBeCalledWith({ columns: -1, cellWidth: 400 });
    expect(children).toBeCalledWith({
      columns: 3,
      cellWidth: containerWidth / Math.ceil(containerWidth / 400),
    });
  });

  it("should render correctly... (lazy test)", () => {
    const { container, rerender } = render(
      <GridList>
        {({ columns, cellWidth }) => (
          <span>{`Columns: ${columns}, cellWidth: ${cellWidth}`}</span>
        )}
      </GridList>
    );

    expect(container).toMatchSnapshot();

    rerender(
      <GridList maxCellSize={400}>
        {({ columns, cellWidth }) => (
          <span>{`Columns: ${columns}, cellWidth: ${cellWidth}`}</span>
        )}
      </GridList>
    );
    expect(container).toMatchSnapshot();

    rerender(
      <GridList>
        <div>This is some content!</div>
      </GridList>
    );
    expect(container).toMatchSnapshot();

    rerender(
      <GridList maxCellSize={400}>
        <div>This is some content!</div>
      </GridList>
    );
    expect(container).toMatchSnapshot();
  });
});
