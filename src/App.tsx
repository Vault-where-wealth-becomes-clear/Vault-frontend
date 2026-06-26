import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/Login/LoginPage";
import { RegisterPage } from "@/pages/Register/RegisterPage";
import { ConfirmPage } from "@/pages/Confirm/ConfirmPage";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { UploadPage } from "@/pages/Upload/UploadPage";
import { AccountsPage } from "@/pages/Accounts/AccountsPage";
import { SettingsPage } from "@/pages/Settings/SettingsPage";
import { ProfilePage } from "@/pages/Profile/ProfilePage";
import { InstallmentsPage } from "@/pages/Installments/InstallmentsPage";
import { ReviewPage } from "@/pages/Review/ReviewPage";
import { refreshSessionFromStorage } from "@/api/client";
import { useAuthStore } from "@/store/auth.store";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshTokenValue = useAuthStore((s) => s.refreshTokenValue);
  const [isBootstrapping, setIsBootstrapping] = useState(isAuthenticated && !accessToken);

  useEffect(() => {
    if (!isAuthenticated || accessToken) {
      setIsBootstrapping(false);
      return;
    }
    // El accessToken no se persiste entre sesiones (es de corta duración).
    // Al recargar la app, isAuthenticated/refreshTokenValue siguen en localStorage
    // pero el accessToken vuelve a null: hay que renovarlo antes de pegarle a la API,
    // sino todos los GET vuelven 403 (HTTPBearer sin header) en vez de un 401 reintentable.
    refreshSessionFromStorage()
      .catch(() => useAuthStore.getState().logout())
      .finally(() => setIsBootstrapping(false));
  }, [isAuthenticated, accessToken, refreshTokenValue]);

  if (isBootstrapping) {
    return (
      <div className="flex h-full items-center justify-center text-vault-muted2 dark:text-[#8b949e]">
        Restaurando sesión...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  useTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/confirm" element={<ConfirmPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="uploads/:uploadId/review" element={<ReviewPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="installments" element={<InstallmentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
