import {
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/react";

interface AdminDashboardProps {
  onManageUsers: () => void;
  onOpenQuotation: () => void;
}

export default function AdminDashboard({
  onManageUsers,
  onOpenQuotation,
}: AdminDashboardProps) {
  const { user } = useUser();

  const displayName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Admin";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6f8",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <header
        style={{
          minHeight: "72px",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div>
          <strong
            style={{
              fontSize: "18px",
              color: "#111827",
            }}
          >
            Quotation Generator
          </strong>

          <div
            style={{
              marginTop: "3px",
              fontSize: "12px",
              color: "#6b7280",
            }}
          >
            Admin Dashboard
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "#374151",
            }}
          >
            {displayName}
          </span>

          <UserButton />

          <SignOutButton>
            <button
              type="button"
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                padding: "9px 14px",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </SignOutButton>
        </div>
      </header>

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 28px",
        }}
      >
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#6b7280",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Administration
          </div>

          <h1
            style={{
              margin: "8px 0 8px",
              fontSize: "30px",
              color: "#111827",
            }}
          >
            Welcome, {displayName}
          </h1>

          <p
            style={{
              margin: 0,
              color: "#6b7280",
            }}
          >
            Choose what you want to manage.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "20px",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              padding: "28px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Administration
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "22px",
                color: "#111827",
              }}
            >
              User Management
            </h2>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              View user counts, create users, see who created them,
              and review account activity.
            </p>

            <button
              type="button"
              onClick={onManageUsers}
              style={{
                marginTop: "20px",
                padding: "11px 18px",
                border: 0,
                background: "#111827",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Manage Users
            </button>
          </section>

          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              padding: "28px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#6b7280",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              Quotation
            </div>

            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "22px",
                color: "#111827",
              }}
            >
              Quotation Generator
            </h2>

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                lineHeight: 1.6,
              }}
            >
              Open the quotation builder to create, preview and
              download quotations.
            </p>

            <button
              type="button"
              onClick={onOpenQuotation}
              style={{
                marginTop: "20px",
                padding: "11px 18px",
                border: 0,
                background: "#111827",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Open Quotation Generator
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
