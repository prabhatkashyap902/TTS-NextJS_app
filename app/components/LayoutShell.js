"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function LayoutShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <>
      {!isLoginPage && <Navbar />}
      <div className={!isLoginPage ? "pt-24!" : ""}>
        {children}
      </div>
      {!isLoginPage && <Footer />}
    </>
  );
}
