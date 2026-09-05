import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchAccount } from "../lib/api";

export function AuthGuard() {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const location = useLocation();


  useEffect(() => {
    let alive = true;
    fetchAccount()
      .then((account) => {
        if (!alive) return;
        if (account && account.discord) {
          setIsAuth(true);
        } else {
          setIsAuth(false);
        }
      })
      .catch(() => {
        if (!alive) return;
        setIsAuth(false);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-transparent select-none">
        <div className="flex flex-col items-center gap-4 p-8 rounded-[28px] bg-[#0a0a0a]/70 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-white/70 tracking-widest uppercase">
            Verificando sessão Discord...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
