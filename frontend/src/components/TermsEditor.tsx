import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";

import type {
  QuotationTerm,
} from "../types/quotation";

import {
  createDefaultTerms,
  DEFAULT_QUOTATION_TERMS,
} from "../constants/defaultTerms";

interface Props {
  terms: QuotationTerm[] | undefined;
  onChange: (terms: QuotationTerm[]) => void;
}

const createCustomTerm = (): QuotationTerm => ({
  id: `custom-term-${crypto.randomUUID()}`,
  text: "",
  selected: true,
  isCustom: true,
});

export default function TermsEditor({
  terms,
  onChange,
}: Props) {
  const safeTerms =
    Array.isArray(terms)
      ? terms
      : [];

  const [
    editingIds,
    setEditingIds,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (safeTerms.length === 0) {
      onChange(
        createDefaultTerms(),
      );
    }
  }, [
    safeTerms.length,
    onChange,
  ]);

  const selectedCount =
    useMemo(
      () =>
        safeTerms.filter(
          (term) =>
            term.selected &&
            term.text.trim(),
        ).length,
      [safeTerms],
    );

  const updateTerm = (
    id: string,
    patch: Partial<QuotationTerm>,
  ) => {
    onChange(
      safeTerms.map(
        (term) =>
          term.id === id
            ? {
                ...term,
                ...patch,
              }
            : term,
      ),
    );
  };

  const toggleTerm = (
    id: string,
  ) => {
    const term =
      safeTerms.find(
        (item) =>
          item.id === id,
      );

    if (!term) {
      return;
    }

    updateTerm(
      id,
      {
        selected:
          !term.selected,
      },
    );
  };

  const toggleEditing = (
    id: string,
  ) => {
    setEditingIds(
      (current) => {
        const next =
          new Set(current);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      },
    );
  };

  const removeTerm = (
    id: string,
  ) => {
    onChange(
      safeTerms.filter(
        (term) =>
          term.id !== id,
      ),
    );

    setEditingIds(
      (current) => {
        const next =
          new Set(current);

        next.delete(id);

        return next;
      },
    );
  };

  const moveTerm = (
    index: number,
    direction: -1 | 1,
  ) => {
    const target =
      index + direction;

    if (
      target < 0 ||
      target >= safeTerms.length
    ) {
      return;
    }

    const next =
      [...safeTerms];

    [
      next[index],
      next[target],
    ] = [
      next[target],
      next[index],
    ];

    onChange(next);
  };

  const addCustomTerm = () => {
    const term =
      createCustomTerm();

    onChange([
      ...safeTerms,
      term,
    ]);

    setEditingIds(
      (current) => {
        const next =
          new Set(current);

        next.add(
          term.id,
        );

        return next;
      },
    );
  };

  const selectAll = () => {
    onChange(
      safeTerms.map(
        (term) => ({
          ...term,
          selected: true,
        }),
      ),
    );
  };

  const clearAll = () => {
    onChange(
      safeTerms.map(
        (term) => ({
          ...term,
          selected: false,
        }),
      ),
    );
  };

  const restoreDefaults = () => {
    onChange(
      createDefaultTerms(),
    );

    setEditingIds(
      new Set(),
    );
  };

  const handleRowClick = (
    event: MouseEvent<HTMLDivElement>,
    id: string,
  ) => {
    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button, input, textarea, a",
      )
    ) {
      return;
    }

    toggleTerm(id);
  };

  return (
    <section className="terms-editor">
      <div className="terms-editor__header">
        <div>
          <h2>
            Terms &amp; Conditions
          </h2>

          <p>
            Select only the conditions that apply to this quotation.
            Selected terms are automatically renumbered in the PDF.
          </p>
        </div>

        <div className="terms-editor__count">
          <strong>
            {selectedCount}
          </strong>

          <span>
            Selected
          </span>
        </div>
      </div>

      <div className="terms-editor__toolbar">
        <button
          type="button"
          onClick={selectAll}
        >
          Select all
        </button>

        <button
          type="button"
          onClick={clearAll}
        >
          Clear all
        </button>

        <button
          type="button"
          onClick={restoreDefaults}
        >
          Restore {DEFAULT_QUOTATION_TERMS.length} defaults
        </button>
      </div>

      <div className="terms-editor__list">
        {safeTerms.map(
          (
            term,
            index,
          ) => {
            const editing =
              editingIds.has(
                term.id,
              );

            return (
              <div
                key={term.id}
                className={`terms-editor__row${
                  term.selected
                    ? " is-selected"
                    : ""
                }`}
                onClick={(
                  event,
                ) =>
                  handleRowClick(
                    event,
                    term.id,
                  )
                }
              >
                <label className="terms-editor__check">
                  <input
                    type="checkbox"
                    checked={
                      term.selected
                    }
                    onChange={() =>
                      toggleTerm(
                        term.id,
                      )
                    }
                  />

                  <span>
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}
                  </span>
                </label>

                <div className="terms-editor__content">
                  {editing ? (
                    <textarea
                      autoFocus
                      rows={
                        term.text.includes(
                          "\n",
                        )
                          ? 5
                          : 3
                      }
                      value={
                        term.text
                      }
                      placeholder="Enter term or condition"
                      onChange={(
                        event,
                      ) =>
                        updateTerm(
                          term.id,
                          {
                            text:
                              event
                                .target
                                .value,
                          },
                        )
                      }
                    />
                  ) : (
                    <p>
                      {term.text ||
                        "Empty custom term"}
                    </p>
                  )}
                </div>

                <div className="terms-editor__actions">
                  <button
                    type="button"
                    onClick={() =>
                      toggleEditing(
                        term.id,
                      )
                    }
                  >
                    {editing
                      ? "Done"
                      : "Edit"}
                  </button>

                  <button
                    type="button"
                    aria-label="Move term up"
                    disabled={
                      index === 0
                    }
                    onClick={() =>
                      moveTerm(
                        index,
                        -1,
                      )
                    }
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    aria-label="Move term down"
                    disabled={
                      index ===
                      safeTerms.length -
                        1
                    }
                    onClick={() =>
                      moveTerm(
                        index,
                        1,
                      )
                    }
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    className="terms-editor__delete"
                    onClick={() =>
                      removeTerm(
                        term.id,
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          },
        )}
      </div>

      <button
        type="button"
        className="terms-editor__add"
        onClick={
          addCustomTerm
        }
      >
        + Add Custom Term
      </button>
    </section>
  );
}