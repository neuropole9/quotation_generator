import {
  Show,
  SignIn,
  useUser,
} from "@clerk/react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import QuotationSessionBar from "./components/QuotationSessionBar";
import AdminDashboard from "./pages/AdminDashboard";
import QuotationBuilder from "./pages/QuotationBuilder";
import UserManagementPage from "./pages/UserManagementPage";

type AdminView =
  | "dashboard"
  | "users"
  | "quotation";

interface AppHistoryState {
  quotationAdminView?: AdminView;
  quotationUserId?: string;
}

const isAdminView = (
  value: unknown,
): value is AdminView =>
  value === "dashboard" ||
  value === "users" ||
  value === "quotation";

export default function App() {
  const {
    user,
    isLoaded,
  } = useUser();

  const [
    adminView,
    setAdminView,
  ] = useState<AdminView>(
    "dashboard",
  );

  const role =
    typeof user?.publicMetadata?.role === "string"
      ? user.publicMetadata.role.trim().toLowerCase()
      : "user";

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isLoaded || !user || !isAdmin) {
      return;
    }

    const currentState =
      (window.history.state || {}) as AppHistoryState;

    if (
      currentState.quotationUserId === user.id &&
      isAdminView(currentState.quotationAdminView)
    ) {
      setAdminView(currentState.quotationAdminView);
    } else {
      setAdminView("dashboard");

      window.history.replaceState(
        {
          ...currentState,
          quotationAdminView: "dashboard",
          quotationUserId: user.id,
        },
        "",
        window.location.href,
      );
    }

    const handlePopState = (
      event: PopStateEvent,
    ) => {
      const state =
        (event.state || {}) as AppHistoryState;

      if (
        state.quotationUserId === user.id &&
        isAdminView(state.quotationAdminView)
      ) {
        setAdminView(state.quotationAdminView);
      } else {
        setAdminView("dashboard");
      }
    };

    window.addEventListener(
      "popstate",
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState,
      );
    };
  }, [
    isAdmin,
    isLoaded,
    user,
  ]);

  const openAdminView =
    useCallback(
      (view: AdminView) => {
        if (!user || !isAdmin) {
          return;
        }

        const currentState =
          (window.history.state || {}) as AppHistoryState;

        window.history.pushState(
          {
            ...currentState,
            quotationAdminView: view,
            quotationUserId: user.id,
          },
          "",
          window.location.href,
        );

        setAdminView(view);
      },
      [
        isAdmin,
        user,
      ],
    );

  const backToDashboard =
    useCallback(() => {
      if (!user || !isAdmin) {
        return;
      }

      const currentState =
        (window.history.state || {}) as AppHistoryState;

      if (
        currentState.quotationUserId === user.id &&
        currentState.quotationAdminView !== "dashboard"
      ) {
        window.history.back();
        return;
      }

      setAdminView("dashboard");

      window.history.replaceState(
        {
          ...currentState,
          quotationAdminView: "dashboard",
          quotationUserId: user.id,
        },
        "",
        window.location.href,
      );
    }, [
      isAdmin,
      user,
    ]);

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5f6f8",
            padding: "24px",
          }}
        >
          <SignIn />
        </div>
      </Show>

      <Show when="signed-in">
        {isAdmin ? (
          adminView === "users" ? (
            <UserManagementPage
              onBack={backToDashboard}
            />
          ) : adminView === "quotation" ? (
            <>
              <QuotationSessionBar
                isAdmin
                onBackToDashboard={
                  backToDashboard
                }
              />

              <QuotationBuilder
                selectedTemplate="classic"
                onTemplateChange={() => {
                  // Template switching is disabled.
                }}
                onBack={backToDashboard}
              />
            </>
          ) : (
            <AdminDashboard
              onManageUsers={() =>
                openAdminView("users")
              }
              onOpenQuotation={() =>
                openAdminView("quotation")
              }
            />
          )
        ) : (
          <>
            <QuotationSessionBar
              isAdmin={false}
            />

            <QuotationBuilder
              selectedTemplate="classic"
              onTemplateChange={() => {
                // Template switching is disabled.
              }}
              onBack={() => {
                // Normal users stay in the quotation generator.
              }}
            />
          </>
        )}
      </Show>
    </>
  );
}
