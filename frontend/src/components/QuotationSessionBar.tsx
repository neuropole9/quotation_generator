import {
  SignOutButton,
  UserButton,
} from "@clerk/react";

interface QuotationSessionBarProps {
  isAdmin: boolean;
  onBackToDashboard?: () => void;
}

export default function QuotationSessionBar({
  isAdmin,
  onBackToDashboard,
}: QuotationSessionBarProps) {
  return (
    <div
      style={{
        minHeight: "48px",
        padding: "0 36px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        background: "#f8fafc",
        borderBottom: "1px solid #e5e7eb",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div>
        {isAdmin ? (
          <button
            type="button"
            onClick={onBackToDashboard}
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            ← Back to Dashboard
          </button>
        ) : (
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            Quotation Generator
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <UserButton />

        <SignOutButton>
          <button
            type="button"
            style={{
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
