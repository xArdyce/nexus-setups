"use client";

import "./homepage.css";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function NexusHomepage() {
  const router = useRouter();

  // =========================
  // STATE
  // =========================

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [modalOpen, setModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
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

  const handleAuthTab = (tab: "login" | "signup") => {
    setAuthTab(tab);
    setLoginError("");
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

    const email = String(formData.get("loginEmail") || "").trim();
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
  // SOCIAL LOGIN
  // =========================

  const handleSocialAuth = () => {
    localStorage.setItem("nexus-session", "active");

    closeLoginModal();

    router.push("/dashboard");
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
            className="nav-login"
            id="loginBtn"
            type="button"
            onClick={openLoginModal}
          >
            <span className="user-label">LOGIN</span>
            <i className="login-icon">🗝</i>
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
            openLoginModal();
          }}
        >
          CLIENT PORTAL LOGIN 🔑
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

          <div className="social-auth-grid">
            <button
              type="button"
              className="social-auth-btn social-google"
              onClick={handleSocialAuth}
            >
              <svg
                className="social-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
              >
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                />

                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                />

                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8s.1-1.9.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                />

                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                />
              </svg>

              <span>GOOGLE</span>
            </button>

            <button
              type="button"
              className="social-auth-btn social-apple"
              onClick={handleSocialAuth}
            >
              <svg
                className="social-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.12-1.96.99-3.1-.97.04-2.14.65-2.83 1.43-.62.72-1.16 1.88-1.01 3 .09.01.21.02.32.02 1.09 0 2.22-.59 2.53-1.35z" />
              </svg>

              <span>APPLE</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>OR VIA EMAIL</span>
          </div>

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
                  required
                />
              </div>

              <div className="form-field">
                <div className="label-row">
                  <label htmlFor="loginPass">
                    PASSWORD
                  </label>

                  <a
                    href="#"
                    className="forgot-pass"
                    onClick={(event) =>
                      event.preventDefault()
                    }
                  >
                    FORGOT?
                  </a>
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

              <div className="auth-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    defaultChecked
                  />

                  <span>
                    REMEMBER SESSION
                  </span>
                </label>
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