"use client";

/**
 * @param {{
 *   user?: {
 *     name?: string | null;
 *     email?: string | null;
 *   };
 * }} props
 */

import "./dashboard.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function CreatorDashboard({ user }) {
    const router = useRouter();

    // =========================
    // STATE MANAGEMENT
    // =========================
    const [theme, setTheme] = useState("dark");
    const [currentView, setCurrentView] = useState("overview");
    const [projectFilter, setProjectFilter] = useState("all");
    const [assetSearch, setAssetSearch] = useState("");
    const [activePlatform, setActivePlatform] = useState("all");
    const [briefModalOpen, setBriefModalOpen] = useState(false);
    const [briefError, setBriefError] = useState(false);
    const [briefSubmitting, setBriefSubmitting] = useState(false);
    const [settingsSaved, setSettingsSaved] = useState(false);

    // Projects now come from the database via /api/projects
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);

    // =========================
    // PROJECT FORMATTING HELPERS
    // =========================
    const resolutionForType = (type) =>
        type === "YouTube Long-form" ? "3840x2160" : "1080x1920";

    const formatProjectDate = (isoDate, type) => {
        if (!isoDate) return "";
        const d = new Date(isoDate);
        const month = d.toLocaleString("en-US", { month: "short" });
        const day = String(d.getDate()).padStart(2, "0");
        return `Created ${month} ${day} • ${resolutionForType(type)}`;
    };

    // Map a raw DB project record into the shape the UI renders
    const toDisplayProject = (p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        eta: p.eta,
        date: formatProjectDate(p.createdAt, p.type),
    });

    // =========================
    // FETCH PROJECTS FROM API
    // =========================
    const loadProjects = async () => {
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const res = await fetch("/api/projects");
            if (!res.ok) throw new Error("Failed to load projects");
            const data = await res.json();
            setProjects((data.projects || []).map(toDisplayProject));
        } catch (err) {
            setProjectsError("Couldn't load your projects. Try refreshing.");
        } finally {
            setProjectsLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // =========================
    // THEME INITIALIZATION
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
    // VIEW TITLES
    // =========================
    const viewTitles = {
        overview: "CREATOR OPERATIONS",
        projects: "PROJECTS & EDITS QUEUE",
        assets: "CREATOR ASSET VAULT",
        analytics: "PERFORMANCE ANALYTICS",
        settings: "WORKSPACE SETTINGS",
    };

    // =========================
    // ANALYTICS DATASETS
    // =========================
    const analyticsData = {
        all: {
            views: "2.4M", watchTime: "124,800", subs: "+42,100", revenue: "R48,920",
            graphTitle: "VIEWERSHIP TRAJECTORY (PAST 6 WEEKS)",
            distTitle: "DELIVERABLE FORMAT DISTRIBUTION",
            topTitle: "TOP PERFORMING CONTENT (LAST 7D)",
            svgArea: "M 0 150 Q 120 110, 240 120 T 480 45 L 600 25 L 600 200 L 0 200 Z",
            svgLine: "M 0 150 Q 120 110, 240 120 T 480 45 L 600 25",
            distribution: [
                { label: "TikTok / Reels", pct: "58%", color: "var(--purple-bright)" },
                { label: "YouTube Long-form", pct: "24%", color: "var(--blue)" },
                { label: "Clips & Shorts", pct: "12%", color: "var(--green)" },
                { label: "Podcasts & Audio", pct: "6%", color: "var(--yellow)" },
            ],
            topContent: [
                { badge: "YT", class: "yt", title: "PC Desk Setup Tour — 240Hz AM5 Upgrade", sub: "142,000 views • 94% VBR • 11:20 watch time", stat: "+14.2K subs" },
                { badge: "TT", class: "tt", title: "CoD Bo7 Camo Grind Movement Guide", sub: "890,000 views • 82% completion rate", stat: "+28.4K subs" },
                { badge: "X", class: "tw", title: "Futives Controller Settings Config Thread", sub: "45,200 impressions • 3,400 engagements", stat: "9.2% ER" },
            ]
        },
        youtube: {
            views: "1.6M", watchTime: "112,000", subs: "+18,400", revenue: "R38,400",
            graphTitle: "YOUTUBE VIEWS & WATCH TIME TRAJECTORY",
            distTitle: "YOUTUBE FORMAT BREAKDOWN",
            topTitle: "TOP YOUTUBE VIDEOS",
            svgArea: "M 0 170 Q 150 90, 300 100 T 500 35 L 600 20 L 600 200 L 0 200 Z",
            svgLine: "M 0 170 Q 150 90, 300 100 T 500 35 L 600 20",
            distribution: [
                { label: "Long-form 4K", pct: "75%", color: "var(--blue)" },
                { label: "YouTube Shorts", pct: "25%", color: "var(--purple-bright)" },
            ],
            topContent: [
                { badge: "YT", class: "yt", title: "PC Desk Setup Tour — 240Hz AM5 Upgrade", sub: "142,000 views • 94% VBR • 11:20 watch time", stat: "+14.2K subs" },
                { badge: "YT", class: "yt", title: "AM5 Motherboard BIOS Tuning Guide", sub: "98,000 views • 88% VBR • 8:40 watch time", stat: "+4,200 subs" },
            ]
        },
        tiktok: {
            views: "720K", watchTime: "12,200", subs: "+22,100", revenue: "R7,520",
            graphTitle: "TIKTOK REELS ENGAGEMENT SURGE",
            distTitle: "TIKTOK CONTENT STYLES",
            topTitle: "TOP TIKTOK SHORTS",
            svgArea: "M 0 180 Q 100 60, 250 80 T 450 30 L 600 15 L 600 200 L 0 200 Z",
            svgLine: "M 0 180 Q 100 60, 250 80 T 450 30 L 600 15",
            distribution: [
                { label: "Gameplay Montages", pct: "65%", color: "var(--purple-bright)" },
                { label: "Setup Showcase", pct: "35%", color: "var(--green)" },
            ],
            topContent: [
                { badge: "TT", class: "tt", title: "CoD Bo7 Camo Grind Movement Guide", sub: "890,000 views • 82% completion rate", stat: "+28.4K subs" },
                { badge: "TT", class: "tt", title: "Reverse Fan Airflow Setup Test", sub: "210,000 views • 91% completion rate", stat: "+6,100 subs" },
            ]
        },
        twitter: {
            views: "80K", watchTime: "600", subs: "+1,600", revenue: "R3,000",
            graphTitle: "X / TWITTER THREAD IMPRESSIONS",
            distTitle: "X MEDIA FORMATS",
            topTitle: "TOP X THREADS & CLIPS",
            svgArea: "M 0 160 Q 120 140, 240 130 T 480 90 L 600 70 L 600 200 L 0 200 Z",
            svgLine: "M 0 160 Q 120 140, 240 130 T 480 90 L 600 70",
            distribution: [
                { label: "Config Threads", pct: "70%", color: "var(--blue)" },
                { label: "Direct Video Clips", pct: "30%", color: "var(--yellow)" },
            ],
            topContent: [
                { badge: "X", class: "tw", title: "Futives Controller Settings Config Thread", sub: "45,200 impressions • 3,400 engagements", stat: "9.2% ER" },
                { badge: "X", class: "tw", title: "PKHeX Legality Checker Snippet", sub: "18,400 impressions • 1,200 engagements", stat: "6.4% ER" },
            ]
        }
    };

    const activeAnalytics = analyticsData[activePlatform] || analyticsData.all;

    // =========================
    // BRIEF SUBMISSION
    // =========================
    const handleBriefSubmit = async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const title = String(formData.get("briefTitle") || "").trim();
        const type = String(formData.get("briefType") || "");
        const link = String(formData.get("briefLink") || "").trim();

        if (!link.includes("http://") && !link.includes("https://")) {
            setBriefError(true);
            return;
        }

        setBriefError(false);
        setBriefSubmitting(true);

        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, type, footageLink: link }),
            });

            if (!res.ok) {
                setBriefError(true);
                setBriefSubmitting(false);
                return;
            }

            // Re-fetch so eta/queue position/date come from the server, not guessed client-side
            await loadProjects();

            setBriefModalOpen(false);
            setCurrentView("overview");
            form.reset();
        } catch (err) {
            setBriefError(true);
        } finally {
            setBriefSubmitting(false);
        }
    };

    // =========================
    // ASSET VAULT LIST
    // =========================
    const assets = [
        { icon: "📦", name: "Nexus_Desk_Setup.gltf", meta: "Blender 3D Asset • 48.2 MB", action: "DOWNLOAD" },
        { icon: "🎥", name: "CoD_Bo7_Match_04.mov", meta: "Raw Gameplay • 12.4 GB", action: "STREAM" },
        { icon: "🎨", name: "Nexus_Glassmorphism_Overlay.png", meta: "UI Overlay • 4.1 MB", action: "DOWNLOAD" },
        { icon: "🔊", name: "Cyberpunk_SFX_Pack_v2.zip", meta: "Audio FX • 182 MB", action: "DOWNLOAD" },
    ];

    const filteredAssets = assets.filter((asset) =>
        asset.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        asset.meta.toLowerCase().includes(assetSearch.toLowerCase())
    );

    return (
        <>
            <div className="noise"></div>

            <div className="app-shell">
                {/* SIDEBAR NAVIGATION */}
                <aside className="sidebar">
                    <a href="/homepage" className="brand">
                        <span>NEXUS</span>
                        <b>SETUPS</b>
                    </a>

                    <div className="sidebar-label">WORKSPACE</div>

                    <nav className="sidebar-nav">
                        {[
                            ["overview", "⚡", "Overview"],
                            ["projects", "🎬", "Projects & Edits"],
                            ["assets", "📁", "Asset Vault"],
                            ["analytics", "📊", "Analytics"],
                            ["settings", "⚙️", "Settings"],
                        ].map(([view, icon, label]) => (
                            <button
                                key={view}
                                type="button"
                                className={`nav-item ${currentView === view ? "active" : ""}`}
                                onClick={() => setCurrentView(view)}
                            >
                                <span className="icon">{icon}</span>
                                <span>{label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {(user?.name || "Nexus Studio")
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                        </div>
                        <div className="user-meta">
                            <strong>{user?.name || "Nexus Studio"}</strong>
                            <small>GROWTH PLAN</small>
                        </div>
                        <a
                            href="/homepage"
                            className="logout-btn"
                            title="Log Out"
                            onClick={(e) => {
                                e.preventDefault();
                                signOut({ callbackUrl: "/homepage" });
                            }}
                        >
                            ↗
                        </a>
                    </div>
                </aside>

                {/* MAIN DASHBOARD CONTENT */}
                <main className="dashboard-main">
                    {/* TOP BAR */}
                    <header className="dash-header">
                        <div className="page-title">
                            <span className="status-tag">ACTIVE SESSION</span>
                            <h2>{viewTitles[currentView]}</h2>
                        </div>

                        <div className="dash-actions">
                            <button
                                className="theme-toggle"
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
                                type="button"
                                className="button button-primary"
                                onClick={() => setBriefModalOpen(true)}
                            >
                                + NEW PROJECT BRIEF
                            </button>
                        </div>
                    </header>

                    {/* VIEW 1: OVERVIEW */}
                    <div className={`view-panel ${currentView === "overview" ? "active" : ""}`}>
                        <div className="panel-scroll-container">
                            <section className="metrics-grid">
                                <div className="metric-card">
                                    <span className="metric-label">ACTIVE EDITS</span>
                                    <strong className="metric-value">
                                        {projectsLoading ? "—" : String(projects.filter((p) => p.status !== "completed").length).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta positive">
                                        {projectsLoading ? "Loading…" : `↑ ${projects.filter((p) => p.status === "rendering").length} in rendering`}
                                    </span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">DELIVERED THIS MO.</span>
                                    <strong className="metric-value">18</strong>
                                    <span className="metric-delta">Target: 24 clips</span>
                                    <div className="metric-progress-bar">
                                        <div className="progress-fill" style={{ width: "75%" }}></div>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">STORAGE USED</span>
                                    <strong className="metric-value">412 GB</strong>
                                    <span className="metric-delta">of 1.0 TB Vault (41%)</span>
                                    <div className="metric-progress-bar">
                                        <div className="progress-fill storage" style={{ width: "41%" }}></div>
                                    </div>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">TURNAROUND AVG.</span>
                                    <strong className="metric-value">18h</strong>
                                    <span className="metric-delta positive">⚡ Priority Queue</span>
                                </div>
                            </section>

                            <section className="content-grid">
                                <div className="panel pipeline-panel">
                                    <div className="panel-header">
                                        <h3>ACTIVE PRODUCTION QUEUE</h3>
                                        <button
                                            type="button"
                                            className="text-link"
                                            onClick={() => setCurrentView("projects")}
                                        >
                                            VIEW ALL →
                                        </button>
                                    </div>

                                    <div className="project-list">
                                        {projectsLoading && <p className="text-link">Loading projects…</p>}
                                        {!projectsLoading && projectsError && <p className="brief-error-msg active">{projectsError}</p>}
                                        {!projectsLoading && !projectsError && projects.length === 0 && (
                                            <p className="text-link">No projects yet — submit a brief to get started.</p>
                                        )}
                                        {!projectsLoading && !projectsError && projects.slice(0, 3).map((proj) => (
                                            <div className="project-item" key={proj.id}>
                                                <div className="project-info">
                                                    <strong>{proj.title}</strong>
                                                    <small>{proj.type} • {resolutionForType(proj.type)}</small>
                                                </div>
                                                <div className={`project-status ${proj.status}`}>
                                                    {proj.status === "rendering" && "IN RENDERING"}
                                                    {proj.status === "review" && "NEEDS REVIEW"}
                                                    {proj.status === "queued" && "QUEUED"}
                                                    {proj.status === "completed" && "DELIVERED"}
                                                </div>
                                                <div className="project-eta">{proj.eta}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="panel activity-panel">
                                    <div className="panel-header">
                                        <h3>SYSTEM ACTIVITY</h3>
                                    </div>

                                    <ul className="activity-log">
                                        <li>
                                            <span className="time">10:14</span>
                                            <p><strong>Raw footage uploaded:</strong> <code>CoD_Bo7_Match_04.mov</code> (12.4 GB)</p>
                                        </li>
                                        <li>
                                            <span className="time">08:45</span>
                                            <p>Editor <strong>Alex M.</strong> exported draft for <em>Desk Setup Tour v1.2</em></p>
                                        </li>
                                        <li>
                                            <span className="time">YESTERDAY</span>
                                            <p>Asset Vault synced with <strong>Blender glTF 3D Setup Model</strong></p>
                                        </li>
                                        <li>
                                            <span className="time">AUG 02</span>
                                            <p>Delivered <strong>4x Short-form Reels</strong> for TikTok & Shorts</p>
                                        </li>
                                    </ul>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* VIEW 2: PROJECTS & EDITS */}
                    <div className={`view-panel ${currentView === "projects" ? "active" : ""}`}>
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <h3>ALL CREATOR PROJECTS</h3>
                                    <div className="filter-pills">
                                        {["all", "rendering", "review", "completed"].map((filter) => (
                                            <button
                                                key={filter}
                                                type="button"
                                                className={`filter-pill ${projectFilter === filter ? "active" : ""}`}
                                                onClick={() => setProjectFilter(filter)}
                                            >
                                                {filter.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="full-project-table">
                                    <div className="table-row table-head">
                                        <span>TITLE & FORMAT</span>
                                        <span>TYPE</span>
                                        <span>STATUS</span>
                                        <span>ETA / VERSION</span>
                                        <span>ACTION</span>
                                    </div>

                                    {projectsLoading && <p className="text-link" style={{ padding: "16px" }}>Loading projects…</p>}
                                    {!projectsLoading && projectsError && (
                                        <p className="brief-error-msg active" style={{ padding: "16px" }}>{projectsError}</p>
                                    )}
                                    {!projectsLoading && !projectsError && projects
                                        .filter((p) => projectFilter === "all" || p.status === projectFilter)
                                        .map((proj) => (
                                            <div className="table-row" key={proj.id}>
                                                <div className="project-title-cell">
                                                    <strong>{proj.title}</strong>
                                                    <small>{proj.date}</small>
                                                </div>
                                                <span className="cell-type">{proj.type}</span>
                                                <div>
                                                    <span className={`project-status ${proj.status}`}>
                                                        {proj.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="cell-eta">{proj.eta}</span>
                                                <div>
                                                    <button type="button" className={`action-btn ${proj.status === "review" ? "active" : ""}`}>
                                                        {proj.status === "completed" ? "DOWNLOAD 📥" : proj.status === "review" ? "REVIEW CUT ↗" : "VIEW BRIEF"}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VIEW 3: ASSET VAULT */}
                    <div className={`view-panel ${currentView === "assets" ? "active" : ""}`}>
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <h3>CREATOR ASSET VAULT</h3>
                                    <input
                                        type="text"
                                        className="dash-input"
                                        placeholder="Search 3D models, footage, overlays..."
                                        value={assetSearch}
                                        onChange={(e) => setAssetSearch(e.target.value)}
                                    />
                                </div>

                                <div className="asset-grid">
                                    {filteredAssets.map((asset, i) => (
                                        <div className="asset-card" key={i}>
                                            <div className="asset-icon">{asset.icon}</div>
                                            <div className="asset-details">
                                                <strong>{asset.name}</strong>
                                                <small>{asset.meta}</small>
                                            </div>
                                            <button type="button" className="asset-action">{asset.action}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* VIEW 4: ANALYTICS */}
                    <div className={`view-panel ${currentView === "analytics" ? "active" : ""}`}>
                        <div className="analytics-scroll-container">
                            <div className="analytics-platform-bar">
                                <span className="analytics-label">DATA SOURCE:</span>
                                <div className="platform-tabs">
                                    {[
                                        ["all", "🌐 ALL PLATFORMS"],
                                        ["youtube", "▶ YOUTUBE STUDIO"],
                                        ["tiktok", "📱 TIKTOK CREATOR"],
                                        ["twitter", "🐦 X / TWITTER"],
                                    ].map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            className={`platform-tab ${activePlatform === key ? "active" : ""}`}
                                            onClick={() => setActivePlatform(key)}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <section className="metrics-grid">
                                <div className="metric-card">
                                    <span className="metric-label">TOTAL VIEWS (28D)</span>
                                    <strong className="metric-value">{activeAnalytics.views}</strong>
                                    <span className="metric-delta positive">↑ 18.2% vs prev. 28d</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">WATCH TIME (HOURS)</span>
                                    <strong className="metric-value">{activeAnalytics.watchTime}</strong>
                                    <span className="metric-delta positive">↑ 24.5% vs prev. 28d</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">NEW SUBSCRIBERS / FOLLOWERS</span>
                                    <strong className="metric-value">{activeAnalytics.subs}</strong>
                                    <span className="metric-delta positive">⚡ Viral Surge Peak</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">ESTIMATED REVENUE</span>
                                    <strong className="metric-value">{activeAnalytics.revenue}</strong>
                                    <span className="metric-delta positive">AdSense + Brand Deals</span>
                                </div>
                            </section>

                            <section className="analytics-graphs-grid">
                                <div className="panel graph-panel">
                                    <div className="panel-header">
                                        <h3>{activeAnalytics.graphTitle}</h3>
                                        <span className="graph-tag">LIVE API SYNC</span>
                                    </div>
                                    <div className="chart-container">
                                        <svg className="line-chart" viewBox="0 0 600 210" preserveAspectRatio="none">
                                            <defs>
                                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="var(--purple-bright)" stopOpacity="0.35" />
                                                    <stop offset="100%" stopColor="var(--purple-bright)" stopOpacity="0.0" />
                                                </linearGradient>
                                            </defs>
                                            <line x1="0" y1="40" x2="600" y2="40" stroke="var(--line)" strokeDasharray="4" />
                                            <line x1="0" y1="100" x2="600" y2="100" stroke="var(--line)" strokeDasharray="4" />
                                            <line x1="0" y1="160" x2="600" y2="160" stroke="var(--line)" strokeDasharray="4" />

                                            <path d={activeAnalytics.svgArea} fill="url(#chartGradient)" />
                                            <path d={activeAnalytics.svgLine} fill="none" stroke="var(--purple-bright)" strokeWidth="3.5" strokeLinecap="round" />
                                        </svg>
                                        <div className="chart-labels">
                                            <span>Week 1</span>
                                            <span>Week 2</span>
                                            <span>Week 3</span>
                                            <span>Week 4</span>
                                            <span>Week 5</span>
                                            <span>Week 6</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="panel graph-panel">
                                    <div className="panel-header">
                                        <h3>{activeAnalytics.distTitle}</h3>
                                        <span className="graph-tag">BREAKDOWN</span>
                                    </div>
                                    <div className="bar-chart-container">
                                        {activeAnalytics.distribution.map((item, idx) => (
                                            <div className="bar-row" key={idx}>
                                                <span className="bar-label">{item.label}</span>
                                                <div className="bar-track">
                                                    <div className="bar-fill" style={{ width: item.pct, background: item.color }}></div>
                                                </div>
                                                <span className="bar-value">{item.pct}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <section className="social-hub-grid">
                                <div className="panel">
                                    <div className="panel-header">
                                        <h3>{activeAnalytics.topTitle}</h3>
                                        <span className="graph-tag">BY VIEWS</span>
                                    </div>
                                    <div className="top-content-list">
                                        {activeAnalytics.topContent.map((c, idx) => (
                                            <div className="top-content-item" key={idx}>
                                                <span className={`platform-badge ${c.class}`}>{c.badge}</span>
                                                <div className="content-meta">
                                                    <strong>{c.title}</strong>
                                                    <small>{c.sub}</small>
                                                </div>
                                                <span className="content-stat">{c.stat}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="panel">
                                    <div className="panel-header">
                                        <h3>AUDIENCE TRAFFIC & RETENTION</h3>
                                        <span className="graph-tag">INSIGHTS</span>
                                    </div>

                                    <div className="audience-stats-stack">
                                        <div className="stat-row">
                                            <div className="stat-info">
                                                <strong>Traffic Source: Suggested Videos / FYP</strong>
                                                <small>Algorithm-driven discovery</small>
                                            </div>
                                            <span className="stat-pct">64.2%</span>
                                        </div>
                                        <div className="metric-progress-bar">
                                            <div className="progress-fill" style={{ width: "64.2%" }}></div>
                                        </div>

                                        <div className="stat-row" style={{ marginTop: "14px" }}>
                                            <div className="stat-info">
                                                <strong>Audience Retention at 0:30</strong>
                                                <small>Hook effectiveness benchmark</small>
                                            </div>
                                            <span className="stat-pct">78.5%</span>
                                        </div>
                                        <div className="metric-progress-bar">
                                            <div className="progress-fill storage" style={{ width: "78.5%" }}></div>
                                        </div>

                                        <div className="stat-row" style={{ marginTop: "14px" }}>
                                            <div className="stat-info">
                                                <strong>Unique Viewers vs Returning</strong>
                                                <small>Subscriber loyalty ratio</small>
                                            </div>
                                            <span className="stat-pct">42% Loyal</span>
                                        </div>
                                        <div className="metric-progress-bar">
                                            <div className="progress-fill" style={{ width: "42%", background: "var(--green)" }}></div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* VIEW 5: SETTINGS */}
                    <div className={`view-panel ${currentView === "settings" ? "active" : ""}`}>
                        <div className="panel-scroll-container">
                            <div className="panel settings-panel">
                                <h3>ACCOUNT & WORKSPACE PREFERENCES</h3>

                                <form
                                    className="settings-form"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        setSettingsSaved(true);
                                        setTimeout(() => setSettingsSaved(false), 3000);
                                    }}
                                >
                                    <div className="form-row">
                                        <div className="form-field">
                                            <label htmlFor="stgName">STUDIO / CHANNEL NAME</label>
                                            <input type="text" id="stgName" className="dash-input" defaultValue={user?.name || "Nexus Studio"} />
                                        </div>

                                        <div className="form-field">
                                            <label htmlFor="stgEmail">PRIMARY EMAIL</label>
                                            <input type="email" id="stgEmail" className="dash-input" defaultValue={user?.email || ""} />
                                        </div>
                                    </div>

                                    <div className="form-field">
                                        <label htmlFor="stgPlan">SUBSCRIPTION PLAN</label>
                                        <input type="text" id="stgPlan" className="dash-input" defaultValue="GROWTH PLAN — R17,999/mo" disabled />
                                    </div>

                                    <button type="submit" className="button button-primary">SAVE PREFERENCES</button>
                                    <p className={`settings-saved-msg ${settingsSaved ? "active" : ""}`}>PREFERENCES SAVED SUCCESSFULLY ✓</p>
                                </form>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* NEW PROJECT BRIEF MODAL */}
            <div className={`modal-overlay ${briefModalOpen ? "active" : ""}`} onClick={(e) => {
                if (e.target === e.currentTarget) setBriefModalOpen(false);
            }}>
                <div className="brief-card">
                    <button className="modal-close" type="button" onClick={() => setBriefModalOpen(false)}>✕</button>

                    <div className="brief-header">
                        <span className="brief-tag">INTAKE ENGINE</span>
                        <h3>SUBMIT NEW PROJECT BRIEF</h3>
                    </div>

                    <form className="brief-form" onSubmit={handleBriefSubmit}>
                        <div className="form-field">
                            <label htmlFor="briefTitle">PROJECT TITLE</label>
                            <input type="text" id="briefTitle" name="briefTitle" className="dash-input" placeholder="e.g. CoD Bo7 Camo Grind Highlights" required />
                        </div>

                        <div className="form-field">
                            <label htmlFor="briefType">CONTENT TYPE</label>
                            <select id="briefType" name="briefType" className="dash-input" required>
                                <option value="Short-form">Short-form Reel / TikTok (1080x1920)</option>
                                <option value="YouTube Long-form">YouTube Long-form (4K / 1080p)</option>
                                <option value="Repurposed Cuts">Social Repurpose Pack</option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="briefLink">RAW FOOTAGE LINK / DRIVE</label>
                            <input type="text" id="briefLink" name="briefLink" className="dash-input" placeholder="https://youtube.com/... or https://drive.google.com/..." required />
                            <p className={`brief-error-msg ${briefError ? "active" : ""}`}>Please enter a valid URL, or check your connection and try again.</p>
                        </div>

                        <button type="submit" className="button button-primary full-width" disabled={briefSubmitting}>
                            {briefSubmitting ? "SUBMITTING…" : "SUBMIT TO PRODUCTION QUEUE ↗"}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}