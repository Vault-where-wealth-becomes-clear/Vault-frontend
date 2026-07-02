import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useMepQuote } from "@/api/mepQuote.api";

export function AppLayout() {
  useMepQuote();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
