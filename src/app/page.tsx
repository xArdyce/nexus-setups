"use client";

import "./homepage.css";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { InterfaceTranslator, LanguageSelector } from "@/components/InterfaceLanguage";

export default function NexusHomepage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  // =========================
  // STATE
  // =========================

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [modalOpen, setModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup" | "reset-request" | "reset-password">("login");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [workFilter, setWorkFilter] = useState("all");

  const [pricingPeriod, setPricingPeriod] = useState<"monthly" | "custom">(
    "monthly"
  );

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [formMessage, setFormMessage] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        const data = await response.json();

        if (cancelled) return;

        if (data?.user) {
          setSession(data);
          setSessionStatus("authenticated");
        } else {
          setSession(null);
          setSessionStatus("unauthenticated");
        }
      } catch (error) {
        console.error("Failed to load session:", error);

        if (!cancelled) {
          setSession(null);
          setSessionStatus("unauthenticated");
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================
  // THEME
  // =========================

  useEffect(() => {
    const savedTheme = localStorage.getItem("nexus-theme");

    if (savedTheme === "light") {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");

    if (token) {
      setResetToken(token);
      setAuthTab("reset-password");
      setModalOpen(true);
      setLoginError("");
      setResetMessage("");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";

    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("nexus-theme", newTheme);
  };

  // =========================
  // TYPEWRITER
  // =========================

  const typeTargets = useRef<(HTMLSpanElement | null)[]>([]);

  const addTypeTarget = (element: HTMLSpanElement | null) => {
    if (element && !typeTargets.current.includes(element)) {
      typeTargets.current.push(element);
    }
  };

  const typeWriter = (
    element: HTMLSpanElement,
    delay = 0
  ) => {
    const textSpan = element.querySelector(".typed-text");
    const fullText = element.getAttribute("data-text");

    if (!textSpan || !fullText) return;

    if (element.classList.contains("is-typing")) return;
    element.classList.add("is-typing");

    setTimeout(() => {
      let charIndex = 0;
      textSpan.textContent = "";

      const addChar = () => {
        if (charIndex < fullText.length) {
          textSpan.textContent += fullText.charAt(charIndex);
          charIndex++;

          setTimeout(addChar, 85);
        }
      };

      addChar();
    }, delay);
  };

  useEffect(() => {
    if (!typeTargets.current.length) return;

    const targets = typeTargets.current;

    const heroTarget = targets.find((target) =>
      target?.closest(".hero")
    );

    if (heroTarget) {
      typeWriter(heroTarget, 600);
    }

    const observerOptions = {
      root: null,
      rootMargin: "0px 0px -150px 0px",
      threshold: 0.3,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const target = entry.target as HTMLSpanElement;

          if (!target.classList.contains("typed")) {
            target.classList.add("typed");

            typeWriter(target, 250);

            observer.unobserve(target);
          }
        });
      },
      observerOptions
    );

    targets.forEach((target) => {
      if (target && !target.closest(".hero")) {
        observer.observe(target);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // =========================
  // BODY LOCK
  // =========================

  useEffect(() => {
    if (modalOpen || mobileMenuOpen) {
      document.body.classList.add(
        modalOpen ? "modal-open" : "menu-open"
      );
    } else {
      document.body.classList.remove("modal-open");
      document.body.classList.remove("menu-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
      document.body.classList.remove("menu-open");
    };
  }, [modalOpen, mobileMenuOpen]);

  // =========================
  // LOGIN MODAL
  // =========================

  const openLoginModal = () => {
    setModalOpen(true);
    setLoginError("");
  };

  const closeLoginModal = () => {
    setModalOpen(false);
    setLoginError("");
  };

  const handleAuthTab = (
    tab: "login" | "signup" | "reset-request" | "reset-password"
  ) => {
    setAuthTab(tab);
    setLoginError("");
    setResetMessage("");
  };

  // =========================
  // LOGIN
  // =========================

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoginError("");
    setLoginLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("loginEmail") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("loginPass") || "");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError(
          "INVALID SYSTEM CREDENTIALS. CHECK EMAIL/PASSWORD."
        );
        return;
      }

      if (result?.ok) {
        closeLoginModal();

        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      console.error("Login error:", error);

      setLoginError(
        "SYSTEM ERROR. PLEASE TRY AGAIN."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // =========================
  // SIGNUP
  // =========================

  const handleSignup = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoginError("");
    setSignupLoading(true);

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("signupName") || "").trim();
    const email = String(formData.get("signupEmail") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("signupPass") || "");
    const accountType = String(
      formData.get("signupAccountType") || "CREATOR"
    );

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          accountType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(
          data.error || "ACCOUNT CREATION FAILED. PLEASE TRY AGAIN."
        );
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        setLoginError(
          "ACCOUNT CREATED, BUT AUTOMATIC LOGIN FAILED. PLEASE LOG IN."
        );
        setAuthTab("login");
        return;
      }

      closeLoginModal();
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Signup error:", error);
      setLoginError(
        "SYSTEM ERROR. ACCOUNT COULD NOT BE CREATED."
      );
    } finally {
      setSignupLoading(false);
    }
  };

  // =========================
  // PASSWORD RESET
  // =========================

  const handleResetRequest = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoginError("");
    setResetMessage("");
    setResetLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("resetEmail") || "")
      .trim()
      .toLowerCase();

    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(
          data.error || "PASSWORD RESET REQUEST FAILED."
        );
        return;
      }

      setResetMessage(
        data.message ||
          "IF THAT ACCOUNT EXISTS, A RESET LINK HAS BEEN CREATED."
      );

      if (data.debugResetUrl) {
        setResetMessage(
          `LOCAL DEVELOPMENT RESET LINK: ${data.debugResetUrl}`
        );
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      setLoginError("SYSTEM ERROR. PLEASE TRY AGAIN.");
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasswordReset = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setLoginError("");
    setResetMessage("");
    setResetLoading(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("resetPassword") || "");
    const confirmPassword = String(
      formData.get("resetPasswordConfirm") || ""
    );

    if (password !== confirmPassword) {
      setLoginError("PASSWORDS DO NOT MATCH.");
      setResetLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: resetToken,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginError(
          data.error || "PASSWORD RESET FAILED."
        );
        return;
      }

      setResetMessage("PASSWORD UPDATED. YOU CAN NOW LOG IN.");
      setResetToken("");

      const url = new URL(window.location.href);
      url.searchParams.delete("resetToken");
      window.history.replaceState({}, "", url.toString());

      setTimeout(() => {
        setAuthTab("login");
        setResetMessage("");
      }, 1200);
    } catch (error) {
      console.error("Password reset error:", error);
      setLoginError("SYSTEM ERROR. PLEASE TRY AGAIN.");
    } finally {
      setResetLoading(false);
    }
  };

  // =========================
  // MOBILE MENU
  // =========================

  const toggleMobileMenu = () => {
    setMobileMenuOpen((previous) => !previous);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // =========================
  // CURSOR GLOW
  // =========================

  const cursorGlowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cursorGlow = cursorGlowRef.current;

    if (!cursorGlow) return;

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrame = 0;
    let isMoving = false;

    const animateCursor = () => {
      if (!isMoving) return;

      currentX += (mouseX - currentX) * 0.15;
      currentY += (mouseY - currentY) * 0.15;

      cursorGlow.style.transform =
        `translate3d(${currentX}px, ${currentY}px, 0)`;

      animationFrame = requestAnimationFrame(animateCursor);
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;

      if (!isMoving) {
        isMoving = true;
        cursorGlow.classList.add("active");

        animationFrame = requestAnimationFrame(
          animateCursor
        );
      }
    };

    const handleMouseLeave = () => {
      cursorGlow.classList.remove("active");
      isMoving = false;

      cancelAnimationFrame(animationFrame);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener(
        "mousemove",
        handleMouseMove
      );

      window.removeEventListener(
        "mouseleave",
        handleMouseLeave
      );

      cancelAnimationFrame(animationFrame);
    };
  }, []);

  // =========================
  // PROCESS CARD MOUSE EFFECT
  // =========================

  const handleProcessMouseMove = (
    event: React.MouseEvent<HTMLElement>
  ) => {
    const card = event.currentTarget;

    const rect = card.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  // =========================
  // WORK FILTER
  // =========================

  const workItems = [
    {
      category: "editing",
      className: "work-large",
      visual: "visual-purple",
      word: "NEXUS",
      number: "01 / POST-PRODUCTION",
      title: "Creator Content System",
    },
    {
      category: "social",
      visual: "visual-blue",
      word: "SHORT",
      number: "02 / SOCIAL",
      title: "Short-form Pipeline",
    },
    {
      category: "systems",
      visual: "visual-pink",
      word: "FLOW",
      number: "03 / SYSTEMS",
      title: "Content Operations",
    },
    {
      category: "editing",
      visual: "visual-orange",
      word: "CUT",
      number: "04 / EDITING",
      title: "Long-form Production",
    },
    {
      category: "social",
      visual: "visual-green",
      word: "LIVE",
      number: "05 / SOCIAL",
      title: "Creator Distribution",
    },
  ];

  // =========================
  // PRICING
  // =========================

  const isCustomPricing = pricingPeriod === "custom";

  // =========================
  // FAQ
  // =========================

  const faqData = [
    {
      question: "What exactly does Nexus Setups do?",
      answer:
        "We handle the operational and creative work around content creation — including editing, repurposing, organisation, management and delivery.",
    },
    {
      question: "Do I need to provide the raw footage?",
      answer:
        "Yes. You provide the raw material and creative direction where necessary. We handle the production work after that.",
    },
    {
      question: "Can you work with an existing team?",
      answer:
        "Absolutely. Nexus can operate as your complete production layer or integrate with an existing creative team.",
    },
    {
      question: "Is everything custom?",
      answer:
        "Our packages provide a starting point. Larger content operations can be structured around your exact workflow and output.",
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq((current) =>
      current === index ? null : index
    );
  };

  // =========================
  // PROJECT INTAKE
  // =========================

  const handleIntakeSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormMessage(
      "PROJECT BRIEF RECEIVED. THE NEXUS IS READY."
    );

    event.currentTarget.reset();
  };

  // =========================
  // SMOOTH SCROLL
  // =========================

  const handleAnchorClick = (
    event: React.MouseEvent<HTMLAnchorElement>
  ) => {
    const href = event.currentTarget.getAttribute("href");

    if (!href || !href.startsWith("#") || href === "#") {
      return;
    }

    const target = document.querySelector(href);

    if (!target) return;

    event.preventDefault();

    target.scrollIntoView({
      behavior: "smooth",
    });

    closeMobileMenu();
  };

  return (
    <>
      <InterfaceTranslator />

      {/* ATMOSPHERE */}

      <div className="noise"></div>

      <div className="grid-world">
        <div className="grid-floor"></div>

        <div
          className="cursor-glow"
          ref={cursorGlowRef}
        ></div>
      </div>

      {/* HEADER */}

      <header className="site-header">
        <a
          href="#top"
          className="brand"
          onClick={handleAnchorClick}
        >
          <span>NEXUS</span>
          <b>SETUPS</b>
        </a>

        <nav className="desktop-nav">
          <a href="#services" onClick={handleAnchorClick}>
            Services
          </a>

          <a href="#work" onClick={handleAnchorClick}>
            Work
          </a>

          <a href="#process" onClick={handleAnchorClick}>
            Process
          </a>

          <a href="#pricing" onClick={handleAnchorClick}>
            Pricing
          </a>

          <a href="#faq" onClick={handleAnchorClick}>
            FAQ
          </a>

          <a
            href="#contact"
            className="nav-cta"
            onClick={handleAnchorClick}
          >
            CONTACT
            <span>↗</span>
          </a>
        </nav>

        <div className="header-actions">
          <LanguageSelector compact />

          <button
            className="theme-toggle"
            id="themeToggle"
            type="button"
            aria-label="Toggle Light/Dark Mode"
            onClick={toggleTheme}
          >
            <span className="toggle-track">
              <span className="stars"></span>
              <span className="clouds"></span>

              <span className="toggle-thumb">
                <span className="crater c1"></span>
                <span className="crater c2"></span>
              </span>
            </span>
          </button>

          <button
            className={`nav-login ${session?.user ? "user-active" : ""}`}
            id="loginBtn"
            type="button"
            onClick={() => {
              if (session?.user) {
                router.push("/dashboard");
                return;
              }

              openLoginModal();
            }}
            disabled={sessionStatus === "loading"}
          >
            <span className="user-label">
              {sessionStatus === "loading"
                ? "CHECKING..."
                : session?.user
                  ? "DASHBOARD"
                  : "LOGIN"}
            </span>
            <i className="login-icon">
              {session?.user ? "↗" : "🗝"}
            </i>
          </button>

          <button
            className="menu-toggle"
            aria-label="Open menu"
            onClick={toggleMobileMenu}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}

      <div
        className={`mobile-menu ${mobileMenuOpen ? "open" : ""
          }`}
      >
        <div className="mobile-language-row">
          <LanguageSelector />
        </div>

        <a
          href="#services"
          onClick={handleAnchorClick}
        >
          Services
        </a>

        <a
          href="#work"
          onClick={handleAnchorClick}
        >
          Work
        </a>

        <a
          href="#process"
          onClick={handleAnchorClick}
        >
          Process
        </a>

        <a
          href="#pricing"
          onClick={handleAnchorClick}
        >
          Pricing
        </a>

        <a
          href="#faq"
          onClick={handleAnchorClick}
        >
          FAQ
        </a>

        <a
          href="#contact"
          onClick={handleAnchorClick}
        >
          Contact
        </a>

        <button
          className="mobile-login-btn"
          id="mobileLoginBtn"
          onClick={() => {
            closeMobileMenu();

            if (session?.user) {
              router.push("/dashboard");
              return;
            }

            openLoginModal();
          }}
          disabled={sessionStatus === "loading"}
        >
          {sessionStatus === "loading"
            ? "CHECKING SESSION..."
            : session?.user
              ? "OPEN DASHBOARD ↗"
              : "CLIENT PORTAL LOGIN 🔑"}
        </button>
      </div>

      <main id="top">

        {/* HERO */}

        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">
              CONTENT / POST-PRODUCTION / MANAGEMENT
            </div>

            <h1>
              YOUR CONTENT.
              <br />

              <span
                className="solid-banner type-target"
                data-text="OUR GRAVITY."
                ref={addTypeTarget}
              >
                <span className="typed-text"></span>
                <span className="cursor"></span>
              </span>
            </h1>

            <p className="hero-copy">
              Nexus Setups takes the work surrounding your
              content off your plate — editing, design,
              management and delivery — so your attention
              stays where it matters.
            </p>

            <div className="hero-actions">
              <a
                href="#contact"
                className="button button-primary"
                onClick={handleAnchorClick}
              >
                BUILD YOUR NEXUS
                <span>↗</span>
              </a>

              <a
                href="#work"
                className="button button-ghost"
                onClick={handleAnchorClick}
              >
                EXPLORE OUR WORK
              </a>
            </div>
          </div>

          <div className="hero-bottom">
            <div>
              <span className="mini-label">
                01 / THE PROBLEM
              </span>

              <p>
                Great content shouldn't require you to become
                a full-time editor.
              </p>
            </div>

            <div className="scroll-mark">
              SCROLL TO ENTER
              <i>↓</i>
            </div>

            <div className="hero-status">
              <span className="status-dot"></span>
              SYSTEM ONLINE
            </div>
          </div>

          <span className="side-label left-label">
            NEXUS / 001
          </span>

          <span className="side-label right-label">
            CONTENT SYSTEM
          </span>
        </section>

        {/* MANIFESTO */}

        <section className="manifesto">
          <div className="section-shell">
            <div className="section-number">01</div>

            <div className="manifesto-grid">
              <div>
                <span className="section-kicker">
                  THE NEXUS
                </span>
              </div>

              <div>
                <h2>
                  Everything
                  <br />

                  <span
                    className="solid-banner-sm type-target"
                    data-text="converges."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>

                <p className="large-copy">
                  Creating content is only one part of the job.
                  Editing it. Packaging it. Organising it.
                  Publishing it. Keeping everything moving.
                  That's where the real workload lives.
                </p>

                <p className="large-copy">
                  Nexus Setups becomes the system behind your
                  content operation — turning raw ideas and
                  footage into content that is ready to move.
                </p>

                <a
                  href="#services"
                  className="text-link"
                  onClick={handleAnchorClick}
                >
                  SEE WHAT WE HANDLE →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}

        <section
          className="services"
          id="services"
        >
          <div className="section-shell">
            <div className="section-number">02</div>

            <div className="section-heading-row">
              <div>
                <span className="section-kicker">
                  CAPABILITIES
                </span>

                <h2>
                  We handle
                  <br />

                  <span
                    className="solid-banner-sm type-target"
                    data-text="the rest."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>
              </div>

              <p className="section-description">
                From raw footage to finished content,
                Nexus connects the pieces of your production
                workflow into one system.
              </p>
            </div>

            <div className="service-stack">
              <article className="service-card service-purple">
                <span className="service-index">01</span>

                <div className="service-icon">
                  ◈
                </div>

                <div className="service-main">
                  <span className="service-type">
                    POST-PRODUCTION
                  </span>

                  <h3>
                    Editing that makes people stop scrolling.
                  </h3>

                  <p>
                    Long-form edits, short-form content,
                    gaming videos, social clips, podcasts
                    and everything between.
                  </p>

                  <span className="service-tag">
                    EDIT / CUT / POLISH
                  </span>
                </div>

                <span className="service-arrow">
                  ↗
                </span>
              </article>

              <article className="service-card service-blue">
                <span className="service-index">02</span>

                <div className="service-icon">
                  ◇
                </div>

                <div className="service-main">
                  <span className="service-type">
                    CONTENT SYSTEMS
                  </span>

                  <h3>
                    Turn one piece of content into many.
                  </h3>

                  <p>
                    We structure your content pipeline so
                    your biggest ideas keep producing content
                    long after the original upload.
                  </p>

                  <span className="service-tag">
                    REPURPOSE / SCALE / DISTRIBUTE
                  </span>
                </div>

                <span className="service-arrow">
                  ↗
                </span>
              </article>

              <article className="service-card service-pink">
                <span className="service-index">03</span>

                <div className="service-icon">
                  ◎
                </div>

                <div className="service-main">
                  <span className="service-type">
                    MANAGEMENT
                  </span>

                  <h3>
                    The operational layer behind your
                    content.
                  </h3>

                  <p>
                    Asset organisation, project management,
                    publishing workflows, creative coordination
                    and keeping your entire operation moving.
                  </p>

                  <span className="service-tag">
                    ORGANISE / MANAGE / DELIVER
                  </span>
                </div>

                <span className="service-arrow">
                  ↗
                </span>
              </article>
            </div>
          </div>
        </section>

        {/* WORK */}

        <section
          className="work"
          id="work"
        >
          <div className="section-shell">
            <div className="section-number">03</div>

            <div className="section-heading-row">
              <div>
                <span className="section-kicker">
                  SELECTED WORK
                </span>

                <h2>
                  Built to
                  <br />

                  <span
                    className="solid-banner-sm type-target"
                    data-text="perform."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>
              </div>

              <div className="work-tabs">
                {[
                  ["all", "ALL"],
                  ["editing", "EDITING"],
                  ["social", "SOCIAL"],
                  ["systems", "SYSTEMS"],
                ].map(([filter, label]) => (
                  <button
                    key={filter}
                    className={`work-tab ${workFilter === filter
                        ? "active"
                        : ""
                      }`}
                    onClick={() =>
                      setWorkFilter(filter)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="work-grid">
              {workItems.map((item, index) => {
                const visible =
                  workFilter === "all" ||
                  workFilter === item.category;

                return (
                  <article
                    key={item.title}
                    className={`work-card ${item.className || ""
                      } ${!visible ? "hidden" : ""}`}
                    data-category={item.category}
                  >
                    <div
                      className={`work-visual ${item.visual}`}
                    >
                      {item.visual ===
                        "visual-purple" && (
                          <div className="visual-ring"></div>
                        )}

                      {item.visual ===
                        "visual-pink" && (
                          <div className="visual-ring"></div>
                        )}

                      <div className="visual-word">
                        {item.word}
                      </div>

                      <div className="scanline"></div>
                    </div>

                    <div className="work-info">
                      <span>{item.number}</span>

                      <h3>{item.title}</h3>

                      {index === 0 && (
                        <div className="metric-strip">
                          <div>
                            <strong>4×</strong>
                            <span>OUTPUT</span>
                          </div>

                          <div>
                            <strong>62%</strong>
                            <span>FASTER</span>
                          </div>

                          <div>
                            <strong>38</strong>
                            <span>DELIVERABLES</span>
                          </div>

                          <div>
                            <strong>01</strong>
                            <span>SYSTEM</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* PROCESS */}

        <section
          className="process"
          id="process"
        >
          <div className="section-shell">
            <div className="section-number">04</div>

            <div className="process-intro">
              <div>
                <span className="section-kicker">
                  THE PROCESS
                </span>

                <h2>
                  Your content
                  <br />
                  enters the{" "}

                  <span
                    className="solid-banner-sm type-target"
                    data-text="system."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>
              </div>

              <p>
                Simple on your side. Structured on ours.
                You create. We make everything around it work.
              </p>
            </div>

            <div className="process-line"></div>

            <div className="process-grid">
              {[
                [
                  "01",
                  "Capture",
                  "You create. We receive the raw material and organise everything.",
                ],
                [
                  "02",
                  "Transform",
                  "Our editors and creatives turn raw material into finished content.",
                ],
                [
                  "03",
                  "Multiply",
                  "One idea becomes multiple pieces of platform-ready content.",
                ],
                [
                  "04",
                  "Deploy",
                  "Everything is organised, delivered and ready to publish.",
                ],
              ].map(([number, title, description]) => (
                <article
                  key={number}
                  onMouseMove={handleProcessMouseMove}
                >
                  <span>{number}</span>

                  <h3>{title}</h3>

                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}

        <section
          className="pricing"
          id="pricing"
        >
          <div className="section-shell">
            <div className="section-number">05</div>

            <div className="pricing-heading">
              <div>
                <span className="section-kicker">
                  PRICING
                </span>

                <h2>
                  Choose your
                  <br />

                  <span
                    className="solid-banner-sm type-target"
                    data-text="gravity."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>
              </div>

              <div className="pricing-switch">
                <button
                  className={`pricing-period ${pricingPeriod === "monthly"
                      ? "active"
                      : ""
                    }`}
                  onClick={() =>
                    setPricingPeriod("monthly")
                  }
                >
                  MONTHLY
                </button>

                <button
                  className={`pricing-period ${pricingPeriod === "custom"
                      ? "active"
                      : ""
                    }`}
                  onClick={() =>
                    setPricingPeriod("custom")
                  }
                >
                  CUSTOM
                </button>
              </div>
            </div>

            <div className="pricing-grid">
              <article className="price-card">
                <div className="price-top">
                  <span>CREATOR</span>

                  <small>
                    FOR INDIVIDUAL CREATORS
                  </small>
                </div>

                <div className="price-value">
                  <span className="currency">R</span>

                  <span className="price-number">
                    {isCustomPricing
                      ? "Custom"
                      : "8,999"}
                  </span>

                  {!isCustomPricing && (
                    <small>/MO</small>
                  )}
                </div>

                <div className="price-usd">
                  SIMPLE / FOCUSED / CONSISTENT
                </div>

                <ul>
                  <li>✓ Monthly editing support</li>
                  <li>✓ Short-form repurposing</li>
                  <li>✓ Content organisation</li>
                  <li>✓ Dedicated workflow</li>
                  <li>✓ Monthly reporting</li>
                </ul>

                <a
                  href="#contact"
                  className="button button-outline"
                  onClick={handleAnchorClick}
                >
                  GET STARTED
                </a>
              </article>

              <article className="price-card featured">
                <div className="popular-label">
                  MOST POPULAR
                </div>

                <div className="price-top">
                  <span>GROWTH</span>

                  <small>
                    FOR SERIOUS CONTENT OPERATIONS
                  </small>
                </div>

                <div className="price-value">
                  <span className="currency">R</span>

                  <span className="price-number">
                    {isCustomPricing
                      ? "Custom"
                      : "17,999"}
                  </span>

                  {!isCustomPricing && (
                    <small>/MO</small>
                  )}
                </div>

                <div className="price-usd">
                  HIGHER OUTPUT / LESS FRICTION
                </div>

                <ul>
                  <li>✓ Full post-production support</li>
                  <li>✓ Short-form content engine</li>
                  <li>✓ Content management</li>
                  <li>✓ Priority turnaround</li>
                  <li>✓ Creative direction</li>
                  <li>✓ Performance reporting</li>
                </ul>

                <a
                  href="#contact"
                  className="button button-primary"
                  onClick={handleAnchorClick}
                >
                  BUILD MY SYSTEM
                </a>
              </article>
            </div>

            <div className="enterprise-row">
              <div>
                <span>
                  ENTERPRISE / CUSTOM
                </span>

                <p>
                  Need something built around your operation?
                </p>
              </div>

              <a
                href="#contact"
                className="text-link"
                onClick={handleAnchorClick}
              >
                LET'S TALK →
              </a>
            </div>
          </div>
        </section>

        {/* CONTACT */}

        <section
          className="booking"
          id="contact"
        >
          <div className="section-shell">
            <div className="section-number">06</div>

            <div className="booking-grid">
              <div className="booking-copy">
                <span className="section-kicker">
                  START A PROJECT
                </span>

                <h2>
                  Enter the
                  <br />

                  <span
                    className="solid-banner-sm type-target"
                    data-text="nexus."
                    ref={addTypeTarget}
                  >
                    <span className="typed-text"></span>
                    <span className="cursor"></span>
                  </span>
                </h2>

                <p>
                  Tell us what you're building, what you're
                  struggling with and where you want to go.
                </p>

                <div className="booking-note">
                  <span>CURRENT STATUS</span>

                  <p>
                    Accepting new creator and brand
                    partnerships.
                  </p>
                </div>
              </div>

              <div className="booking-card">
                <div className="booking-card-top">
                  <span>PROJECT INTAKE</span>

                  <b>NEXUS / 006</b>
                </div>

                <form
                  id="intakeForm"
                  onSubmit={handleIntakeSubmit}
                >
                  <div className="form-two">
                    <div className="input-group">
                      <label htmlFor="name">
                        NAME
                      </label>

                      <input
                        type="text"
                        id="name"
                        placeholder="Your name"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label htmlFor="email">
                        EMAIL
                      </label>

                      <input
                        type="email"
                        id="email"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="company">
                      CREATOR / COMPANY
                    </label>

                    <input
                      type="text"
                      id="company"
                      placeholder="Your brand or channel"
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="service">
                      WHAT DO YOU NEED?
                    </label>

                    <select id="service">
                      <option value="">
                        Select a service
                      </option>

                      <option>
                        Post-production
                      </option>

                      <option>
                        Short-form content
                      </option>

                      <option>
                        Content management
                      </option>

                      <option>
                        Full content system
                      </option>

                      <option>
                        Something custom
                      </option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="button button-primary full-width"
                  >
                    SEND PROJECT BRIEF ↗
                  </button>

                  <p className="form-message">
                    {formMessage}
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}

        <section
          className="faq"
          id="faq"
        >
          <div className="section-shell">
            <div className="section-number">07</div>

            <div className="faq-heading">
              <span className="section-kicker">
                FAQ
              </span>

              <h2>
                Before you
                <br />

                <span
                  className="solid-banner-sm type-target"
                  data-text="enter."
                  ref={addTypeTarget}
                >
                  <span className="typed-text"></span>
                  <span className="cursor"></span>
                </span>
              </h2>
            </div>

            <div className="faq-list">
              {faqData.map((faq, index) => {
                const isOpen = openFaq === index;

                return (
                  <div
                    className={`faq-item ${isOpen ? "open" : ""
                      }`}
                    key={faq.question}
                  >
                    <button
                      className="faq-question"
                      onClick={() =>
                        toggleFaq(index)
                      }
                    >
                      {faq.question}

                      <b>
                        {isOpen ? "−" : "+"}
                      </b>
                    </button>

                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  </div>
                );
              })}

              <div
                className={`faq-item ${openFaq === 4 ? "open" : ""
                  }`}
              >
                <button
                  className="faq-question"
                  onClick={() => toggleFaq(4)}
                >
                  Where can I access the official brand
                  guidelines?

                  <b>
                    {openFaq === 4 ? "−" : "+"}
                  </b>
                </button>

                <div className="faq-answer">
                  <p>
                    Our full interactive brand identity and
                    visual strategy guide is available online.
                    You can view or download the complete
                    specifications directly via the{" "}
                    <a
                      href="/nexus-setups-brand-book.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color:
                          "var(--purple-bright)",
                        textDecoration:
                          "underline",
                      }}
                    >
                      Nexus Setups Brand Guide
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}

        <section className="final-cta">
          <div className="cta-orbit orbit-a"></div>
          <div className="cta-orbit orbit-b"></div>

          <span className="section-kicker">
            NEXUS SETUPS
          </span>

          <h2>
            Stop managing
            <br />

            <span
              className="solid-banner type-target"
              data-text="everything."
              ref={addTypeTarget}
            >
              <span className="typed-text"></span>
              <span className="cursor"></span>
            </span>
          </h2>

          <a
            href="#contact"
            className="button button-primary"
            onClick={handleAnchorClick}
          >
            BUILD YOUR NEXUS ↗
          </a>
        </section>
      </main>

      {/* LOGIN MODAL */}

      <div
        className={`modal-overlay ${modalOpen ? "active" : ""
          }`}
        id="loginModal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeLoginModal();
          }
        }}
      >
        <div className="auth-card">
          <button
            className="modal-close"
            id="modalClose"
            aria-label="Close Modal"
            onClick={closeLoginModal}
          >
            ✕
          </button>

          <div className="auth-header">
            <span className="auth-tag">
              SYSTEM ACCESS
            </span>

            <h3>NEXUS PORTAL</h3>
          </div>

          {(authTab === "login" || authTab === "signup") && (
            <div className="auth-tabs">
            <button
              className={`auth-tab ${authTab === "login"
                  ? "active"
                  : ""
                }`}
              onClick={() =>
                handleAuthTab("login")
              }
            >
              LOG IN
            </button>

            <button
              className={`auth-tab ${authTab === "signup"
                  ? "active"
                  : ""
                }`}
              onClick={() =>
                handleAuthTab("signup")
              }
            >
              CREATE ACCOUNT
            </button>
          </div>

          )}


          {authTab === "login" && (
            <form
              className="auth-form active"
              onSubmit={handleLogin}
            >
              <div className="form-field">
                <label htmlFor="loginEmail">
                  EMAIL ADDRESS
                </label>

                <input
                  type="email"
                  id="loginEmail"
                  name="loginEmail"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-field">
                <div className="label-row">
                  <label htmlFor="loginPass">
                    PASSWORD
                  </label>

                  <button
                    type="button"
                    className="forgot-pass"
                    onClick={() => handleAuthTab("reset-request")}
                  >
                    FORGOT?
                  </button>
                </div>

                <div className="password-wrapper">
                  <input
                    type={
                      showLoginPassword
                        ? "text"
                        : "password"
                    }
                    id="loginPass"
                    name="loginPass"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="toggle-pass"
                    onClick={() =>
                      setShowLoginPassword(
                        (current) => !current
                      )
                    }
                  >
                    {showLoginPassword
                      ? "🙈"
                      : "👁"}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="auth-error-msg active">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary auth-submit"
                disabled={loginLoading}
              >
                {loginLoading
                  ? "AUTHENTICATING..."
                  : "LOGIN ↗"}
              </button>
            </form>
          )}

          {authTab === "reset-request" && (
            <form
              className="auth-form active"
              onSubmit={handleResetRequest}
            >
              <div className="auth-reset-heading">
                <button
                  type="button"
                  className="auth-back-btn"
                  onClick={() => handleAuthTab("login")}
                >
                  ← BACK TO LOGIN
                </button>

                <h4>RESET PASSWORD</h4>

                <p>
                  Enter your account email. During local development,
                  Nexus will generate a secure reset link for testing.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="resetEmail">
                  EMAIL ADDRESS
                </label>

                <input
                  type="email"
                  id="resetEmail"
                  name="resetEmail"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              {loginError && (
                <p className="auth-error-msg active">
                  {loginError}
                </p>
              )}

              {resetMessage && (
                <p className="auth-reset-message active">
                  {resetMessage}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary auth-submit"
                disabled={resetLoading}
              >
                {resetLoading
                  ? "CREATING RESET LINK..."
                  : "CREATE RESET LINK ↗"}
              </button>
            </form>
          )}

          {authTab === "reset-password" && (
            <form
              className="auth-form active"
              onSubmit={handlePasswordReset}
            >
              <div className="auth-reset-heading">
                <h4>CREATE NEW PASSWORD</h4>

                <p>
                  Choose a new password for your Nexus account.
                </p>
              </div>

              <div className="form-field">
                <label htmlFor="resetPassword">
                  NEW PASSWORD
                </label>

                <div className="password-wrapper">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    id="resetPassword"
                    name="resetPassword"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="toggle-pass"
                    onClick={() =>
                      setShowResetPassword(
                        (current) => !current
                      )
                    }
                  >
                    {showResetPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="resetPasswordConfirm">
                  CONFIRM PASSWORD
                </label>

                <input
                  type={showResetPassword ? "text" : "password"}
                  id="resetPasswordConfirm"
                  name="resetPasswordConfirm"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {loginError && (
                <p className="auth-error-msg active">
                  {loginError}
                </p>
              )}

              {resetMessage && (
                <p className="auth-reset-message active">
                  {resetMessage}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary auth-submit"
                disabled={resetLoading}
              >
                {resetLoading
                  ? "UPDATING PASSWORD..."
                  : "UPDATE PASSWORD ↗"}
              </button>
            </form>
          )}

          {authTab === "signup" && (
            <form
              className="auth-form active"
              onSubmit={handleSignup}
            >
              <div className="form-field">
                <label htmlFor="signupName">
                  FULL NAME / BRAND
                </label>

                <input
                  type="text"
                  id="signupName"
                  name="signupName"
                  placeholder="Nexus Studio"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="signupEmail">
                  WORK EMAIL
                </label>

                <input
                  type="email"
                  id="signupEmail"
                  name="signupEmail"
                  placeholder="you@channel.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="form-field">
                <label>ACCOUNT TYPE</label>

                <div className="account-type-grid">
                  <label className="account-type-option">
                    <input
                      type="radio"
                      name="signupAccountType"
                      value="CREATOR"
                      defaultChecked
                    />

                    <span className="account-type-card">
                      <span className="account-type-heading">
                        <b>CREATOR</b>
                        <i>◉</i>
                      </span>

                      <small>
                        Submit content and manage your creator workspace.
                      </small>
                    </span>
                  </label>

                  <label className="account-type-option">
                    <input
                      type="radio"
                      name="signupAccountType"
                      value="EDITOR"
                    />

                    <span className="account-type-card">
                      <span className="account-type-heading">
                        <b>EDITOR</b>
                        <i>◇</i>
                      </span>

                      <small>
                        Manage production, reviews and creator content.
                      </small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="signupPass">
                  CREATE PASSWORD
                </label>

                <div className="password-wrapper">
                  <input
                    type={
                      showSignupPassword
                        ? "text"
                        : "password"
                    }
                    id="signupPass"
                    name="signupPass"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />

                  <button
                    type="button"
                    className="toggle-pass"
                    onClick={() =>
                      setShowSignupPassword(
                        (current) => !current
                      )
                    }
                  >
                    {showSignupPassword
                      ? "🙈"
                      : "👁"}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="auth-error-msg active">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="button button-primary auth-submit"
                disabled={signupLoading}
              >
                {signupLoading
                  ? "CREATING PROFILE..."
                  : "CREATE ACCOUNT ↗"}
              </button>
            </form>
          )}

          <div className="auth-footer">
            <span className="status-dot"></span>

            <span>
              SECURED BY NEXUS ENCRYPTION
            </span>
          </div>
        </div>
      </div>

      {/* FOOTER */}

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <a
              href="#top"
              className="brand"
              onClick={handleAnchorClick}
            >
              <span>NEXUS</span>
              <b>SETUPS</b>
            </a>

            <p>
              The production system behind your content.
            </p>
          </div>

          <div className="footer-column">
            <span>NAVIGATION</span>

            <a
              href="#services"
              onClick={handleAnchorClick}
            >
              Services
            </a>

            <a
              href="#work"
              onClick={handleAnchorClick}
            >
              Work
            </a>

            <a
              href="#process"
              onClick={handleAnchorClick}
            >
              Process
            </a>

            <a
              href="#pricing"
              onClick={handleAnchorClick}
            >
              Pricing
            </a>

            <a
              href="/nexus-setups-brand-book.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--purple-bright)",
              }}
            >
              Brand Guide ↗
            </a>
          </div>

          <div className="footer-column">
            <span>SOCIAL</span>

            <a href="#">Instagram</a>
            <a href="#">YouTube</a>
            <a href="#">X / Twitter</a>
          </div>

          <div className="footer-column">
            <span>CONTACT</span>

            <a href="mailto:hello@nexussetups.com">
              hello@nexussetups.com
            </a>

            <p>
              Cape Town / Remote
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2026 NEXUS SETUPS
          </span>

          <span>
            CONTENT / SYSTEMS / GRAVITY
          </span>
        </div>
      </footer>
    </>
  );
}