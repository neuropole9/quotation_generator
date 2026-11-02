import {
  useState,
} from "react";

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
  gstEnabled?: boolean;
  columns: QuotationColumn[];
  onChange: (products: ProductLine[]) => void;
  onColumnsChange: (columns: QuotationColumn[]) => void;
}

interface DescriptionEditorState {
  productId: string;
  value: string;
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

const createProduct = (gstEnabled = false): ProductLine => ({
  id: crypto.randomUUID(),
  modelNumber: "",
  imageDataUrl: "",
  description: "",
  unit: "Nos",
  quantity: 1,
  unitPrice: 0,
  gstRate: gstEnabled ? 18 : 0,
  amount: null,
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
) => column.label || (
  isModelColumn(column) ? "Model Number" :
  column.kind === "unitPrice" ? "Price" :
  column.kind === "amount" ? "Total" : "Column"
);

export default function ProductEditor({
  products,
  gstEnabled = false,
  columns,
  onChange,
  onColumnsChange,
}: Props) {
  const [
    descriptionEditor,
    setDescriptionEditor,
  ] = useState<DescriptionEditorState | null>(
    null,
  );

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

  const openDescriptionEditor = (
    product: ProductLine,
  ) => {
    setDescriptionEditor({
      productId:
        product.id,
      value:
        product.description ||
        "",
    });
  };

  const closeDescriptionEditor =
    () => {
      setDescriptionEditor(
        null,
      );
    };

  const saveDescriptionEditor =
    () => {
      if (
        !descriptionEditor
      ) {
        return;
      }

      updateProduct(
        descriptionEditor.productId,
        {
          description:
            descriptionEditor.value,
        },
      );

      setDescriptionEditor(
        null,
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
          <button
            type="button"
            title="Click to edit description"
            onClick={() =>
              openDescriptionEditor(
                product,
              )
            }
            style={{
              width:
                "100%",
              minWidth:
                "240px",
              maxWidth:
                "100%",
              minHeight:
                "38px",
              padding:
                "8px 10px",
              border:
                "1px solid #cbd5e1",
              background:
                "#ffffff",
              color:
                product.description
                  ? "#0f172a"
                  : "#94a3b8",
              textAlign:
                "left",
              font:
                "inherit",
              cursor:
                "text",
              overflow:
                "hidden",
              textOverflow:
                "ellipsis",
              whiteSpace:
                "nowrap",
            }}
          >
            {product.description ||
              "Click to enter description"}
          </button>
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label="Line amount"
              title={product.amount == null ? "Automatic amount" : "Manually entered amount"}
              value={
                product.amount ??
                Math.max(0, product.quantity) * Math.max(0, product.unitPrice)
              }
              onChange={(event) => {
                const value = event.target.value;
                updateProduct(product.id, {
                  amount: value === "" ? null : Math.max(0, Number(value)),
                });
              }}
            />
            {product.amount != null && (
              <button
                type="button"
                className="text-button"
                title="Restore automatic calculation"
                aria-label="Restore automatic amount"
                onClick={() => updateProduct(product.id, { amount: null })}
              >
                Auto
              </button>
            )}
          </div>
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
              Qty and Rate calculate totals automatically unless
              you manually override the Total field.
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
              createProduct(gstEnabled),
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

      {descriptionEditor ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDescriptionEditor();
            }
          }}
          style={{
            position:
              "fixed",
            inset: 0,
            zIndex:
              10000,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "24px",
            background:
              "rgba(15, 23, 42, 0.48)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="description-editor-title"
            style={{
              width:
                "min(820px, 100%)",
              maxHeight:
                "calc(100vh - 48px)",
              overflowY:
                "auto",
              border:
                "1px solid #cbd5e1",
              background:
                "#ffffff",
              boxShadow:
                "0 24px 70px rgba(15, 23, 42, 0.24)",
              padding:
                "24px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                gap:
                  "20px",
                alignItems:
                  "flex-start",
                marginBottom:
                  "16px",
              }}
            >
              <div>
                <h3
                  id="description-editor-title"
                  style={{
                    margin: 0,
                    color:
                      "#0f172a",
                    fontSize:
                      "20px",
                  }}
                >
                  Edit Description
                </h3>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color:
                      "#64748b",
                    fontSize:
                      "13px",
                    lineHeight:
                      1.5,
                  }}
                >
                  Type or paste the full
                  product / service description.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close description editor"
                onClick={
                  closeDescriptionEditor
                }
                style={{
                  width:
                    "34px",
                  height:
                    "34px",
                  border:
                    "1px solid #cbd5e1",
                  background:
                    "#ffffff",
                  color:
                    "#475569",
                  fontSize:
                    "20px",
                  cursor:
                    "pointer",
                }}
              >
                ×
              </button>
            </div>

            <textarea
              autoFocus
              value={
                descriptionEditor.value
              }
              placeholder="Enter the complete description here..."
              onChange={(event) =>
                setDescriptionEditor(
                  (
                    previous,
                  ) =>
                    previous
                      ? {
                          ...previous,
                          value:
                            event.target
                              .value,
                        }
                      : previous,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Escape"
                ) {
                  closeDescriptionEditor();
                }

                if (
                  event.key ===
                    "Enter" &&
                  (event.ctrlKey ||
                    event.metaKey)
                ) {
                  event.preventDefault();
                  saveDescriptionEditor();
                }
              }}
              style={{
                boxSizing:
                  "border-box",
                width:
                  "100%",
                minHeight:
                  "280px",
                padding:
                  "14px",
                border:
                  "1px solid #94a3b8",
                outline:
                  "none",
                resize:
                  "vertical",
                background:
                  "#ffffff",
                color:
                  "#0f172a",
                font:
                  "inherit",
                fontSize:
                  "14px",
                lineHeight:
                  1.65,
                whiteSpace:
                  "pre-wrap",
              }}
            />

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap:
                  "12px",
                marginTop:
                  "14px",
                flexWrap:
                  "wrap",
              }}
            >
              <span
                style={{
                  color:
                    "#64748b",
                  fontSize:
                    "12px",
                }}
              >
                {
                  descriptionEditor
                    .value
                    .length
                }{" "}
                characters · Ctrl/Cmd + Enter to save
              </span>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "10px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeDescriptionEditor
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    saveDescriptionEditor
                  }
                >
                  Save Description
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
