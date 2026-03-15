"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Coffee, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => pathname === path;

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUser(session.user);
    };
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowProfileMenu(false);
    router.push("/login");
  };

  const navLinks = [
    { href: "/local-tts", label: "Local TTS", activeColor: "indigo" },
    { href: "/cloud-tts", label: "Cloud TTS", activeColor: "blue" },
    { href: "/qwen-tts", label: "Qwen3 TTS", activeColor: "purple" },
    { href: "/xtts", label: "XTTSv2", activeColor: "orange" },
    { href: "/subtitles", label: "Subtitles", activeColor: "indigo" },
  ];

  return (
    <>
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.25rem",
        background: "rgba(23, 23, 23, 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}>
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Link
            href="/"
            style={{
              fontSize: "1.15rem",
              fontWeight: "700",
              background: "linear-gradient(to right, #818cf8, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textDecoration: "none",
            }}
          >
            🎙️ NeuralTTS
          </Link>
        </div>

        {/* Center: Desktop Navigation Links */}
        <div className="nav-links-desktop" style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.8rem",
                fontWeight: "500",
                padding: "0.375rem 0.75rem",
                borderRadius: "100px",
                textDecoration: "none",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                ...(isActive(link.href)
                  ? {
                      color: `var(--${link.activeColor}-active, #818cf8)`,
                      background: `rgba(99, 102, 241, 0.1)`,
                    }
                  : {
                      color: "#9ca3af",
                    }),
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {/* Buy me a chai - Hidden on very small screens */}
          <a
            href="https://buymeachai.ezee.li/noobdev007"
            target="_blank"
            rel="noopener noreferrer"
            className="chai-btn-desktop"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.4rem 0.75rem",
              background: "rgba(250, 204, 21, 0.1)",
              color: "#facc15",
              border: "1px solid rgba(250, 204, 21, 0.2)",
              borderRadius: "100px",
              fontSize: "0.75rem",
              fontWeight: "700",
              textDecoration: "none",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            title="Support the developer"
          >
            <Coffee size={13} />
            <span>Buy me a chai</span>
          </a>

          {/* Profile Avatar */}
          {user && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  border: showProfileMenu ? "2px solid rgba(99, 102, 241, 0.6)" : "2px solid rgba(255,255,255,0.15)",
                  background: "#6366f1",
                  cursor: "pointer",
                  overflow: "hidden",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#fff", fontWeight: "700", fontSize: "0.85rem" }}>
                    {user.email?.[0].toUpperCase() || "U"}
                  </span>
                )}
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <>
                  <div onClick={() => setShowProfileMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    right: 0,
                    width: "240px",
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                    overflow: "hidden",
                    zIndex: 999,
                  }}>
                    <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {user.user_metadata?.avatar_url ? (
                          <img src={user.user_metadata.avatar_url} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                        ) : (
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#fff", fontSize: "0.85rem" }}>
                            {user.email?.[0].toUpperCase() || "U"}
                          </div>
                        )}
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.user_metadata?.full_name || "User"}</div>
                          <div style={{ fontSize: "0.7rem", color: "#888", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "0.85rem",
                        fontWeight: "500",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s ease",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              color: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Slide-Down Menu */}
      {mobileMenuOpen && (
        <>
          <div onClick={() => setMobileMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }} />
          <div style={{
            position: "fixed",
            top: "56px",
            left: 0,
            right: 0,
            zIndex: 45,
            background: "rgba(23, 23, 23, 0.98)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            padding: "0.75rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  fontSize: "0.9rem",
                  fontWeight: "500",
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  textDecoration: "none",
                  transition: "all 0.15s",
                  ...(isActive(link.href)
                    ? { color: "#818cf8", background: "rgba(99, 102, 241, 0.1)" }
                    : { color: "#9ca3af" }),
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Buy me a chai in mobile menu */}
            <a
              href="https://buymeachai.ezee.li/noobdev007"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.9rem",
                fontWeight: "600",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                textDecoration: "none",
                color: "#facc15",
                marginTop: "0.25rem",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: "1rem",
              }}
            >
              <Coffee size={15} />
              Buy me a chai
            </a>
          </div>
        </>
      )}

      {/* Responsive Styles */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .nav-links-desktop {
            display: none !important;
          }
          .chai-btn-desktop {
            display: none !important;
          }
          .hamburger-btn {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
