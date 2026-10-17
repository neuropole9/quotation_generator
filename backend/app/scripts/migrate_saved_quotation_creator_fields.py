from __future__ import annotations

from sqlalchemy import inspect, text

from app.db import Base, engine

# Import the model so SQLAlchemy knows about saved_quotations.
from app.models.saved_quotation import SavedQuotation  # noqa: F401


TABLE_NAME = "saved_quotations"


def _column_names() -> set[str]:
    inspector = inspect(engine)

    if not inspector.has_table(
        TABLE_NAME
    ):
        return set()

    return {
        str(column["name"])
        for column in inspector.get_columns(
            TABLE_NAME
        )
    }


def _index_names() -> set[str]:
    inspector = inspect(engine)

    if not inspector.has_table(
        TABLE_NAME
    ):
        return set()

    return {
        str(index["name"])
        for index in inspector.get_indexes(
            TABLE_NAME
        )
        if index.get("name")
    }


def migrate() -> None:
    # Fresh databases can create the complete table directly
    # from the current SQLAlchemy model.
    Base.metadata.create_all(
        bind=engine
    )

    columns = _column_names()

    required_columns = {
        "owner_user_id":
            "VARCHAR(255)",
        "created_by_name":
            "VARCHAR(255)",
        "created_by_email":
            "VARCHAR(320)",
    }

    with engine.begin() as connection:
        for (
            column_name,
            column_type,
        ) in required_columns.items():
            if column_name in columns:
                print(
                    f"[skip] {column_name} "
                    "already exists"
                )
                continue

            connection.execute(
                text(
                    f"ALTER TABLE "
                    f"{TABLE_NAME} "
                    f"ADD COLUMN "
                    f"{column_name} "
                    f"{column_type}"
                )
            )

            print(
                f"[added] {column_name}"
            )

    # Refresh metadata after ALTER TABLE.
    indexes = _index_names()

    required_indexes = {
        "ix_saved_quotations_owner_user_id":
            (
                "CREATE INDEX "
                "IF NOT EXISTS "
                "ix_saved_quotations_owner_user_id "
                "ON saved_quotations "
                "(owner_user_id)"
            ),
        "ix_saved_quotations_created_by_name":
            (
                "CREATE INDEX "
                "IF NOT EXISTS "
                "ix_saved_quotations_created_by_name "
                "ON saved_quotations "
                "(created_by_name)"
            ),
        "ix_saved_quotations_created_by_email":
            (
                "CREATE INDEX "
                "IF NOT EXISTS "
                "ix_saved_quotations_created_by_email "
                "ON saved_quotations "
                "(created_by_email)"
            ),
        "ix_saved_quotations_owner_updated":
            (
                "CREATE INDEX "
                "IF NOT EXISTS "
                "ix_saved_quotations_owner_updated "
                "ON saved_quotations "
                "(owner_user_id, updated_at)"
            ),
    }

    with engine.begin() as connection:
        for (
            index_name,
            statement,
        ) in required_indexes.items():
            if index_name in indexes:
                print(
                    f"[skip] {index_name} "
                    "already exists"
                )
                continue

            connection.execute(
                text(statement)
            )

            print(
                f"[added] {index_name}"
            )

    print(
        "Saved quotation creator "
        "migration completed."
    )


if __name__ == "__main__":
    migrate()
