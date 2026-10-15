import {
  useAuth,
  UserButton,
} from "@clerk/react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { apiUrl } from "../utils/apiBase";

interface CreatedByInfo {
  id: string;
  name: string;
  email: string;
}

interface ClerkUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  banned: boolean;
  locked: boolean;
  createdAt: number | null;
  updatedAt: number | null;
  lastSignInAt: number | null;
  createdBy: CreatedByInfo | null;
}

interface UsersSummary {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  createdByMe: number;
}

interface UsersResponse {
  users: ClerkUserSummary[];
  count: number;
  summary: UsersSummary;
}

interface UserManagementPageProps {
  onBack: () => void;
}

const EMPTY_SUMMARY: UsersSummary = {
  totalUsers: 0,
  activeUsers: 0,
  adminCount: 0,
  createdByMe: 0,
};

const readErrorMessage = async (
  response: Response,
  fallback: string,
) => {
  try {
    const body = await response.json();

    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      return body.detail;
    }
  } catch {
    // Keep fallback.
  }

  return fallback;
};

export default function UserManagementPage({
  onBack,
}: UserManagementPageProps) {
  const {
    getToken,
    isLoaded,
    isSignedIn,
  } = useAuth();

  const [users, setUsers] =
    useState<ClerkUserSummary[]>([]);

  const [summary, setSummary] =
    useState<UsersSummary>(EMPTY_SUMMARY);

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [actionUserId, setActionUserId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [editingUser, setEditingUser] =
    useState<ClerkUserSummary | null>(null);

  const [editFirstName, setEditFirstName] =
    useState("");

  const [editLastName, setEditLastName] =
    useState("");

  const authenticatedFetch = useCallback(
    async (
      path: string,
      init?: RequestInit,
    ) => {
      const token = await getToken();

      if (!token) {
        throw new Error(
          "Unable to get the Clerk session token.",
        );
      }

      return fetch(
        apiUrl(path),
        {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        },
      );
    },
    [getToken],
  );

  const loadUsers = useCallback(
    async () => {
      setLoadingUsers(true);
      setError("");

      try {
        const response =
          await authenticatedFetch(
            "/api/admin/users",
          );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              "Unable to load users.",
            ),
          );
        }

        const body =
          (await response.json()) as UsersResponse;

        setUsers(
          Array.isArray(body.users)
            ? body.users
            : [],
        );

        setSummary({
          ...EMPTY_SUMMARY,
          ...(body.summary || {}),
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load users.",
        );
      } finally {
        setLoadingUsers(false);
      }
    },
    [authenticatedFetch],
  );

  useEffect(() => {
    if (
      isLoaded &&
      isSignedIn
    ) {
      void loadUsers();
    }
  }, [
    isLoaded,
    isSignedIn,
    loadUsers,
  ]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          Number(
            b.createdAt || 0,
          ) -
          Number(
            a.createdAt || 0,
          ),
      ),
    [users],
  );

  const handleCreateUser =
    async (
      event: FormEvent,
    ) => {
      event.preventDefault();

      setError("");
      setSuccess("");

      if (
        !firstName.trim() ||
        !email.trim() ||
        !password
      ) {
        setError(
          "First name, email and password are required.",
        );

        return;
      }

      setSubmitting(true);

      try {
        const response =
          await authenticatedFetch(
            "/api/admin/users",
            {
              method: "POST",
              body: JSON.stringify({
                first_name:
                  firstName.trim(),
                last_name:
                  lastName.trim(),
                email:
                  email.trim(),
                password,
              }),
            },
          );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              "Unable to create user.",
            ),
          );
        }

        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");

        setSuccess(
          "User created successfully.",
        );

        await loadUsers();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to create user.",
        );
      } finally {
        setSubmitting(false);
      }
    };

  const startEditing = (
    user: ClerkUserSummary,
  ) => {
    setEditingUser(user);
    setEditFirstName(
      user.firstName,
    );
    setEditLastName(
      user.lastName,
    );
    setError("");
    setSuccess("");
  };

  const handleSaveEdit =
    async (
      event: FormEvent,
    ) => {
      event.preventDefault();

      if (!editingUser) {
        return;
      }

      if (!editFirstName.trim()) {
        setError(
          "First name is required.",
        );
        return;
      }

      setActionUserId(
        editingUser.id,
      );
      setError("");
      setSuccess("");

      try {
        const response =
          await authenticatedFetch(
            `/api/admin/users/${editingUser.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                first_name:
                  editFirstName.trim(),
                last_name:
                  editLastName.trim(),
              }),
            },
          );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              "Unable to update user.",
            ),
          );
        }

        setSuccess(
          "User updated successfully.",
        );
        setEditingUser(null);

        await loadUsers();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update user.",
        );
      } finally {
        setActionUserId(null);
      }
    };

  const handleToggleActive =
    async (
      user: ClerkUserSummary,
    ) => {
      const action =
        user.banned
          ? "reactivate"
          : "deactivate";

      if (
        !window.confirm(
          user.banned
            ? `Reactivate ${user.email}?`
            : `Deactivate ${user.email}? The user will be signed out and blocked from signing in.`,
        )
      ) {
        return;
      }

      setActionUserId(
        user.id,
      );
      setError("");
      setSuccess("");

      try {
        const endpoint =
          user.banned
            ? "unban"
            : "ban";

        const response =
          await authenticatedFetch(
            `/api/admin/users/${user.id}/${endpoint}`,
            {
              method: "POST",
            },
          );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              `Unable to ${action} user.`,
            ),
          );
        }

        setSuccess(
          user.banned
            ? "User reactivated successfully."
            : "User deactivated successfully.",
        );

        await loadUsers();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Unable to ${action} user.`,
        );
      } finally {
        setActionUserId(null);
      }
    };

  const handleDeleteUser =
    async (
      user: ClerkUserSummary,
    ) => {
      const confirmed =
        window.confirm(
          `Permanently delete ${user.email}? This cannot be undone.`,
        );

      if (!confirmed) {
        return;
      }

      setActionUserId(
        user.id,
      );
      setError("");
      setSuccess("");

      try {
        const response =
          await authenticatedFetch(
            `/api/admin/users/${user.id}`,
            {
              method: "DELETE",
            },
          );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              "Unable to delete user.",
            ),
          );
        }

        if (
          editingUser?.id ===
          user.id
        ) {
          setEditingUser(null);
        }

        setSuccess(
          "User deleted successfully.",
        );

        await loadUsers();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to delete user.",
        );
      } finally {
        setActionUserId(null);
      }
    };

  const formatDate = (
    timestamp: number | null,
  ) => {
    if (!timestamp) {
      return "—";
    }

    return new Date(
      timestamp,
    ).toLocaleString(
      "en-IN",
    );
  };

  const statCard = (
    label: string,
    value: number,
  ) => (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        padding: "22px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "30px",
          color: "#111827",
        }}
      >
        {loadingUsers
          ? "—"
          : value}
      </div>
    </section>
  );

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
            User Management
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "9px 14px",
              border: "1px solid #d1d5db",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Back to Dashboard
          </button>

          <UserButton />
        </div>
      </header>

      <main
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "36px 28px",
        }}
      >
        <div
          style={{
            marginBottom: "24px",
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
              margin: "8px 0 6px",
              color: "#111827",
            }}
          >
            Manage Users
          </h1>

          <p
            style={{
              margin: 0,
              color: "#6b7280",
            }}
          >
            Create, edit, deactivate, reactivate and delete quotation users.
          </p>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: "18px",
              padding: "12px 14px",
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            style={{
              marginBottom: "18px",
              padding: "12px 14px",
              border: "1px solid #bbf7d0",
              background: "#f0fdf4",
              color: "#166534",
            }}
          >
            {success}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {statCard(
            "Total Users",
            summary.totalUsers,
          )}

          {statCard(
            "Active Users",
            summary.activeUsers,
          )}

          {statCard(
            "Admins",
            summary.adminCount,
          )}

          {statCard(
            "Created By Me",
            summary.createdByMe,
          )}
        </div>

        <section
          style={{
            marginBottom: "24px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            padding: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 18px",
              fontSize: "18px",
            }}
          >
            Create User
          </h2>

          <form
            onSubmit={handleCreateUser}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <label>
                <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                  First Name
                </div>
                <input
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(event.target.value)
                  }
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>

              <label>
                <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Last Name
                </div>
                <input
                  value={lastName}
                  onChange={(event) =>
                    setLastName(event.target.value)
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>

              <label>
                <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Email
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>

              <label>
                <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Temporary Password
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={8}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    border: "1px solid #d1d5db",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: "18px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "11px 18px",
                  border: 0,
                  background:
                    submitting
                      ? "#9ca3af"
                      : "#111827",
                  color: "#ffffff",
                  cursor:
                    submitting
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting
                  ? "Creating..."
                  : "Create User"}
              </button>
            </div>
          </form>
        </section>

        {editingUser ? (
          <section
            style={{
              marginBottom: "24px",
              background: "#ffffff",
              border: "1px solid #111827",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "16px",
                alignItems: "flex-start",
                marginBottom: "18px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 5px",
                    fontSize: "18px",
                  }}
                >
                  Edit User
                </h2>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                  }}
                >
                  {editingUser.email}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditingUser(null)
                }
                style={{
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={handleSaveEdit}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: "16px",
                }}
              >
                <label>
                  <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                    First Name
                  </div>

                  <input
                    value={editFirstName}
                    onChange={(event) =>
                      setEditFirstName(
                        event.target.value,
                      )
                    }
                    required
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      border: "1px solid #d1d5db",
                    }}
                  />
                </label>

                <label>
                  <div style={{ marginBottom: "6px", fontSize: "12px", fontWeight: 700 }}>
                    Last Name
                  </div>

                  <input
                    value={editLastName}
                    onChange={(event) =>
                      setEditLastName(
                        event.target.value,
                      )
                    }
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 12px",
                      border: "1px solid #d1d5db",
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="submit"
                  disabled={
                    actionUserId ===
                    editingUser.id
                  }
                  style={{
                    border: 0,
                    background: "#111827",
                    color: "#ffffff",
                    padding: "10px 16px",
                    cursor: "pointer",
                  }}
                >
                  {actionUserId ===
                  editingUser.id
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                }}
              >
                All Users
              </h2>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {users.length} user
                {users.length === 1
                  ? ""
                  : "s"}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadUsers()
              }
              disabled={loadingUsers}
              style={{
                padding: "9px 14px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor:
                  loadingUsers
                    ? "wait"
                    : "pointer",
              }}
            >
              Refresh
            </button>
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1160px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f9fafb",
                  }}
                >
                  {[
                    "Name",
                    "Email",
                    "Role",
                    "Created By",
                    "Status",
                    "Created",
                    "Last Sign In",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        borderBottom:
                          "1px solid #e5e7eb",
                        fontSize: "12px",
                        color: "#4b5563",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "28px 16px",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      Loading users...
                    </td>
                  </tr>
                ) : sortedUsers.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "28px 16px",
                        textAlign: "center",
                        color: "#6b7280",
                      }}
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map(
                    (user) => {
                      const name =
                        [
                          user.firstName,
                          user.lastName,
                        ]
                          .filter(Boolean)
                          .join(" ");

                      const isAdmin =
                        String(
                          user.role || "",
                        )
                          .trim()
                          .toLowerCase() ===
                        "admin";

                      const busy =
                        actionUserId ===
                        user.id;

                      return (
                        <tr
                          key={user.id}
                        >
                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {name || "—"}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {user.email || "—"}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                              textTransform:
                                "capitalize",
                            }}
                          >
                            {user.role || "user"}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {user.createdBy?.name ||
                              user.createdBy?.email ||
                              "—"}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {user.banned
                              ? "Inactive"
                              : user.locked
                                ? "Locked"
                                : "Active"}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {formatDate(
                              user.createdAt,
                            )}
                          </td>

                          <td
                            style={{
                              padding: "13px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            {formatDate(
                              user.lastSignInAt,
                            )}
                          </td>

                          <td
                            style={{
                              padding: "10px 14px",
                              borderBottom:
                                "1px solid #e5e7eb",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isAdmin ? (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                }}
                              >
                                Protected
                              </span>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "7px",
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    startEditing(
                                      user,
                                    )
                                  }
                                  style={{
                                    border:
                                      "1px solid #d1d5db",
                                    background:
                                      "#ffffff",
                                    padding:
                                      "7px 10px",
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleToggleActive(
                                      user,
                                    )
                                  }
                                  style={{
                                    border:
                                      "1px solid #d1d5db",
                                    background:
                                      "#ffffff",
                                    padding:
                                      "7px 10px",
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  {busy
                                    ? "Working..."
                                    : user.banned
                                      ? "Activate"
                                      : "Inactivate"}
                                </button>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleDeleteUser(
                                      user,
                                    )
                                  }
                                  style={{
                                    border:
                                      "1px solid #fecaca",
                                    background:
                                      "#ffffff",
                                    color:
                                      "#b91c1c",
                                    padding:
                                      "7px 10px",
                                    cursor:
                                      "pointer",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
