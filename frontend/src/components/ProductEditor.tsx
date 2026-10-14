import type {
  ProductLine,
  QuotationColumn,
  QuotationColumnKind,
} from "../types/quotation";

import {
  formatCurrency,
  lineBase,
} from "../utils/calculations";

interface Props {
  products: ProductLine[];
  columns: QuotationColumn[];
  onChange: (products: ProductLine[]) => void;
  onColumnsChange: (columns: QuotationColumn[]) => void;
}

const CUSTOM_COLUMN_TYPES: Array<{
  value: QuotationColumnKind;
  label: string;
}> = [
  {
    value: "customText",
    label: "Text",
  },
  {
    value: "customNumber",
    label: "Number",
  },
  {
    value: "customCurrency",
    label: "Currency",
  },
];

const createProduct = (): ProductLine => ({
  id: crypto.randomUUID(),
  modelNumber: "",
  imageDataUrl: "",
  description: "",
  unit: "Nos",
  quantity: 1,
  unitPrice: 0,
  gstRate: 18,
  customValues: {},
});

const isCustomColumn = (
  column: QuotationColumn,
) => column.kind.startsWith("custom");

const isModelColumn = (
  column: QuotationColumn,
) =>
  column.kind === "modelNumber" ||
  column.kind === "image";

const displayColumnLabel = (
  column: QuotationColumn,
) => {
  if (
    isModelColumn(
      column,
    )
  ) {
    return "Model Number";
  }

  if (
    column.kind ===
    "unitPrice"
  ) {
    return "Price";
  }

  if (
    column.kind ===
    "amount"
  ) {
    return "Total";
  }

  return (
    column.label ||
    "Column"
  );
};

export default function ProductEditor({
  products,
  columns,
  onChange,
  onColumnsChange,
}: Props) {
  const safeProducts = Array.isArray(products)
    ? products
    : [];

  const safeColumns = Array.isArray(columns)
    ? columns
    : [];

  const visibleColumns = safeColumns.filter(
    (column) =>
      column.visible &&
      column.kind !== "gstRate",
  );

  const updateProduct = (
    id: string,
    patch: Partial<ProductLine>,
  ) => {
    onChange(
      safeProducts.map((product) =>
        product.id === id
          ? {
              ...product,
              ...patch,
            }
          : product,
      ),
    );
  };

  const updateCustomValue = (
    productId: string,
    columnId: string,
    value: string | number,
  ) => {
    onChange(
      safeProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              customValues: {
                ...product.customValues,
                [columnId]: value,
              },
            }
          : product,
      ),
    );
  };

  const removeProduct = (
    id: string,
  ) => {
    if (safeProducts.length <= 1) {
      return;
    }

    onChange(
      safeProducts.filter(
        (product) =>
          product.id !== id,
      ),
    );
  };

  const updateColumn = (
    id: string,
    patch: Partial<QuotationColumn>,
  ) => {
    onColumnsChange(
      safeColumns.map((column) =>
        column.id === id
          ? {
              ...column,
              ...patch,
            }
          : column,
      ),
    );
  };

  const addCustomColumnAt = (
    insertionIndex: number,
  ) => {
    const column: QuotationColumn = {
      id: `custom_${crypto.randomUUID()}`,
      label: "Custom Column",
      kind: "customText",
      visible: true,
    };

    const next = [
      ...safeColumns,
    ];

    next.splice(
      insertionIndex,
      0,
      column,
    );

    onColumnsChange(next);
  };

  const removeCustomColumn = (
    columnId: string,
  ) => {
    onColumnsChange(
      safeColumns.filter(
        (column) =>
          column.id !== columnId,
      ),
    );

    onChange(
      safeProducts.map(
        (product) => {
          const nextValues = {
            ...product.customValues,
          };

          delete nextValues[
            columnId
          ];

          return {
            ...product,
            customValues:
              nextValues,
          };
        },
      ),
    );
  };

  const renderEditorCell = (
    column: QuotationColumn,
    product: ProductLine,
    index: number,
  ) => {
    switch (column.kind) {
      case "serial":
        return (
          <span className="table-readonly-value">
            {index + 1}
          </span>
        );

      case "modelNumber":
      case "image":
        return (
          <input
            value={
              product.modelNumber ??
              String(
                product.customValues?.modelNumber ??
                  "",
              )
            }
            placeholder="Model / Part No."
            onChange={(event) =>
              updateProduct(
                product.id,
                {
                  modelNumber:
                    event.target.value,
                },
              )
            }
          />
        );

      case "description":
        return (
          <input
            value={
              product.description
            }
            placeholder="Product / service"
            onChange={(event) =>
              updateProduct(
                product.id,
                {
                  description:
                    event.target.value,
                },
              )
            }
          />
        );

      case "unit":
        return (
          <input
            value={product.unit}
            onChange={(event) =>
              updateProduct(
                product.id,
                {
                  unit:
                    event.target.value,
                },
              )
            }
          />
        );

      case "quantity":
        return (
          <input
            type="number"
            min="0"
            step="1"
            value={product.quantity}
            onChange={(event) =>
              updateProduct(
                product.id,
                {
                  quantity: Number(
                    event.target.value,
                  ),
                },
              )
            }
          />
        );

      case "unitPrice":
        return (
          <input
            type="number"
            min="0"
            step="0.01"
            value={product.unitPrice}
            onChange={(event) =>
              updateProduct(
                product.id,
                {
                  unitPrice: Number(
                    event.target.value,
                  ),
                },
              )
            }
          />
        );

      case "amount":
        return (
          <span className="table-readonly-value">
            {formatCurrency(
              lineBase(product),
            )}
          </span>
        );

      case "customNumber":
      case "customCurrency":
        return (
          <input
            type="number"
            step="0.01"
            value={
              product.customValues?.[
                column.id
              ] ?? ""
            }
            onChange={(event) =>
              updateCustomValue(
                product.id,
                column.id,
                event.target.value === ""
                  ? ""
                  : Number(
                      event.target.value,
                    ),
              )
            }
          />
        );

      case "customText":
      default:
        return (
          <input
            value={String(
              product.customValues?.[
                column.id
              ] ?? "",
            )}
            onChange={(event) =>
              updateCustomValue(
                product.id,
                column.id,
                event.target.value,
              )
            }
          />
        );
    }
  };

  return (
    <div className="product-editor">
      <div className="column-manager">
        <div className="column-manager__heading">
          <div>
            <strong>
              Customize product columns
            </strong>

            <p>
              Model Number replaces the
              previous product-image column.
              Qty, Rate and GST continue to
              control automatic totals.
            </p>
          </div>
        </div>

        <div className="column-manager__list">
          {safeColumns
            .filter(
              (column) =>
                column.kind !==
                "gstRate",
            )
            .map(
            (column) => (
              <div
                className="column-config-row"
                key={column.id}
              >
                <label className="column-visible-toggle">
                  <input
                    type="checkbox"
                    checked={
                      column.visible
                    }
                    onChange={(
                      event,
                    ) =>
                      updateColumn(
                        column.id,
                        {
                          visible:
                            event
                              .target
                              .checked,
                        },
                      )
                    }
                  />

                  <span>Show</span>
                </label>

                <input
                  className="column-label-input"
                  value={
                    displayColumnLabel(
                      column,
                    )
                  }
                  readOnly={
                    isModelColumn(
                      column,
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    updateColumn(
                      column.id,
                      {
                        label:
                          event.target
                            .value,
                      },
                    )
                  }
                />

                {isCustomColumn(
                  column,
                ) ? (
                  <select
                    className="column-type-select"
                    value={column.kind}
                    onChange={(
                      event,
                    ) =>
                      updateColumn(
                        column.id,
                        {
                          kind:
                            event
                              .target
                              .value as QuotationColumnKind,
                        },
                      )
                    }
                  >
                    {CUSTOM_COLUMN_TYPES.map(
                      (type) => (
                        <option
                          key={
                            type.value
                          }
                          value={
                            type.value
                          }
                        >
                          {type.label}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <span className="column-system-badge">
                    System
                  </span>
                )}

                {isCustomColumn(
                  column,
                ) ? (
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() =>
                      removeCustomColumn(
                        column.id,
                      )
                    }
                  >
                    Remove
                  </button>
                ) : (
                  <span className="column-remove-placeholder" />
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <div className="product-table-editor-wrap">
        <table className="product-table-editor">
          <thead>
            <tr>
              {visibleColumns.map(
                (
                  column,
                  index,
                ) => (
                  <>
                    <th
                      key={
                        column.id
                      }
                    >
                      {displayColumnLabel(
                        column,
                      )}
                    </th>

                    {index <
                    visibleColumns.length -
                      1 ? (
                      <th
                        key={`${column.id}-insert`}
                        className="add-column-between-cell"
                      >
                        <button
                          type="button"
                          className="add-column-between-button"
                          onClick={() =>
                            addCustomColumnAt(
                              safeColumns.findIndex(
                                (
                                  item,
                                ) =>
                                  item.id ===
                                  column.id,
                              ) + 1,
                            )
                          }
                        >
                          + Add Column Here
                        </button>
                      </th>
                    ) : null}
                  </>
                ),
              )}

              <th className="product-action-column">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {safeProducts.map(
              (
                product,
                index,
              ) => (
                <tr
                  key={product.id}
                >
                  {visibleColumns.map(
                    (
                      column,
                      columnIndex,
                    ) => (
                      <>
                        <td
                          key={
                            column.id
                          }
                        >
                          {renderEditorCell(
                            column,
                            product,
                            index,
                          )}
                        </td>

                        {columnIndex <
                        visibleColumns.length -
                          1 ? (
                          <td
                            key={`${column.id}-gap`}
                            className="add-column-between-body-cell"
                          />
                        ) : null}
                      </>
                    ),
                  )}

                  <td className="product-action-column">
                    <button
                      className="text-button danger"
                      type="button"
                      disabled={
                        safeProducts.length <=
                        1
                      }
                      onClick={() =>
                        removeProduct(
                          product.id,
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="product-editor__footer">
        <button
          className="add-product-button"
          type="button"
          onClick={() =>
            onChange([
              ...safeProducts,
              createProduct(),
            ])
          }
        >
          + Add Product
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            addCustomColumnAt(
              safeColumns.length,
            )
          }
        >
          + Add Column
        </button>

        {safeProducts.length >
        0 ? (
          <div className="product-editor__summary">
            <span>
              Latest line total
            </span>

            <strong>
              {formatCurrency(
                lineBase(
                  safeProducts[
                    safeProducts.length -
                      1
                  ],
                ) *
                  1.18,
              )}
            </strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
