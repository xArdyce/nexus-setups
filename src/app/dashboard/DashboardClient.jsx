"use client";

/**
 * @param {{
 *   user?: {
 *     id?: string;
 *     name?: string | null;
 *     email?: string | null;
 *     accountType?: "CREATOR" | "EDITOR";
 *   };
 * }} props
 */

import "./dashboard.css";
import "./dashboard-target.css";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { InterfaceTranslator, LanguageSelector } from "@/components/InterfaceLanguage";

export default function CreatorDashboard({ user }) {
    const accountType = user?.accountType || "CREATOR";
    const isEditor = accountType === "EDITOR";
    const isCreator = accountType === "CREATOR";

    const [theme, setTheme] = useState("dark");
    const themeTransitionTimerRef = useRef(null);
    const [currentView, setCurrentView] = useState("overview");
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const sidebarRef = useRef(null);
    const menuButtonRef = useRef(null);

    useEffect(() => {
        if (!mobileSidebarOpen) return;
        const sidebar = sidebarRef.current;
        const focusable = () => Array.from(sidebar.querySelectorAll(
            'a[href], button:not(:disabled), [tabindex="0"]'
        ));
        focusable()[0]?.focus();
        const onKeyDown = (event) => {
            if (event.key === "Escape") setMobileSidebarOpen(false);
            if (event.key !== "Tab") return;
            const items = focusable();
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        const media = window.matchMedia("(max-width: 680px)");
        const onResize = () => {
            if (!media.matches) setMobileSidebarOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        media.addEventListener("change", onResize);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            media.removeEventListener("change", onResize);
            if (media.matches) menuButtonRef.current?.focus();
        };
    }, [mobileSidebarOpen]);
    const [projectFilter, setProjectFilter] = useState("all");
    const [projectSearch, setProjectSearch] = useState("");
    const [projectCreatorFilter, setProjectCreatorFilter] =
        useState("all");
    const [projectEditorFilter, setProjectEditorFilter] =
        useState("all");
    const [projectTypeFilter, setProjectTypeFilter] =
        useState("all");
    const [projectSort, setProjectSort] =
        useState("updated-desc");
    const [assetSearch, setAssetSearch] = useState("");
    const [assetDeletePrompt, setAssetDeletePrompt] = useState(null);
    const assetDeleteDialogRef = useRef(null);
    const assetDeleteResolveRef = useRef(null);
    useEffect(() => {
        if (assetDeletePrompt) assetDeleteDialogRef.current?.showModal();
    }, [assetDeletePrompt]);
    const [briefModalOpen, setBriefModalOpen] = useState(false);
    const briefDialogRef = useRef(null);
    useEffect(() => {
        if (!briefModalOpen) return;
        const previousFocus = document.activeElement;
        const dialog = briefDialogRef.current;
        const controls = () => Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
        controls()[0]?.focus();
        const onKeyDown = (event) => {
            if (event.key === "Escape") setBriefModalOpen(false);
            if (event.key !== "Tab") return;
            const items = controls();
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        dialog.addEventListener("keydown", onKeyDown);
        return () => { dialog.removeEventListener("keydown", onKeyDown); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
    }, [briefModalOpen]);
    const [briefError, setBriefError] = useState(false);
    const [briefSubmitting, setBriefSubmitting] = useState(false);

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);
    const [projectsNextCursor, setProjectsNextCursor] =
        useState(null);
    const [projectsHasMore, setProjectsHasMore] =
        useState(false);
    const [projectsLoadingMore, setProjectsLoadingMore] =
        useState(false);
    const [debouncedProjectSearch, setDebouncedProjectSearch] =
        useState("");

    const [organizations, setOrganizations] = useState([]);
    const [organizationsLoading, setOrganizationsLoading] = useState(true);
    const [organizationsError, setOrganizationsError] = useState(null);
    const [activeOrganizationId, setActiveOrganizationId] = useState(null);

    const [creators, setCreators] = useState([]);
    const [creatorsLoading, setCreatorsLoading] = useState(true);
    const [creatorsError, setCreatorsError] = useState(null);

    const [selectedProject, setSelectedProject] = useState(null);
    const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
    const [projectDetailsError, setProjectDetailsError] = useState(null);
    const [projectStatusUpdating, setProjectStatusUpdating] = useState(false);
    const [projectDeleting, setProjectDeleting] = useState(false);
    const [projectEditing, setProjectEditing] = useState(false);
    const [projectEditSaving, setProjectEditSaving] = useState(false);
    const [projectEditError, setProjectEditError] = useState(null);
    const [projectEditDraft, setProjectEditDraft] = useState({
        title: "",
        description: "",
        footageLink: "",
        contentType: "Short-form",
        dueDate: "",
    });
    const [reviewNote, setReviewNote] = useState("");
    const [reviewComment, setReviewComment] = useState("");
    const [reviewTimestamp, setReviewTimestamp] = useState("");
    const [reviewCommentSubmitting, setReviewCommentSubmitting] =
        useState(false);
    const [reviewCommentUpdatingId, setReviewCommentUpdatingId] =
        useState(null);
    const [reviewCommentDeletingId, setReviewCommentDeletingId] =
        useState(null);
    const [reviewCommentEditingId, setReviewCommentEditingId] =
        useState(null);
    const [reviewCommentEditDraft, setReviewCommentEditDraft] =
        useState({
            comment: "",
            timestamp: "",
        });
    const [reviewError, setReviewError] = useState(null);

    const [selectedCreator, setSelectedCreator] = useState(null);

    const [projectAssignments, setProjectAssignments] = useState([]);
    const [inheritedProjectEditors, setInheritedProjectEditors] =
        useState([]);
    const [availableEditors, setAvailableEditors] = useState([]);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [assignmentsError, setAssignmentsError] = useState(null);
    const [canManageAssignments, setCanManageAssignments] = useState(false);
    const [assignmentUpdatingUserId, setAssignmentUpdatingUserId] =
        useState(null);

    const [creatorAssignments, setCreatorAssignments] = useState([]);
    const [creatorAvailableEditors, setCreatorAvailableEditors] =
        useState([]);
    const [creatorAssignmentsLoading, setCreatorAssignmentsLoading] =
        useState(false);
    const [creatorAssignmentsError, setCreatorAssignmentsError] =
        useState(null);
    const [
        canManageCreatorAssignments,
        setCanManageCreatorAssignments,
    ] = useState(false);
    const [
        creatorAssignmentUpdatingUserId,
        setCreatorAssignmentUpdatingUserId,
    ] = useState(null);

    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [tasksError, setTasksError] = useState(null);
    const [taskDrafts, setTaskDrafts] = useState({});
    const [taskCreating, setTaskCreating] = useState(false);
    const [taskUpdatingId, setTaskUpdatingId] = useState(null);
    const [taskDeletingId, setTaskDeletingId] = useState(null);
    const [expandedCompletedTasks, setExpandedCompletedTasks] =
        useState({});
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: "",
        assignedToId: "",
    });

    const [assets, setAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(true);
    const [assetsError, setAssetsError] = useState(null);
    const [assetUploadContentId, setAssetUploadContentId] =
        useState("");
    const [assetUploadFile, setAssetUploadFile] =
        useState(null);
    const [assetUploadType, setAssetUploadType] =
        useState("OTHER");
    const [assetUploadProgress, setAssetUploadProgress] =
        useState(0);
    const [assetUploading, setAssetUploading] =
        useState(false);
    const [assetUploadError, setAssetUploadError] =
        useState(null);
    const [assetDeletingId, setAssetDeletingId] =
        useState(null);
    const [assetVersionUploadingId, setAssetVersionUploadingId] =
        useState(null);
    const [assetVersionUploadProgress, setAssetVersionUploadProgress] =
        useState(0);
    const [assetVersionError, setAssetVersionError] =
        useState(null);
    const [expandedAssetVersions, setExpandedAssetVersions] =
        useState({});

    const [activity, setActivity] = useState([]);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityError, setActivityError] = useState(null);
    const [showAllOverviewActivity, setShowAllOverviewActivity] =
        useState(false);

    const [notifications, setNotifications] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] =
        useState(0);
    const [notificationsLoading, setNotificationsLoading] =
        useState(true);
    const [notificationsError, setNotificationsError] =
        useState(null);
    const [notificationMenuOpen, setNotificationMenuOpen] =
        useState(false);
    const [notificationUpdatingId, setNotificationUpdatingId] =
        useState(null);
    const [markingAllNotificationsRead, setMarkingAllNotificationsRead] =
        useState(false);

    const [settingsProfile, setSettingsProfile] =
        useState(null);
    const [settingsLoading, setSettingsLoading] =
        useState(true);
    const [settingsError, setSettingsError] =
        useState(null);
    const [settingsSuccess, setSettingsSuccess] =
        useState(null);
    const [settingsSaving, setSettingsSaving] =
        useState(null);

    const confirmAndSignOut = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmed) {
            return;
        }

        await signOut({
            callbackUrl: "/",
        });
    };


    const [profileDraft, setProfileDraft] =
        useState({
            name: user?.name || "",
            email: user?.email || "",
            currentPassword: "",
        });

    const [passwordDraft, setPasswordDraft] =
        useState({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });

    const [workspaceNameDraft, setWorkspaceNameDraft] =
        useState("");

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [currentView]);

    const normalizeProjectStatus = (status) => {
        const legacyStatusMap = {
            rendering: "IN_PRODUCTION",
            review: "IN_REVIEW",
            queued: "REQUESTED",
            completed: "APPROVED",
        };

        return legacyStatusMap[status] || status;
    };

    const displayStatus = (status) => {
        const labels = {
            REQUESTED: "REQUESTED",
            IN_PRODUCTION: "IN PRODUCTION",
            IN_REVIEW: "IN REVIEW",
            REVISION: "REVISION",
            APPROVED: "APPROVED",
        };

        const normalized = normalizeProjectStatus(status);

        return (
            labels[normalized] ||
            normalized?.replaceAll("_", " ") ||
            "UNKNOWN"
        );
    };

    const displayTaskStatus = (status) => {
        const labels = {
            TODO: "TO DO",
            IN_PROGRESS: "IN PROGRESS",
            IN_REVIEW: "IN REVIEW",
            COMPLETED: "COMPLETED",
        };

        return labels[status] || status?.replaceAll("_", " ") || "UNKNOWN";
    };

    const displayTaskPriority = (priority) => {
        const labels = {
            LOW: "LOW",
            MEDIUM: "MEDIUM",
            HIGH: "HIGH",
            URGENT: "URGENT",
        };

        return labels[priority] || priority || "MEDIUM";
    };

    const isGoogleDriveFolderUrl = (value) => {
        try {
            const url = new URL(String(value || "").trim());

            return (
                url.protocol === "https:" &&
                url.hostname === "drive.google.com" &&
                /^\/drive\/(?:u\/\d+\/)?folders\/[^/]+\/?$/.test(
                    url.pathname
                )
            );
        } catch {
            return false;
        }
    };

    const parseReviewTimestamp = (value) => {
        const raw = String(value || "").trim();

        if (!raw) {
            return null;
        }

        if (/^\d+$/.test(raw)) {
            return Number(raw);
        }

        const parts = raw.split(":").map(Number);

        if (
            parts.some((part) => !Number.isFinite(part) || part < 0) ||
            parts.length < 2 ||
            parts.length > 3
        ) {
            return Number.NaN;
        }

        if (parts.some((part, index) => index > 0 && part >= 60)) {
            return Number.NaN;
        }

        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }

        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    };

    const formatReviewTimestamp = (value) => {
        if (value === null || value === undefined) {
            return null;
        }

        const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(
                seconds
            ).padStart(2, "0")}`;
        }

        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    const formatActivityTime = (value) => {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString([], {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatRelativeTime = (value) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        const diffMs = Date.now() - date.getTime();
        const future = diffMs < 0;
        const diff = Math.abs(diffMs);

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {
            return future ? "in a moment" : "just now";
        }

        if (minutes < 60) {
            return future
                ? `in ${minutes} min`
                : `${minutes} min ago`;
        }

        if (hours < 24) {
            return future
                ? `in ${hours} hour${hours === 1 ? "" : "s"}`
                : `${hours} hour${hours === 1 ? "" : "s"} ago`;
        }

        if (days < 7) {
            return future
                ? `in ${days} day${days === 1 ? "" : "s"}`
                : `${days} day${days === 1 ? "" : "s"} ago`;
        }

        return date.toLocaleDateString([], {
            month: "short",
            day: "2-digit",
            year: "numeric",
        });
    };

    const formatActivityDescription = (entry) => {
        const actor = entry?.actorName || "Nexus user";
        const metadata = entry?.metadata || {};
        const title =
            metadata.contentTitle ||
            metadata.title ||
            "project";

        switch (entry?.action) {
            case "CONTENT_SUBMITTED":
                return `${actor} submitted ${title}.`;

            case "CONTENT_STATUS_CHANGED":
                return `${actor} moved ${title} from ${displayStatus(
                    metadata.previousStatus
                )} to ${displayStatus(metadata.newStatus)}.`;

            case "CONTENT_DETAILS_UPDATED":
                return `${actor} updated the project details for ${title}.`;

            case "EDITOR_ASSIGNED_TO_CONTENT":
                return `${actor} assigned ${
                    metadata.editorName || "an Editor"
                } to ${title}.`;

            case "EDITOR_UNASSIGNED_FROM_CONTENT":
                return `${actor} removed ${
                    metadata.editorName || "an Editor"
                } from ${title}.`;

            case "EDITOR_ASSIGNED_TO_CREATOR":
                return `${actor} assigned ${
                    metadata.editorName || "an Editor"
                } to ${
                    metadata.creatorName || "a Creator workspace"
                }.`;

            case "EDITOR_UNASSIGNED_FROM_CREATOR":
                return `${actor} removed ${
                    metadata.editorName || "an Editor"
                } from ${
                    metadata.creatorName || "a Creator workspace"
                }.`;

            case "REVIEW_COMMENT_ADDED": {
                const versionLabel =
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : "";
                const timestamp =
                    metadata.timestamp !== null &&
                    metadata.timestamp !== undefined
                        ? ` at ${formatReviewTimestamp(
                              metadata.timestamp
                          )}`
                        : "";

                return `${actor} added review feedback to ${title}${versionLabel}${timestamp}.`;
            }

            case "REVIEW_COMMENT_EDITED":
                return `${actor} edited review feedback on ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "REVIEW_COMMENT_RESOLVED":
                return `${actor} resolved review feedback on ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "REVIEW_COMMENT_REOPENED":
                return `${actor} reopened review feedback on ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "REVIEW_COMMENT_DELETED":
                return `${actor} deleted review feedback from ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "REVIEW_APPROVED":
                return `${actor} approved ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "REVIEW_REVISION_REQUESTED":
                return `${actor} requested revisions for ${title}${
                    metadata.assetVersion
                        ? ` v${metadata.assetVersion}`
                        : ""
                }.`;

            case "ASSET_UPLOADED":
                return `${actor} uploaded ${
                    metadata.fileName || "an asset"
                } to ${title}.`;

            case "ASSET_VERSION_UPLOADED":
                return `${actor} uploaded v${
                    metadata.version || "?"
                } of ${
                    metadata.fileName || "an asset"
                } to ${title}.`;

            case "DELIVERY_PACKAGE_DOWNLOADED":
                return `${actor} downloaded the final delivery package for ${title}.`;

            case "ASSET_DELETED":
                return `${actor} deleted ${
                    metadata.fileName || "an asset"
                } from ${title}.`;

            case "ORGANIZATION_RENAMED":
                return `${actor} renamed the workspace from ${
                    metadata.previousName || "the previous name"
                } to ${
                    metadata.newName || "a new name"
                }.`;

            default:
                return `${actor} ${String(
                    entry?.action || "updated the workspace"
                )
                    .toLowerCase()
                    .replaceAll("_", " ")}.`;
        }
    };

    const resolutionForType = (type) =>
        type === "YouTube Long-form" ? "3840x2160" : "1080x1920";

    const formatProjectDate = (isoDate, type) => {
        if (!isoDate) return "";

        const d = new Date(isoDate);
        const month = d.toLocaleString("en-US", {
            month: "short",
        });
        const day = String(d.getDate()).padStart(2, "0");

        return `Created ${month} ${day} • ${resolutionForType(type)}`;
    };

    const toDisplayProject = (p) => ({
        id: p.id,
        projectId: p.projectId,
        title: p.title,
        type: p.type,
        status: normalizeProjectStatus(
            p.rawStatus || p.status
        ),
        eta: p.eta,
        dueDate: p.dueDate || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt || p.createdAt,
        creator: p.creator || null,
        assignedEditors: p.assignedEditors || [],
        date: formatProjectDate(p.createdAt, p.type),
    });

    const projectCreatorOptions = Array.from(
        new Map(
            creators
                .filter((creator) => creator?.id)
                .map((creator) => [
                    creator.id,
                    creator,
                ])
        ).values()
    ).sort((a, b) =>
        String(a.name || a.email || "").localeCompare(
            String(b.name || b.email || "")
        )
    );

    const projectEditorOptions = Array.from(
        new Map(
            projects.flatMap((project) =>
                (project.assignedEditors || []).map(
                    (editor) => [editor.id, editor]
                )
            )
        ).values()
    ).sort((a, b) =>
        String(a.name || a.email || "").localeCompare(
            String(b.name || b.email || "")
        )
    );

    const filteredAndSortedProjects = projects;
    const hasProjectFilters = Boolean(projectSearch.trim()) || projectFilter !== "all" ||
        projectCreatorFilter !== "all" || projectEditorFilter !== "all" || projectTypeFilter !== "all";
    const clearProjectFilters = () => {
        setProjectSearch("");
        setProjectFilter("all");
        setProjectCreatorFilter("all");
        setProjectEditorFilter("all");
        setProjectTypeFilter("all");
    };


    const loadOrganizations = async () => {
        setOrganizationsLoading(true);
        setOrganizationsError(null);

        try {
            const res = await fetch("/api/organizations");

            if (!res.ok) {
                throw new Error("Failed to load organizations");
            }

            const data = await res.json();
            const loadedOrganizations = data.organizations || [];

            setOrganizations(loadedOrganizations);

            if (loadedOrganizations.length > 0) {
                setActiveOrganizationId((currentId) => {
                    const stillExists = loadedOrganizations.some(
                        (org) => org.id === currentId
                    );

                    return stillExists
                        ? currentId
                        : loadedOrganizations[0].id;
                });
            } else {
                setActiveOrganizationId(null);

                setProjects([]);
                setCreators([]);
                setAssets([]);

                setProjectsError(null);
                setCreatorsError(null);
                setAssetsError(null);

                setProjectsLoading(false);
                setCreatorsLoading(false);
                setAssetsLoading(false);

                setSelectedProject(null);
                setSelectedCreator(null);
            }
        } catch (err) {
            console.error("Failed to load organizations:", err);

            setOrganizationsError(
                "Couldn't load your organizations. Try refreshing."
            );
        } finally {
            setOrganizationsLoading(false);
        }
    };

    const loadCreators = async (organizationId) => {
        if (!organizationId) {
            setCreators([]);
            setCreatorsLoading(false);
            return;
        }

        setCreatorsLoading(true);
        setCreatorsError(null);

        try {
            const res = await fetch(
                `/api/creators?organizationId=${encodeURIComponent(
                    organizationId
                )}`
            );

            if (!res.ok) {
                throw new Error("Failed to load creators");
            }

            const data = await res.json();

            setCreators(data.creators || []);
        } catch (err) {
            console.error("Failed to load creators:", err);

            setCreatorsError(
                "Couldn't load your creators. Try refreshing."
            );

            setCreators([]);
        } finally {
            setCreatorsLoading(false);
        }
    };

    const loadAssets = async (organizationId = activeOrganizationId) => {
        if (!organizationId) {
            setAssets([]);
            setAssetsLoading(false);
            return;
        }

        setAssetsLoading(true);
        setAssetsError(null);

        try {
            const params = new URLSearchParams({
                organizationId,
            });

            if (assetSearch.trim()) {
                params.set("search", assetSearch.trim());
            }

            const res = await fetch(`/api/assets?${params.toString()}`);

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to load assets.");
            }

            setAssets(data.assets || []);
        } catch (error) {
            console.error("Failed to load assets:", error);

            setAssetsError(
                "Couldn't load your assets. Try refreshing."
            );

            setAssets([]);
        } finally {
            setAssetsLoading(false);
        }
    };

    const inferAssetTypeFromFile = (file) => {
        const mimeType =
            String(file?.type || "").toLowerCase();

        if (mimeType.startsWith("video/")) {
            return "VIDEO";
        }

        if (mimeType.startsWith("image/")) {
            return "IMAGE";
        }

        if (mimeType.startsWith("audio/")) {
            return "AUDIO";
        }

        if (
            mimeType.startsWith("text/") ||
            mimeType.includes("pdf") ||
            mimeType.includes("document") ||
            mimeType.includes("spreadsheet") ||
            mimeType.includes("presentation")
        ) {
            return "DOCUMENT";
        }

        return "OTHER";
    };

    const uploadFileToSignedUrl = (
        uploadUrl,
        file,
        requiredHeaders,
        onProgress = setAssetUploadProgress
    ) =>
        new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.open("PUT", uploadUrl);

            Object.entries(
                requiredHeaders || {}
            ).forEach(([name, value]) => {
                if (value) {
                    xhr.setRequestHeader(
                        name,
                        value
                    );
                }
            });

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable) {
                    return;
                }

                onProgress(
                    Math.round(
                        (event.loaded /
                            event.total) *
                            100
                    )
                );
            };

            xhr.onload = () => {
                if (
                    xhr.status >= 200 &&
                    xhr.status < 300
                ) {
                    resolve();
                    return;
                }

                reject(
                    new Error(
                        `R2 upload failed with status ${xhr.status}.`
                    )
                );
            };

            xhr.onerror = () => {
                reject(
                    new Error(
                        "The browser could not upload the file to Cloudflare R2. Check the bucket CORS settings."
                    )
                );
            };

            xhr.send(file);
        });

    const handleAssetFileChange = (
        event
    ) => {
        const file =
            event.target.files?.[0] || null;

        setAssetUploadFile(file);
        setAssetUploadError(null);
        setAssetUploadProgress(0);

        if (file) {
            setAssetUploadType(
                inferAssetTypeFromFile(file)
            );
        }
    };

    const uploadAsset = async (event) => {
        event.preventDefault();

        if (
            !assetUploadContentId ||
            !assetUploadFile
        ) {
            setAssetUploadError(
                "Choose a project and a file first."
            );
            return;
        }

        setAssetUploading(true);
        setAssetUploadProgress(0);
        setAssetUploadError(null);

        try {
            const prepareRes = await fetch(
                "/api/assets/upload-url",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        contentId:
                            assetUploadContentId,
                        fileName:
                            assetUploadFile.name,
                        fileSize:
                            assetUploadFile.size,
                        mimeType:
                            assetUploadFile.type ||
                            "application/octet-stream",
                    }),
                }
            );

            const prepareData =
                await prepareRes.json();

            if (!prepareRes.ok) {
                throw new Error(
                    prepareData.error ||
                        "Failed to prepare upload."
                );
            }

            await uploadFileToSignedUrl(
                prepareData.uploadUrl,
                assetUploadFile,
                prepareData.requiredHeaders
            );

            const finalizeRes =
                await fetch("/api/assets", {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        contentId:
                            assetUploadContentId,
                        storageKey:
                            prepareData.storageKey,
                        fileName:
                            assetUploadFile.name,
                        fileSize:
                            assetUploadFile.size,
                        mimeType:
                            assetUploadFile.type ||
                            "application/octet-stream",
                        assetType:
                            assetUploadType,
                    }),
                });

            const finalizeData =
                await finalizeRes.json();

            if (!finalizeRes.ok) {
                throw new Error(
                    finalizeData.error ||
                        "The file reached R2, but Nexus could not register the asset."
                );
            }

            setAssetUploadFile(null);
            setAssetUploadProgress(100);

            const fileInput =
                document.getElementById(
                    "assetUploadFile"
                );

            if (fileInput) {
                fileInput.value = "";
            }

            await Promise.all([
                loadAssets(
                    activeOrganizationId
                ),
                loadActivity(
                    activeOrganizationId
                ),
            ]);
        } catch (error) {
            console.error(
                "Asset upload failed:",
                error
            );

            setAssetUploadError(
                error.message ||
                    "Asset upload failed."
            );
        } finally {
            setAssetUploading(false);
        }
    };

    const toggleAssetVersions = (assetId) => {
        setExpandedAssetVersions((current) => ({
            ...current,
            [assetId]: !current[assetId],
        }));
    };

    const uploadAssetVersion = async (asset, event) => {
        const file =
            event.target.files?.[0] || null;

        if (!asset?.id || !file) {
            return;
        }

        setAssetVersionUploadingId(asset.id);
        setAssetVersionUploadProgress(0);
        setAssetVersionError(null);

        try {
            const prepareRes = await fetch(
                "/api/assets/upload-url",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contentId: asset.contentId,
                        assetId: asset.id,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType:
                            file.type ||
                            "application/octet-stream",
                    }),
                }
            );

            const prepareData =
                await prepareRes.json();

            if (!prepareRes.ok) {
                throw new Error(
                    prepareData.error ||
                        "Failed to prepare version upload."
                );
            }

            await uploadFileToSignedUrl(
                prepareData.uploadUrl,
                file,
                prepareData.requiredHeaders,
                setAssetVersionUploadProgress
            );

            const finalizeRes =
                await fetch("/api/assets", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contentId: asset.contentId,
                        assetId: asset.id,
                        storageKey:
                            prepareData.storageKey,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType:
                            file.type ||
                            "application/octet-stream",
                        assetType: asset.assetType,
                    }),
                });

            const finalizeData =
                await finalizeRes.json();

            if (!finalizeRes.ok) {
                throw new Error(
                    finalizeData.error ||
                        "The file reached R2, but Nexus could not register the new version."
                );
            }

            setAssetVersionUploadProgress(100);

            await Promise.all([
                loadAssets(activeOrganizationId),
                loadActivity(activeOrganizationId),
            ]);

            setExpandedAssetVersions(
                (current) => ({
                    ...current,
                    [asset.id]: true,
                })
            );
        } catch (error) {
            console.error(
                "Asset version upload failed:",
                error
            );

            setAssetVersionError(
                error.message ||
                    "Couldn't upload this asset version."
            );
        } finally {
            event.target.value = "";
            setAssetVersionUploadingId(null);
        }
    };

    const deleteAsset = async (asset) => {
        if (!asset?.id) {
            return;
        }

        const confirmed = await new Promise((resolve) => {
            assetDeleteResolveRef.current = resolve;
            setAssetDeletePrompt(asset);
        });

        if (!confirmed) {
            return;
        }

        setAssetDeletingId(asset.id);
        setAssetsError(null);

        try {
            const res = await fetch(
                `/api/assets/${encodeURIComponent(
                    asset.id
                )}`,
                {
                    method: "DELETE",
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to delete asset."
                );
            }

            await Promise.all([
                loadAssets(
                    activeOrganizationId
                ),
                loadActivity(
                    activeOrganizationId
                ),
            ]);
        } catch (error) {
            console.error(
                "Failed to delete asset:",
                error
            );

            setAssetsError(
                error.message ||
                    "Couldn't delete this asset."
            );
        } finally {
            setAssetDeletingId(null);
        }
    };

    const loadActivity = async (
        organizationId = activeOrganizationId
    ) => {
        if (!organizationId) {
            setActivity([]);
            setActivityError(null);
            setActivityLoading(false);
            return;
        }

        setActivityLoading(true);
        setActivityError(null);

        try {
            const params = new URLSearchParams({
                organizationId,
                limit: "20",
            });

            const res = await fetch(
                `/api/activity?${params.toString()}`
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to load system activity."
                );
            }

            setActivity(data.activity || []);
        } catch (error) {
            console.error(
                "Failed to load system activity:",
                error
            );

            setActivity([]);
            setActivityError(
                error.message ||
                    "Couldn't load system activity."
            );
        } finally {
            setActivityLoading(false);
        }
    };

    const loadNotifications = async ({
        silent = false,
    } = {}) => {
        if (!silent) {
            setNotificationsLoading(true);
        }

        setNotificationsError(null);

        try {
            const res = await fetch(
                "/api/notifications?limit=20"
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to load notifications."
                );
            }

            setNotifications(
                data.notifications || []
            );
            setUnreadNotificationCount(
                Number(data.unreadCount || 0)
            );
        } catch (error) {
            console.error(
                "Failed to load notifications:",
                error
            );

            if (!silent) {
                setNotificationsError(
                    error.message ||
                        "Couldn't load notifications."
                );
            }
        } finally {
            if (!silent) {
                setNotificationsLoading(false);
            }
        }
    };

    const markNotificationRead = async (
        notificationId
    ) => {
        const notification =
            notifications.find(
                (item) =>
                    item.id === notificationId
            );

        if (!notification || notification.read) {
            return;
        }

        setNotificationUpdatingId(notificationId);
        setNotificationsError(null);

        try {
            const res = await fetch(
                "/api/notifications",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        notificationId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update notification."
                );
            }

            setNotifications((current) =>
                current.map((item) =>
                    item.id === notificationId
                        ? {
                              ...item,
                              read: true,
                          }
                        : item
                )
            );

            setUnreadNotificationCount(
                (current) =>
                    Math.max(0, current - 1)
            );
        } catch (error) {
            console.error(
                "Failed to mark notification read:",
                error
            );

            setNotificationsError(
                error.message ||
                    "Couldn't update this notification."
            );
        } finally {
            setNotificationUpdatingId(null);
        }
    };

    const markAllNotificationsRead =
        async () => {
            if (unreadNotificationCount === 0) {
                return;
            }

            setMarkingAllNotificationsRead(true);
            setNotificationsError(null);

            try {
                const res = await fetch(
                    "/api/notifications",
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            markAllRead: true,
                        }),
                    }
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(
                        data.error ||
                            "Failed to update notifications."
                    );
                }

                setNotifications((current) =>
                    current.map((item) => ({
                        ...item,
                        read: true,
                    }))
                );

                setUnreadNotificationCount(0);
            } catch (error) {
                console.error(
                    "Failed to mark all notifications read:",
                    error
                );

                setNotificationsError(
                    error.message ||
                        "Couldn't update notifications."
                );
            } finally {
                setMarkingAllNotificationsRead(false);
            }
        };

    const loadSettings = async ({
        silent = false,
    } = {}) => {
        if (!silent) {
            setSettingsLoading(true);
        }

        setSettingsError(null);

        try {
            const res = await fetch(
                "/api/settings"
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to load account settings."
                );
            }

            const profile =
                data.profile || null;

            setSettingsProfile(profile);

            if (profile) {
                setProfileDraft(
                    (current) => ({
                        ...current,
                        name:
                            profile.name ||
                            "",
                        email:
                            profile.email ||
                            "",
                        currentPassword:
                            "",
                    })
                );
            }
        } catch (error) {
            console.error(
                "Failed to load account settings:",
                error
            );

            setSettingsError(
                error.message ||
                    "Couldn't load account settings."
            );
        } finally {
            if (!silent) {
                setSettingsLoading(false);
            }
        }
    };

    const saveProfileSettings = async (
        event
    ) => {
        event.preventDefault();

        setSettingsSaving("profile");
        setSettingsError(null);
        setSettingsSuccess(null);

        try {
            const res = await fetch(
                "/api/settings",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "PROFILE",
                        name:
                            profileDraft.name.trim(),
                        email:
                            profileDraft.email.trim(),
                        currentPassword:
                            profileDraft.currentPassword,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update profile."
                );
            }

            setSettingsProfile(
                (current) => ({
                    ...(current || {}),
                    ...data.profile,
                })
            );

            setProfileDraft(
                (current) => ({
                    ...current,
                    name:
                        data.profile?.name ||
                        current.name,
                    email:
                        data.profile?.email ||
                        current.email,
                    currentPassword: "",
                })
            );

            setSettingsSuccess(
                data.emailChanged
                    ? "Profile and email updated. Sign in again to continue."
                    : "Profile updated."
            );
        } catch (error) {
            console.error(
                "Failed to update profile:",
                error
            );

            setSettingsError(
                error.message ||
                    "Couldn't update your profile."
            );
        } finally {
            setSettingsSaving(null);
        }
    };

    const savePasswordSettings = async (
        event
    ) => {
        event.preventDefault();

        setSettingsError(null);
        setSettingsSuccess(null);

        if (
            passwordDraft.newPassword !==
            passwordDraft.confirmPassword
        ) {
            setSettingsError(
                "New passwords do not match."
            );
            return;
        }

        setSettingsSaving("password");

        try {
            const res = await fetch(
                "/api/settings",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "PASSWORD",
                        currentPassword:
                            passwordDraft.currentPassword,
                        newPassword:
                            passwordDraft.newPassword,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to change password."
                );
            }

            setPasswordDraft({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });

            setSettingsSuccess(
                "Password updated. Sign in again to continue."
            );
        } catch (error) {
            console.error(
                "Failed to change password:",
                error
            );

            setSettingsError(
                error.message ||
                    "Couldn't change your password."
            );
        } finally {
            setSettingsSaving(null);
        }
    };

    const saveWorkspaceSettings = async (
        event
    ) => {
        event.preventDefault();

        if (!activeOrganizationId) {
            return;
        }

        setSettingsSaving("workspace");
        setSettingsError(null);
        setSettingsSuccess(null);

        try {
            const res = await fetch(
                "/api/settings",
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "WORKSPACE",
                        organizationId:
                            activeOrganizationId,
                        name:
                            workspaceNameDraft.trim(),
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update workspace."
                );
            }

            setOrganizations(
                (current) =>
                    current.map(
                        (organization) =>
                            organization.id ===
                            data.workspace.id
                                ? {
                                      ...organization,
                                      name:
                                          data
                                              .workspace
                                              .name,
                                  }
                                : organization
                    )
            );

            setSettingsProfile(
                (current) =>
                    current
                        ? {
                              ...current,
                              workspaces:
                                  (
                                      current.workspaces ||
                                      []
                                  ).map(
                                      (
                                          workspace
                                      ) =>
                                          workspace.id ===
                                          data
                                              .workspace
                                              .id
                                              ? {
                                                    ...workspace,
                                                    name:
                                                        data
                                                            .workspace
                                                            .name,
                                                }
                                              : workspace
                                  ),
                          }
                        : current
            );

            setWorkspaceNameDraft(
                data.workspace.name
            );

            setSettingsSuccess(
                "Workspace updated."
            );

            await loadActivity(
                activeOrganizationId
            );
        } catch (error) {
            console.error(
                "Failed to update workspace:",
                error
            );

            setSettingsError(
                error.message ||
                    "Couldn't update this workspace."
            );
        } finally {
            setSettingsSaving(null);
        }
    };

    const buildProjectQuery = (
        organizationId,
        {
            cursor = null,
            creatorId = null,
            limit = 25,
        } = {}
    ) => {
        const params = new URLSearchParams();

        params.set("organizationId", organizationId);
        params.set("limit", String(limit));

        if (cursor) {
            params.set("cursor", cursor);
        }

        if (creatorId) {
            params.set("creatorId", creatorId);
        } else if (projectCreatorFilter !== "all") {
            params.set(
                "filterCreatorId",
                projectCreatorFilter
            );
        }

        if (debouncedProjectSearch.trim()) {
            params.set(
                "q",
                debouncedProjectSearch.trim()
            );
        }

        if (projectFilter !== "all") {
            params.set("status", projectFilter);
        }

        if (projectEditorFilter !== "all") {
            params.set(
                "editorId",
                projectEditorFilter
            );
        }

        if (projectTypeFilter !== "all") {
            params.set("type", projectTypeFilter);
        }

        params.set("sort", projectSort);

        return params.toString();
    };

    const loadProjects = async (
        organizationId = activeOrganizationId,
        { append = false, cursor = null } = {}
    ) => {
        if (!organizationId) {
            setProjects([]);
            setProjectsNextCursor(null);
            setProjectsHasMore(false);
            setProjectsLoading(false);
            return;
        }

        if (append) {
            setProjectsLoadingMore(true);
        } else {
            setProjectsLoading(true);
            setProjectsError(null);
        }

        try {
            const query = buildProjectQuery(
                organizationId,
                { cursor }
            );

            const res = await fetch(
                `/api/projects?${query}`
            );

            if (!res.ok) {
                throw new Error("Failed to load projects");
            }

            const data = await res.json();

            const nextProjects = (
                data.projects || []
            ).map(toDisplayProject);

            setProjects((current) =>
                append
                    ? [...current, ...nextProjects]
                    : nextProjects
            );

            setProjectsNextCursor(
                data.nextCursor || null
            );
            setProjectsHasMore(
                Boolean(data.hasMore)
            );
        } catch (err) {
            console.error("Failed to load projects:", err);

            setProjectsError(
                "Couldn't load your projects. Try refreshing."
            );

            if (!append) {
                setProjects([]);
                setProjectsNextCursor(null);
                setProjectsHasMore(false);
            }
        } finally {
            if (append) {
                setProjectsLoadingMore(false);
            } else {
                setProjectsLoading(false);
            }
        }
    };

    const loadMoreProjects = async () => {
        if (
            !activeOrganizationId ||
            !projectsHasMore ||
            !projectsNextCursor ||
            projectsLoadingMore
        ) {
            return;
        }

        await loadProjects(
            activeOrganizationId,
            {
                append: true,
                cursor: projectsNextCursor,
            }
        );
    };

    const loadCreatorProjects = async (creatorId) => {
        if (!creatorId || !activeOrganizationId) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }

        setProjectsLoading(true);
        setProjectsError(null);

        try {
            const params = new URLSearchParams({
                organizationId:
                    activeOrganizationId,
                creatorId,
                limit: "100",
                sort: "updated-desc",
            });

            const res = await fetch(
                `/api/projects?${params.toString()}`
            );

            if (!res.ok) {
                throw new Error("Failed to load creator projects");
            }

            const data = await res.json();

            setProjects(
                (data.projects || []).map(toDisplayProject)
            );
        } catch (err) {
            console.error(
                "Failed to load creator projects:",
                err
            );

            setProjectsError(
                "Couldn't load this creator's projects. Try refreshing."
            );

            setProjects([]);
        } finally {
            setProjectsLoading(false);
        }
    };

    const loadProjectAssignments = async (contentId) => {
        if (!contentId || !isEditor) {
            setProjectAssignments([]);
            setInheritedProjectEditors([]);
            setAvailableEditors([]);
            setCanManageAssignments(false);
            setAssignmentsError(null);
            setAssignmentsLoading(false);
            return;
        }

        setAssignmentsLoading(true);
        setAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(
                    contentId
                )}/assignments`
            );

            if (res.status === 404 || res.status === 403) {
                setProjectAssignments([]);
                setInheritedProjectEditors([]);
                setAvailableEditors([]);
                setCanManageAssignments(false);
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to load project assignments."
                );
            }

            setProjectAssignments(
                data.assignedEditors || []
            );
            setInheritedProjectEditors(
                data.inheritedEditors || []
            );
            setAvailableEditors(
                data.availableEditors || []
            );
            setCanManageAssignments(true);
        } catch (error) {
            console.error(
                "Failed to load project assignments:",
                error
            );

            setProjectAssignments([]);
            setInheritedProjectEditors([]);
            setAvailableEditors([]);
            setCanManageAssignments(false);
            setAssignmentsError(
                error.message ||
                    "Couldn't load project assignments."
            );
        } finally {
            setAssignmentsLoading(false);
        }
    };

    const assignEditorToProject = async (
        contentId,
        editorUserId
    ) => {
        if (!contentId || !editorUserId) {
            return;
        }

        setAssignmentUpdatingUserId(editorUserId);
        setAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(
                    contentId
                )}/assignments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        userId: editorUserId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to assign Editor."
                );
            }

            await loadProjectAssignments(contentId);
            await loadActivity(activeOrganizationId);
        } catch (error) {
            console.error(
                "Failed to assign Editor:",
                error
            );

            setAssignmentsError(
                error.message ||
                    "Couldn't assign this Editor."
            );
        } finally {
            setAssignmentUpdatingUserId(null);
        }
    };

    const unassignEditorFromProject = async (
        contentId,
        editorUserId
    ) => {
        if (!contentId || !editorUserId) {
            return;
        }

        setAssignmentUpdatingUserId(editorUserId);
        setAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(
                    contentId
                )}/assignments`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        userId: editorUserId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to remove Editor."
                );
            }

            await loadProjectAssignments(contentId);
            await loadActivity(activeOrganizationId);
        } catch (error) {
            console.error(
                "Failed to remove Editor:",
                error
            );

            setAssignmentsError(
                error.message ||
                    "Couldn't remove this Editor."
            );
        } finally {
            setAssignmentUpdatingUserId(null);
        }
    };

    const loadCreatorAssignments = async (creatorId) => {
        if (!creatorId || !isEditor) {
            setCreatorAssignments([]);
            setCreatorAvailableEditors([]);
            setCanManageCreatorAssignments(false);
            setCreatorAssignmentsError(null);
            setCreatorAssignmentsLoading(false);
            return;
        }

        setCreatorAssignmentsLoading(true);
        setCreatorAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/creators/${encodeURIComponent(
                    creatorId
                )}/assignments`
            );

            if (res.status === 404 || res.status === 403) {
                setCreatorAssignments([]);
                setCreatorAvailableEditors([]);
                setCanManageCreatorAssignments(false);
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to load Creator assignments."
                );
            }

            setCreatorAssignments(
                data.assignedEditors || []
            );
            setCreatorAvailableEditors(
                data.availableEditors || []
            );
            setCanManageCreatorAssignments(true);
        } catch (error) {
            console.error(
                "Failed to load Creator assignments:",
                error
            );

            setCreatorAssignments([]);
            setCreatorAvailableEditors([]);
            setCanManageCreatorAssignments(false);
            setCreatorAssignmentsError(
                error.message ||
                    "Couldn't load Creator assignments."
            );
        } finally {
            setCreatorAssignmentsLoading(false);
        }
    };

    const assignEditorToCreator = async (
        creatorId,
        editorUserId
    ) => {
        if (!creatorId || !editorUserId) {
            return;
        }

        setCreatorAssignmentUpdatingUserId(editorUserId);
        setCreatorAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/creators/${encodeURIComponent(
                    creatorId
                )}/assignments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        userId: editorUserId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to assign Editor to Creator."
                );
            }

            await loadCreatorAssignments(creatorId);
            await loadActivity(activeOrganizationId);
        } catch (error) {
            console.error(
                "Failed to assign Editor to Creator:",
                error
            );

            setCreatorAssignmentsError(
                error.message ||
                    "Couldn't assign this Editor to the Creator."
            );
        } finally {
            setCreatorAssignmentUpdatingUserId(null);
        }
    };

    const unassignEditorFromCreator = async (
        creatorId,
        editorUserId
    ) => {
        if (!creatorId || !editorUserId) {
            return;
        }

        setCreatorAssignmentUpdatingUserId(editorUserId);
        setCreatorAssignmentsError(null);

        try {
            const res = await fetch(
                `/api/creators/${encodeURIComponent(
                    creatorId
                )}/assignments`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        userId: editorUserId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to remove Editor from Creator."
                );
            }

            await loadCreatorAssignments(creatorId);
            await loadActivity(activeOrganizationId);
        } catch (error) {
            console.error(
                "Failed to remove Editor from Creator:",
                error
            );

            setCreatorAssignmentsError(
                error.message ||
                    "Couldn't remove this Editor from the Creator."
            );
        } finally {
            setCreatorAssignmentUpdatingUserId(null);
        }
    };

    const toTaskDraft = (task) => ({
        title: task?.title || "",
        description: task?.description || "",
        status: task?.status || "TODO",
        priority: task?.priority || "MEDIUM",
        dueDate: task?.dueDate
            ? new Date(task.dueDate).toISOString().slice(0, 10)
            : "",
        assignedToId: task?.assignedTo?.id || "",
    });

    const loadTasks = async (contentId) => {
        if (!contentId) {
            setTasks([]);
            setTaskDrafts({});
            setTasksError(null);
            setTasksLoading(false);
            return;
        }

        setTasksLoading(true);
        setTasksError(null);

        try {
            const res = await fetch(
                `/api/tasks?contentId=${encodeURIComponent(contentId)}`
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to load tasks."
                );
            }

            const loadedTasks = Array.isArray(data) ? data : [];

            setTasks(loadedTasks);
            setTaskDrafts(
                Object.fromEntries(
                    loadedTasks.map((task) => [
                        task.id,
                        toTaskDraft(task),
                    ])
                )
            );
        } catch (error) {
            console.error("Failed to load tasks:", error);

            setTasks([]);
            setTaskDrafts({});
            setTasksError(
                error.message || "Couldn't load project tasks."
            );
        } finally {
            setTasksLoading(false);
        }
    };

    const updateTaskDraft = (taskId, field, value) => {
        setTaskDrafts((current) => ({
            ...current,
            [taskId]: {
                ...(current[taskId] || {}),
                [field]: value,
            },
        }));
    };

    const createTask = async (event) => {
        event.preventDefault();

        const contentId = selectedProject?.content?.id;

        if (!contentId || !newTask.title.trim()) {
            return;
        }

        setTaskCreating(true);
        setTasksError(null);

        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: newTask.title.trim(),
                    description:
                        newTask.description.trim() || null,
                    status: "TODO",
                    priority: newTask.priority,
                    dueDate: newTask.dueDate || null,
                    contentId,
                    assignedToId:
                        newTask.assignedToId || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to create task."
                );
            }

            setNewTask({
                title: "",
                description: "",
                priority: "MEDIUM",
                dueDate: "",
                assignedToId: "",
            });

            await loadTasks(contentId);
        } catch (error) {
            console.error("Failed to create task:", error);

            setTasksError(
                error.message || "Couldn't create this task."
            );
        } finally {
            setTaskCreating(false);
        }
    };

    const saveTask = async (taskId) => {
        const draft = taskDrafts[taskId];

        if (!draft) {
            return;
        }

        setTaskUpdatingId(taskId);
        setTasksError(null);

        try {
            const payload = canManageTaskStructure
                ? {
                    title: draft.title.trim(),
                    description:
                        draft.description.trim() || null,
                    status: draft.status,
                    priority: draft.priority,
                    dueDate: draft.dueDate || null,
                    assignedToId:
                        draft.assignedToId || null,
                }
                : {
                    status: draft.status,
                };

            const res = await fetch(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to update task."
                );
            }

            await loadTasks(selectedProject?.content?.id);

            setExpandedCompletedTasks((current) => {
                const next = { ...current };
                delete next[taskId];
                return next;
            });
        } catch (error) {
            console.error("Failed to update task:", error);

            setTasksError(
                error.message || "Couldn't update this task."
            );
        } finally {
            setTaskUpdatingId(null);
        }
    };

    const deleteTask = async (taskId) => {
        if (!canManageTaskStructure) {
            return;
        }

        const confirmed = window.confirm(
            "Delete this task? This cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        setTaskDeletingId(taskId);
        setTasksError(null);

        try {
            const res = await fetch(
                `/api/tasks/${encodeURIComponent(taskId)}`,
                {
                    method: "DELETE",
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to delete task."
                );
            }

            await loadTasks(selectedProject?.content?.id);
        } catch (error) {
            console.error("Failed to delete task:", error);

            setTasksError(
                error.message || "Couldn't delete this task."
            );
        } finally {
            setTaskDeletingId(null);
        }
    };

    const loadProjectDetails = async (projectId) => {
        if (!projectId) {
            return;
        }

        setProjectDetailsLoading(true);
        setProjectDetailsError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(projectId)}`
            );

            if (!res.ok) {
                throw new Error("Failed to load project details");
            }

            const data = await res.json();

            setSelectedProject(data);
            setReviewNote("");
        } catch (err) {
            console.error(
                "Failed to load project details:",
                err
            );

            setProjectDetailsError(
                "Couldn't load this project's details. Try refreshing."
            );
        } finally {
            setProjectDetailsLoading(false);
        }
    };

    const refreshProjectContext = async () => {
        const contentId = selectedProject?.content?.id;

        if (!contentId) {
            return;
        }

        await loadProjectDetails(contentId);

        if (selectedCreator) {
            await loadCreatorProjects(selectedCreator.id);
        } else {
            await loadProjects(activeOrganizationId);
        }

        await loadActivity(activeOrganizationId);
    };

    const toDateInputValue = (value) => {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toISOString().slice(0, 10);
    };

    const startProjectEditing = () => {
        const content = selectedProject?.content;

        if (!content || !canEditProjectDetails) {
            return;
        }

        setProjectEditDraft({
            title: content.title || "",
            description: content.description || "",
            footageLink: content.footageLink || "",
            contentType: content.contentType || "Short-form",
            dueDate: toDateInputValue(content.dueDate),
        });

        setProjectEditError(null);
        setProjectEditing(true);
    };

    const cancelProjectEditing = () => {
        setProjectEditing(false);
        setProjectEditError(null);
    };

    const saveProjectDetails = async (event) => {
        event.preventDefault();

        const contentId = selectedProject?.content?.id;

        if (!contentId || !canEditProjectDetails) {
            return;
        }

        if (!projectEditDraft.title.trim()) {
            setProjectEditError("Project title is required.");
            return;
        }

        const isManagement =
            activeSettingsWorkspace?.role === "ADMIN" ||
            activeSettingsWorkspace?.role === "MANAGER";

        const payload = {
            title: projectEditDraft.title.trim(),
            description: projectEditDraft.description.trim(),
            dueDate: projectEditDraft.dueDate || null,
        };

        if (
            isManagement ||
            currentProjectStatus === "REQUESTED" ||
            currentProjectStatus === "IN_PRODUCTION"
        ) {
            if (
                !isGoogleDriveFolderUrl(
                    projectEditDraft.footageLink
                )
            ) {
                setProjectEditError(
                    "Please paste a valid Google Drive folder link."
                );
                return;
            }

            payload.footageLink =
                projectEditDraft.footageLink.trim();
        }

        if (
            isManagement ||
            currentProjectStatus === "REQUESTED"
        ) {
            payload.contentType =
                projectEditDraft.contentType;
        }

        setProjectEditSaving(true);
        setProjectEditError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(contentId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update project details."
                );
            }

            setProjectEditing(false);

            await refreshProjectContext();
        } catch (error) {
            console.error(
                "Failed to update project details:",
                error
            );

            setProjectEditError(
                error.message ||
                    "Couldn't update this project."
            );
        } finally {
            setProjectEditSaving(false);
        }
    };

    const deleteProject = async () => {
        const contentId = selectedProject?.content?.id;
        const title =
            selectedProject?.content?.title || "this project";

        if (!contentId || !canDeleteProject) {
            return;
        }

        const confirmed = window.confirm(
            `Delete "${title}"? This permanently removes the project, its tasks, reviews, assignments, and asset records from Nexus. This cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        setProjectDeleting(true);
        setProjectDetailsError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(contentId)}`,
                {
                    method: "DELETE",
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to delete project."
                );
            }

            setSelectedProject(null);
            setProjectEditing(false);
            setProjectEditError(null);
            setTasks([]);
            setTaskDrafts({});
            setProjectAssignments([]);
            setInheritedProjectEditors([]);
            setAvailableEditors([]);
            setAssignmentsError(null);
            setReviewError(null);
            setReviewNote("");
            setReviewComment("");
            setReviewTimestamp("");

            if (selectedCreator) {
                setCurrentView("creator-workspace");

                await Promise.all([
                    loadCreatorProjects(selectedCreator.id),
                    loadAssets(activeOrganizationId),
                    loadActivity(activeOrganizationId),
                ]);
            } else {
                setCurrentView("projects");

                await Promise.all([
                    loadProjects(activeOrganizationId),
                    loadAssets(activeOrganizationId),
                    loadActivity(activeOrganizationId),
                ]);
            }
        } catch (error) {
            console.error("Failed to delete project:", error);

            setProjectDetailsError(
                error.message || "Couldn't delete this project."
            );
        } finally {
            setProjectDeleting(false);
        }
    };

    const updateProductionStatus = async (status) => {
        const contentId = selectedProject?.content?.id;

        if (!contentId) {
            return;
        }

        setProjectStatusUpdating(true);
        setProjectDetailsError(null);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/projects/${encodeURIComponent(contentId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to update project status."
                );
            }

            await refreshProjectContext();
        } catch (error) {
            console.error("Failed to update project status:", error);

            setProjectDetailsError(
                error.message || "Failed to update project status."
            );
        } finally {
            setProjectStatusUpdating(false);
        }
    };

    const submitReviewComment = async (event, reviewId) => {
        event.preventDefault();

        const comment = reviewComment.trim();

        if (!reviewId || !comment) {
            return;
        }

        const timestamp = parseReviewTimestamp(reviewTimestamp);

        if (Number.isNaN(timestamp)) {
            setReviewError(
                "Use a timestamp like 1:23, 01:23:45, or leave it blank."
            );
            return;
        }

        setReviewCommentSubmitting(true);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(
                    reviewId
                )}/comments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        comment,
                        timestamp,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to add review comment."
                );
            }

            setReviewComment("");
            setReviewTimestamp("");
            await refreshProjectContext();
        } catch (error) {
            console.error("Failed to add review comment:", error);

            setReviewError(
                error.message || "Failed to add review comment."
            );
        } finally {
            setReviewCommentSubmitting(false);
        }
    };

    const startEditingReviewComment = (comment) => {
        setReviewCommentEditingId(comment.id);
        setReviewCommentEditDraft({
            comment: comment.comment || "",
            timestamp:
                comment.timestamp !== null &&
                comment.timestamp !== undefined
                    ? formatReviewTimestamp(
                          comment.timestamp
                      )
                    : "",
        });
        setReviewError(null);
    };

    const cancelEditingReviewComment = () => {
        setReviewCommentEditingId(null);
        setReviewCommentEditDraft({
            comment: "",
            timestamp: "",
        });
    };

    const updateReviewComment = async (
        reviewId,
        commentId
    ) => {
        const comment =
            reviewCommentEditDraft.comment.trim();

        if (!reviewId || !commentId || !comment) {
            return;
        }

        const timestamp = parseReviewTimestamp(
            reviewCommentEditDraft.timestamp
        );

        if (Number.isNaN(timestamp)) {
            setReviewError(
                "Use a timestamp like 1:23, 01:23:45, or leave it blank."
            );
            return;
        }

        setReviewCommentUpdatingId(commentId);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(
                    reviewId
                )}/comments`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "EDIT",
                        commentId,
                        comment,
                        timestamp,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update review comment."
                );
            }

            cancelEditingReviewComment();
            await refreshProjectContext();
        } catch (error) {
            console.error(
                "Failed to update review comment:",
                error
            );

            setReviewError(
                error.message ||
                    "Failed to update review comment."
            );
        } finally {
            setReviewCommentUpdatingId(null);
        }
    };

    const setReviewCommentResolved = async (
        reviewId,
        commentId,
        resolved
    ) => {
        if (!reviewId || !commentId) {
            return;
        }

        setReviewCommentUpdatingId(commentId);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(
                    reviewId
                )}/comments`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action: "RESOLVE",
                        commentId,
                        resolved,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to update review comment."
                );
            }

            await refreshProjectContext();
        } catch (error) {
            console.error(
                "Failed to resolve review comment:",
                error
            );

            setReviewError(
                error.message ||
                    "Failed to update review comment."
            );
        } finally {
            setReviewCommentUpdatingId(null);
        }
    };

    const deleteReviewComment = async (
        reviewId,
        commentId
    ) => {
        if (!reviewId || !commentId) {
            return;
        }

        const confirmed = window.confirm(
            "Delete this review comment?"
        );

        if (!confirmed) {
            return;
        }

        setReviewCommentDeletingId(commentId);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(
                    reviewId
                )}/comments`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        commentId,
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error ||
                        "Failed to delete review comment."
                );
            }

            if (
                reviewCommentEditingId ===
                commentId
            ) {
                cancelEditingReviewComment();
            }

            await refreshProjectContext();
        } catch (error) {
            console.error(
                "Failed to delete review comment:",
                error
            );

            setReviewError(
                error.message ||
                    "Failed to delete review comment."
            );
        } finally {
            setReviewCommentDeletingId(null);
        }
    };

    const submitReviewDecision = async (reviewId, decision) => {
        if (!reviewId) {
            return;
        }

        if (
            decision === "REQUEST_REVISION" &&
            !reviewNote.trim()
        ) {
            setReviewError(
                "Add revision notes so the Editor knows what needs to change."
            );
            return;
        }

        setProjectStatusUpdating(true);
        setProjectDetailsError(null);
        setReviewError(null);

        try {
            const res = await fetch(
                `/api/reviews/${encodeURIComponent(
                    reviewId
                )}/decision`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        decision,
                        notes: reviewNote.trim(),
                    }),
                }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(
                    data.error || "Failed to process review decision."
                );
            }

            setReviewNote("");
            setReviewComment("");
            setReviewTimestamp("");
            await refreshProjectContext();
        } catch (error) {
            console.error("Failed to process review decision:", error);

            setReviewError(
                error.message || "Failed to process review decision."
            );
        } finally {
            setProjectStatusUpdating(false);
        }
    };

    const openProjectDetails = async (project) => {
        setSelectedProject(null);
        setProjectDetailsError(null);
        setAssignmentsError(null);
        setTasksError(null);
        setTasks([]);
        setTaskDrafts({});
        setCanManageAssignments(false);
        setReviewNote("");
        setReviewComment("");
        setReviewTimestamp("");
        setReviewError(null);
        setCurrentView("project-details");

        if (isEditor) {
            await Promise.all([
                loadProjectDetails(project.id),
                loadProjectAssignments(project.id),
                loadTasks(project.id),
            ]);
        } else {
            await Promise.all([
                loadProjectDetails(project.id),
                loadTasks(project.id),
            ]);
        }
    };

    useEffect(() => {
        loadOrganizations();
        loadSettings();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadNotifications();

        const timer = window.setInterval(
            () => {
                loadNotifications({
                    silent: true,
                });
            },
            30000
        );

        return () => {
            window.clearInterval(timer);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedProjectSearch(
                projectSearch.trim()
            );
        }, 300);

        return () => {
            window.clearTimeout(timer);
        };
    }, [projectSearch]);

    useEffect(() => {
        if (activeOrganizationId) {
            loadCreators(activeOrganizationId);
            loadAssets(activeOrganizationId);
            loadActivity(activeOrganizationId);
        } else if (!organizationsLoading) {
            setProjects([]);
            setProjectsNextCursor(null);
            setProjectsHasMore(false);
            setCreators([]);
            setAssets([]);
            setActivity([]);

            setProjectsError(null);
            setCreatorsError(null);
            setAssetsError(null);
            setActivityError(null);

            setProjectsLoading(false);
            setCreatorsLoading(false);
            setAssetsLoading(false);
            setActivityLoading(false);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeOrganizationId, organizationsLoading]);

    useEffect(() => {
        if (!activeOrganizationId) {
            return;
        }

        setProjectsNextCursor(null);
        setProjectsHasMore(false);

        loadProjects(activeOrganizationId);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeOrganizationId,
        debouncedProjectSearch,
        projectFilter,
        projectCreatorFilter,
        projectEditorFilter,
        projectTypeFilter,
        projectSort,
    ]);

    useEffect(() => {
        if (!activeOrganizationId) {
            return;
        }

        const timer = setTimeout(() => {
            loadAssets(activeOrganizationId);
        }, 250);

        return () => clearTimeout(timer);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assetSearch, activeOrganizationId]);

    useEffect(() => {
        if (projects.length === 0) {
            setAssetUploadContentId("");
            return;
        }

        const selectedStillExists =
            projects.some(
                (project) =>
                    project.id ===
                    assetUploadContentId
            );

        if (!selectedStillExists) {
            setAssetUploadContentId(
                projects[0].id
            );
        }
    }, [projects, assetUploadContentId]);

    useEffect(() => {
        const workspace =
            settingsProfile?.workspaces?.find(
                (item) =>
                    item.id ===
                    activeOrganizationId
            ) ||
            settingsProfile?.workspaces?.[0] ||
            null;

        setWorkspaceNameDraft(
            workspace?.name || ""
        );
    }, [
        settingsProfile,
        activeOrganizationId,
    ]);

    useEffect(() => {
        const savedTheme = localStorage.getItem("nexus-theme");

        if (savedTheme === "dark") {
            setTheme("dark");
            document.documentElement.setAttribute(
                "data-theme",
                "dark"
            );
        } else {
            setTheme("light");
            document.documentElement.setAttribute(
                "data-theme",
                "light"
            );
        }
    }, []);

    useEffect(() => () => {
        window.clearTimeout(themeTransitionTimerRef.current);
        document.documentElement.classList.remove("theme-transitioning");
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        window.clearTimeout(themeTransitionTimerRef.current);
        root.classList.remove("theme-transitioning");

        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            root.classList.add("theme-transitioning");
            themeTransitionTimerRef.current = window.setTimeout(() => {
                root.classList.remove("theme-transitioning");
                themeTransitionTimerRef.current = null;
            }, 350);
        }

        const newTheme =
            theme === "light" ? "dark" : "light";

        setTheme(newTheme);

        document.documentElement.setAttribute(
            "data-theme",
            newTheme
        );

        localStorage.setItem("nexus-theme", newTheme);
    };

    const viewTitles = {
        overview: isEditor
            ? "EDITOR OPERATIONS"
            : "CREATOR WORKSPACE",

        projects: isEditor
            ? "PROJECTS & EDITS QUEUE"
            : "MY PROJECTS",

        creators: "CREATOR WORKSPACES",

        "creator-workspace": "CREATOR WORKSPACE",

        "project-details": "PROJECT DETAILS / REVIEW",

        assets: isEditor
            ? "CREATOR ASSET VAULT"
            : "MY ASSET VAULT",

        analytics: "PERFORMANCE ANALYTICS",

        settings: "WORKSPACE SETTINGS",
    };


    const handleBriefSubmit = async (e) => {
        e.preventDefault();

        const form = e.currentTarget;
        const formData = new FormData(form);

        const title = String(
            formData.get("briefTitle") || ""
        ).trim();

        const type = String(
            formData.get("briefType") || ""
        );

        const link = String(
            formData.get("briefLink") || ""
        ).trim();

        if (!isGoogleDriveFolderUrl(link)) {
            setBriefError(true);
            return;
        }

        setBriefError(false);
        setBriefSubmitting(true);

        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title,
                    type,
                    footageLink: link,
                    organizationId:
                        activeOrganizationId,
                }),
            });

            if (!res.ok) {
                setBriefError(true);
                setBriefSubmitting(false);
                return;
            }

            await loadProjects(activeOrganizationId);
            await loadActivity(activeOrganizationId);

            setBriefModalOpen(false);
            setCurrentView("overview");
            form.reset();
        } catch (err) {
            console.error(
                "Failed to submit brief:",
                err
            );

            setBriefError(true);
        } finally {
            setBriefSubmitting(false);
        }
    };

    const assetIcon = (assetType) => {
        switch (assetType) {
            case "VIDEO":
                return "🎥";
            case "IMAGE":
                return "🎨";
            case "AUDIO":
                return "🔊";
            case "DOCUMENT":
                return "📄";
            default:
                return "📦";
        }
    };

    const formatAssetSize = (bytes) => {
        if (bytes === null || bytes === undefined) {
            return "Size unknown";
        }

        const size = Number(bytes);

        if (!Number.isFinite(size)) {
            return "Size unknown";
        }

        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }

        if (size < 1024 * 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        }

        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    const assetMeta = (asset) => {
        const typeLabels = {
            VIDEO: "Video",
            IMAGE: "Image",
            AUDIO: "Audio",
            DOCUMENT: "Document",
            OTHER: "Other",
        };

        const type = typeLabels[asset.assetType] || "Asset";

        const version =
            Number(asset.latestVersion || 1);

        return `${type} • ${formatAssetSize(
            asset.fileSize
        )} • v${version}`;
    };

    const taskAssignableEditors = Array.from(
        new Map(
            [
                ...projectAssignments,
                ...inheritedProjectEditors,
            ]
                .map((assignment) => assignment?.user)
                .filter(Boolean)
                .map((editor) => [editor.id, editor])
        ).values()
    );

    const currentProjectStatus = normalizeProjectStatus(
        selectedProject?.content?.status
    );

    const pendingReview =
        selectedProject?.reviews?.find(
            (review) => review.status === "PENDING"
        ) || null;

    const approvedReview =
        [...(selectedProject?.reviews || [])]
            .filter((review) => review.status === "APPROVED")
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0] || null;

    const approvedAssetVersion =
        approvedReview?.assetVersion || null;

    const finalDeliveryAssets =
        (selectedProject?.assets || []).filter(
            (asset) =>
                !approvedAssetVersion ||
                asset.id !== approvedAssetVersion.assetId
        );

    const canMakeReviewDecision =
        Boolean(pendingReview) &&
        (isCreator || canManageAssignments);

    const settingsWorkspaces =
        settingsProfile?.workspaces || [];

    const activeSettingsWorkspace =
        settingsWorkspaces.find(
            (workspace) =>
                workspace.id ===
                activeOrganizationId
        ) ||
        settingsWorkspaces[0] ||
        null;

    const canManageWorkspaceSettings =
        activeSettingsWorkspace?.role ===
            "ADMIN" ||
        activeSettingsWorkspace?.role ===
            "MANAGER";

    const canManageTaskStructure =
        isCreator ||
        activeSettingsWorkspace?.role ===
            "ADMIN" ||
        activeSettingsWorkspace?.role ===
            "MANAGER";

    const canUpdateTaskStatus =
        isCreator || isEditor;

    const canManageProjectDetails =
        activeSettingsWorkspace?.role ===
            "ADMIN" ||
        activeSettingsWorkspace?.role ===
            "MANAGER";

    const canEditProjectDetails =
        canManageProjectDetails ||
        (isCreator &&
            currentProjectStatus !== "APPROVED");

    const canEditProjectContentType =
        canManageProjectDetails ||
        (isCreator &&
            currentProjectStatus === "REQUESTED");

    const canEditProjectFootage =
        canManageProjectDetails ||
        (isCreator &&
            (
                currentProjectStatus === "REQUESTED" ||
                currentProjectStatus === "IN_PRODUCTION"
            ));

    const canManageAnyReviewComment =
        activeSettingsWorkspace?.role ===
            "ADMIN" ||
        activeSettingsWorkspace?.role ===
            "MANAGER";

    const canDeleteProject =
        isCreator ||
        activeSettingsWorkspace?.role ===
            "ADMIN" ||
        activeSettingsWorkspace?.role ===
            "MANAGER";

    const displayUserName =
        settingsProfile?.name ||
        user?.name ||
        "Nexus Studio";

    const currentHour = new Date().getHours();
    const dashboardGreeting =
        currentHour < 12
            ? "Good morning"
            : currentHour < 18
              ? "Good afternoon"
              : "Good evening";

    const dashboardDate = new Date().toLocaleDateString(
        "en-US",
        {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );

    return (
        <>
            <InterfaceTranslator />
            <div className="noise"></div>

            <div className="app-shell nexus-minimal-ui" inert={briefModalOpen}>
                {mobileSidebarOpen && (
                    <button
                        type="button"
                        className="mobile-sidebar-backdrop"
                        aria-label="Close navigation"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                )}

                <aside
                    id="dashboard-navigation"
                    ref={sidebarRef}
                    aria-label="Dashboard navigation"
                    role={mobileSidebarOpen ? "dialog" : undefined}
                    aria-modal={mobileSidebarOpen ? true : undefined}
                    className={`sidebar ${
                        mobileSidebarOpen ? "mobile-open" : ""
                    }`}
                >
                    <a href="/" className="brand" aria-label="Nexus Setups home">
                        <span className="brand-text">
                            <span>N</span>EXUS
                        </span>
                        <b className="brand-sub">SETUPS</b>
                    </a>

                    <nav className="sidebar-nav">
                        <button
                            type="button"
                            aria-label="Dashboard"
                            className={`nav-item ${currentView === "overview" ? "active" : ""}`}
                            onClick={() => {
                                setCurrentView("overview");
                                setMobileSidebarOpen(false);
                            }}
                        >
                            <span className="nav-icon" aria-hidden="true">⌂</span>
                            <span>Dashboard</span>
                        </button>

                        <button
                            type="button"
                            aria-label="Projects"
                            className={`nav-item ${currentView === "projects" ? "active" : ""}`}
                            onClick={() => {
                                setCurrentView("projects");
                                setMobileSidebarOpen(false);
                            }}
                        >
                            <span className="nav-icon" aria-hidden="true">□</span>
                            <span>Projects</span>
                        </button>

                        {isEditor && (
                            <button
                                type="button"
                                aria-label="Creators"
                                className={`nav-item ${currentView === "creators" ? "active" : ""}`}
                                onClick={() => {
                                    setCurrentView("creators");
                                    setMobileSidebarOpen(false);
                                }}
                            >
                                <span className="nav-icon" aria-hidden="true">♙</span>
                                <span>Creators</span>
                            </button>
                        )}

                        <button
                            type="button"
                            aria-label="Assets"
                            className={`nav-item ${currentView === "assets" ? "active" : ""}`}
                            onClick={() => {
                                setCurrentView("assets");
                                setMobileSidebarOpen(false);
                            }}
                        >
                            <span className="nav-icon" aria-hidden="true">▧</span>
                            <span>Assets</span>
                        </button>

                        <div className="sidebar-divider" />

                        <button
                            type="button"
                            className="nav-item"
                            aria-label="Notifications"
                            onClick={() => {
                                setMobileSidebarOpen(false);
                                setNotificationMenuOpen(true);
                                loadNotifications({ silent: true });
                            }}
                        >
                            <span className="nav-icon" aria-hidden="true">♢</span>
                            {unreadNotificationCount > 0 && (
                                <span className="nav-badge">
                                    {unreadNotificationCount > 9
                                        ? "9+"
                                        : unreadNotificationCount}
                                </span>
                            )}
                            <span>Notifications</span>
                        </button>

                        <button
                            type="button"
                            aria-label="Settings"
                            className={`nav-item ${currentView === "settings" ? "active" : ""}`}
                            onClick={() => {
                                setCurrentView("settings");
                                setMobileSidebarOpen(false);
                            }}
                        >
                            <span className="nav-icon" aria-hidden="true">⚙</span>
                            <span>Settings</span>
                        </button>
                    </nav>

                    <div
                        className="sidebar-user"
                        aria-label="Open profile settings"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                            setCurrentView("settings");
                            setMobileSidebarOpen(false);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setCurrentView("settings");
                                setMobileSidebarOpen(false);
                            }
                        }}
                    >
                        <div className="user-avatar">
                            {displayUserName
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                        </div>

                        <div className="user-meta">
                            <strong>{displayUserName}</strong>
                            <small>
                                {activeSettingsWorkspace?.role ||
                                    (isCreator ? "CREATOR" : "EDITOR")}
                            </small>
                        </div>

                        <span className="user-chevron">›</span>
                    </div>
                </aside>

                <main className="dashboard-main" inert={mobileSidebarOpen}>
                    <header className="dash-header nexus-topbar">
                        <button
                            type="button"
                            className="mobile-menu-button"
                            ref={menuButtonRef}
                            aria-controls="dashboard-navigation"
                            aria-label="Open navigation"
                            aria-expanded={mobileSidebarOpen}
                            onClick={() =>
                                setMobileSidebarOpen((current) => !current)
                            }
                        >
                            <span />
                            <span />
                            <span />
                        </button>

                        <div className="topbar-search-wrap">
                            <span className="global-search-icon" aria-hidden="true">⌕</span>
                            <input
                                type="search"
                                aria-label="Search projects"
                                placeholder="Search projects..."
                                value={projectSearch}
                                onChange={(event) =>
                                    setProjectSearch(event.target.value)
                                }
                                onFocus={() => {
                                    if (currentView === "overview") {
                                        setCurrentView("projects");
                                    }
                                }}
                            />
                        </div>

                        <div className="topbar-right-controls">
                            <div className="organization-selector target-org-selector">
                                <select
                                    className="organization-select"
                                    value={activeOrganizationId || ""}
                                    onChange={(event) =>
                                        setActiveOrganizationId(
                                            event.target.value
                                        )
                                    }
                                    disabled={
                                        organizationsLoading ||
                                        organizations.length === 0
                                    }
                                    aria-label="Active workspace"
                                >
                                    {organizationsLoading && (
                                        <option value="">Loading...</option>
                                    )}
                                    {!organizationsLoading &&
                                        organizations.map(
                                            (organization) => (
                                                <option
                                                    key={organization.id}
                                                    value={organization.id}
                                                >
                                                    {organization.name}
                                                </option>
                                            )
                                        )}
                                </select>
                            </div>

                            <LanguageSelector compact />

                            <button
                                type="button"
                                className="target-theme-button"
                                onClick={toggleTheme}
                                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                                title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                            >
                                {theme === "light" ? "☼" : "☾"}
                            </button>

                            <div className="notification-shell" onKeyDown={(event) => {
                                if (event.key === "Escape" && notificationMenuOpen) {
                                    event.stopPropagation();
                                    setNotificationMenuOpen(false);
                                    event.currentTarget.querySelector(".notification-bell")?.focus();
                                }
                            }}>
                                <button
                                    type="button"
                                    className="topbar-icon-btn notification-bell"
                                    aria-label="Notifications"
                                    aria-controls={notificationMenuOpen ? "dashboard-notifications" : undefined}
                                    aria-expanded={notificationMenuOpen}
                                    onClick={() => {
                                        setNotificationMenuOpen(
                                            (current) => !current
                                        );

                                        if (!notificationMenuOpen) {
                                            loadNotifications({
                                                silent: true,
                                            });
                                        }
                                    }}
                                >
                                    <span className="notification-bell-icon">
                                        ♧
                                    </span>

                                    {unreadNotificationCount > 0 && (
                                        <span className="topbar-badge notification-count-badge">
                                            {unreadNotificationCount > 99
                                                ? "99+"
                                                : unreadNotificationCount}
                                        </span>
                                    )}
                                </button>

                                {notificationMenuOpen && (
                                    <section id="dashboard-notifications" className="notification-popover" aria-label="Notifications">
                                        <div className="notification-popover-header">
                                            <div>
                                                <span className="notification-popover-kicker">
                                                    NOTIFICATIONS
                                                </span>
                                                <h3>Notifications</h3>
                                                <p>
                                                    {unreadNotificationCount}{" "}
                                                    unread
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                className="notification-mark-all"
                                                disabled={
                                                    markingAllNotificationsRead ||
                                                    unreadNotificationCount === 0
                                                }
                                                onClick={
                                                    markAllNotificationsRead
                                                }
                                            >
                                                {markingAllNotificationsRead
                                                    ? "Updating…"
                                                    : "Mark all read"}
                                            </button>
                                        </div>

                                        <div className="notification-popover-body">
                                            {notificationsLoading && (
                                                <p className="notification-empty-state" role="status">
                                                    Loading notifications…
                                                </p>
                                            )}

                                            {!notificationsLoading &&
                                                notificationsError && (
                                                    <p className="notification-empty-state notification-error-state" role="alert">
                                                        {notificationsError}
                                                    </p>
                                                )}

                                            {!notificationsLoading &&
                                                !notificationsError &&
                                                notifications.length === 0 && (
                                                    <div className="notification-empty-panel">
                                                        <span>✓</span>
                                                        <strong>
                                                            You&apos;re all caught
                                                            up
                                                        </strong>
                                                        <p>
                                                            New project and review
                                                            updates will appear
                                                            here.
                                                        </p>
                                                    </div>
                                                )}

                                            {!notificationsLoading &&
                                                notifications.length > 0 && (
                                                    <div className="notification-list">
                                                        {notifications.map(
                                                            (
                                                                notification,
                                                                index
                                                            ) => {
                                                                const isUnread =
                                                                    !notification.read;

                                                                return (
                                                                    <button
                                                                        key={
                                                                            notification.id
                                                                        }
                                                                        type="button"
                                                                        disabled={
                                                                            notificationUpdatingId ===
                                                                            notification.id
                                                                        }
                                                                        onClick={() =>
                                                                            markNotificationRead(
                                                                                notification.id
                                                                            )
                                                                        }
                                                                        className={`notification-item ${
                                                                            isUnread
                                                                                ? "unread"
                                                                                : "read"
                                                                        }`}
                                                                    >
                                                                        <div
                                                                            className={`notification-item-icon notification-icon-${
                                                                                index %
                                                                                4
                                                                            }`}
                                                                        >
                                                                            {index %
                                                                                4 ===
                                                                            0
                                                                                ? "↗"
                                                                                : index %
                                                                                        4 ===
                                                                                    1
                                                                                  ? "□"
                                                                                  : index %
                                                                                          4 ===
                                                                                      2
                                                                                    ? "✓"
                                                                                    : "⇧"}
                                                                        </div>

                                                                        <div className="notification-item-content">
                                                                            <div className="notification-item-title-row">
                                                                                <strong>
                                                                                    {
                                                                                        notification.title
                                                                                    }
                                                                                </strong>

                                                                                {isUnread && (
                                                                                    <span
                                                                                        className="notification-unread-dot"
                                                                                        title="Unread"
                                                                                    />
                                                                                )}
                                                                            </div>

                                                                            <p>
                                                                                {
                                                                                    notification.message
                                                                                }
                                                                            </p>

                                                                            <span className="notification-item-time">
                                                                                {formatRelativeTime(
                                                                                    notification.createdAt
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    </section>
                                )}
                            </div>

                            <button
                                type="button"
                                className="topbar-profile-pill"
                                onClick={() => setCurrentView("settings")}
                                aria-label="Open profile settings"
                            >
                                {displayUserName
                                    .split(" ")
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                            </button>
                        </div>
                    </header>

                    {organizationsError && (
                        <div className="workspace-load-error" role="alert">
                            <p>Could not load your workspaces. Try again.</p>
                            <button type="button" className="action-btn" onClick={loadOrganizations} disabled={organizationsLoading}>Retry</button>
                        </div>
                    )}

                    <div
                        className={`view-panel ${currentView === "overview" ? "active" : ""}`}
                    >
                        <div className="panel-scroll-container target-overview-scroll">
                            <section className="greeting-section">
                                <div>
                                    <span className="greeting-kicker">
                                        DASHBOARD
                                    </span>
                                    <h1 className="page-title">
                                        {dashboardGreeting}, 
                                        <span>
                                            {displayUserName.split(" ")[0]}
                                        </span>
                                    </h1>
                                    <p>
                                        Here&apos;s what&apos;s happening with your projects.
                                    </p>
                                </div>

                                <div className="greeting-date-block">
                                    <strong>{dashboardDate}</strong>
                                    <div className="greeting-date-divider" />
                                    <span>{dashboardGreeting}</span>
                                </div>
                            </section>

                            <section className="metrics-row">
                                <article className="metric-box metric-purple">
                                    <div className="metric-top">
                                        <div className="metric-icon-wrap">□</div>
                                        <span className="metric-title">
                                            ACTIVE PROJECTS
                                        </span>
                                    </div>
                                    <strong className="metric-number">
                                        {projectsLoading
                                            ? "—"
                                            : projects.filter(
                                                  (project) =>
                                                      normalizeProjectStatus(
                                                          project.status
                                                      ) !== "APPROVED"
                                              ).length}
                                    </strong>
                                    <div className="metric-bottom">
                                        <span className="metric-trend green">
                                            ↗ 
                                            {
                                                projects.filter(
                                                    (project) =>
                                                        normalizeProjectStatus(
                                                            project.status
                                                        ) === "IN_PRODUCTION"
                                                ).length
                                            } 
                                            in production
                                        </span>
                                        <svg
                                            className="metric-sparkline"
                                            viewBox="0 0 65 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M2 21 C12 20 17 12 25 13 C34 14 38 19 46 12 C53 6 58 3 63 5"
                                                stroke="var(--nx-purple)"
                                            />
                                        </svg>
                                    </div>
                                </article>

                                <article className="metric-box metric-amber">
                                    <div className="metric-top">
                                        <div className="metric-icon-wrap">◷</div>
                                        <span className="metric-title">
                                            IN REVIEW
                                        </span>
                                    </div>
                                    <strong className="metric-number">
                                        {projectsLoading
                                            ? "—"
                                            : projects.filter(
                                                  (project) =>
                                                      normalizeProjectStatus(
                                                          project.status
                                                      ) === "IN_REVIEW"
                                              ).length}
                                    </strong>
                                    <div className="metric-bottom">
                                        <span className="metric-trend amber">
                                            ● Needs attention
                                        </span>
                                        <svg
                                            className="metric-sparkline"
                                            viewBox="0 0 65 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M2 22 C13 21 18 15 25 13 C35 10 38 17 46 11 C54 5 59 5 63 7"
                                                stroke="var(--nx-amber)"
                                            />
                                        </svg>
                                    </div>
                                </article>

                                <article className="metric-box metric-green">
                                    <div className="metric-top">
                                        <div className="metric-icon-wrap">✓</div>
                                        <span className="metric-title">
                                            DELIVERED
                                        </span>
                                    </div>
                                    <strong className="metric-number">
                                        {projectsLoading
                                            ? "—"
                                            : projects.filter(
                                                  (project) =>
                                                      normalizeProjectStatus(
                                                          project.status
                                                      ) === "APPROVED"
                                              ).length}
                                    </strong>
                                    <div className="metric-bottom">
                                        <span className="metric-trend green">
                                            ↑ Final approved cuts
                                        </span>
                                        <svg
                                            className="metric-sparkline"
                                            viewBox="0 0 65 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M2 22 C12 20 18 18 25 14 C34 8 40 10 47 7 C54 4 59 6 63 4"
                                                stroke="var(--nx-green)"
                                            />
                                        </svg>
                                    </div>
                                </article>

                                <article className="metric-box metric-purple">
                                    <div className="metric-top">
                                        <div className="metric-icon-wrap">◫</div>
                                        <span className="metric-title">
                                            TOTAL ASSETS
                                        </span>
                                    </div>
                                    <strong className="metric-number">
                                        {assetsLoading ? "—" : assets.length}
                                    </strong>
                                    <div className="metric-bottom">
                                        <span className="metric-trend green">
                                            ↑ Files in asset vault
                                        </span>
                                        <svg
                                            className="metric-sparkline"
                                            viewBox="0 0 65 24"
                                            aria-hidden="true"
                                        >
                                            <path
                                                d="M2 21 C12 20 18 15 25 13 C34 10 39 15 47 9 C54 4 59 7 63 6"
                                                stroke="var(--nx-purple)"
                                            />
                                        </svg>
                                    </div>
                                </article>
                            </section>

                            <section className="content-split-layout">
                                <div className="projects-panel-box">
                                    <div className="projects-panel-toolbar">
                                        <h2>Projects</h2>

                                        <div className="toolbar-controls-cluster">
                                            <div className="toolbar-search">
                                                <span>⌕</span>
                                                <input
                                                    type="search"
                                                    aria-label="Search dashboard projects"
                                                placeholder="Search projects..."
                                                    value={projectSearch}
                                                    onChange={(event) =>
                                                        setProjectSearch(
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </div>

                                            <select
                                                className="toolbar-select-pill" aria-label="Project status"
                                                value={projectFilter}
                                                onChange={(event) =>
                                                    setProjectFilter(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="all">
                                                    Status
                                                </option>
                                                <option value="REQUESTED">
                                                    Requested
                                                </option>
                                                <option value="IN_PRODUCTION">
                                                    In Production
                                                </option>
                                                <option value="IN_REVIEW">
                                                    In Review
                                                </option>
                                                <option value="REVISION">
                                                    Revision
                                                </option>
                                                <option value="APPROVED">
                                                    Approved
                                                </option>
                                            </select>

                                            <select
                                                className="toolbar-select-pill" aria-label="Creator filter"
                                                value={projectCreatorFilter}
                                                onChange={(event) =>
                                                    setProjectCreatorFilter(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="all">
                                                    Creator
                                                </option>
                                                {projectCreatorOptions.map(
                                                    (creator) => (
                                                        <option
                                                            key={creator.id}
                                                            value={creator.id}
                                                        >
                                                            {creator.name ||
                                                                creator.email}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            <select
                                                className="toolbar-select-pill" aria-label="Editor filter"
                                                value={projectEditorFilter}
                                                onChange={(event) =>
                                                    setProjectEditorFilter(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="all">
                                                    Editor
                                                </option>
                                                {projectEditorOptions.map(
                                                    (editor) => (
                                                        <option
                                                            key={editor.id}
                                                            value={editor.id}
                                                        >
                                                            {editor.name ||
                                                                editor.email}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            <select
                                                className="toolbar-select-pill" aria-label="Project sort"
                                                value={projectSort}
                                                onChange={(event) =>
                                                    setProjectSort(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="updated-desc">
                                                    ⇅ Sort
                                                </option>
                                                <option value="newest">
                                                    Newest
                                                </option>
                                                <option value="oldest">
                                                    Oldest
                                                </option>
                                                <option value="due-date">
                                                    Due date
                                                </option>
                                            </select>

                                            {isCreator && (
                                                <button
                                                    type="button"
                                                    className="btn-new-project-purple"
                                                    onClick={() =>
                                                        setBriefModalOpen(true)
                                                    }
                                                >
                                                    + New Project
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="projects-table-head">
                                        <span>PROJECT</span>
                                        <span>CREATOR</span>
                                        <span>EDITOR</span>
                                        <span>STATUS</span>
                                        <span>DUE DATE</span>
                                        <span>UPDATED</span>
                                        <span />
                                    </div>

                                    <div className="projects-table-body">
                                        {projectsLoading && (
                                            <div className="target-empty-state" role="status">
                                                Loading projects…
                                            </div>
                                        )}

                                        {!projectsLoading &&
                                            projectsError && (
                                                <div className="target-empty-state target-error" role="alert">
                                                    {projectsError}
                                                </div>
                                            )}

                                        {!projectsLoading &&
                                            !projectsError &&
                                            projects.length === 0 && (
                                                <div className="target-empty-state" role="status">
                                                    No projects yet.
                                                </div>
                                            )}

                                        {!projectsLoading &&
                                            !projectsError &&
                                            projects
                                                .slice(0, 5)
                                                .map((project) => {
                                                    const editor =
                                                        project
                                                            .assignedEditors?.[0];
                                                    const normalizedStatus =
                                                        normalizeProjectStatus(
                                                            project.status
                                                        );
                                                    const statusClass =
                                                        normalizedStatus
                                                            .toLowerCase()
                                                            .replaceAll(
                                                                "_",
                                                                "-"
                                                            );

                                                    return (
                                                        <div
                                                            className="projects-table-row"
                                                            key={project.id}
                                                            onClick={() =>
                                                                openProjectDetails(
                                                                    project
                                                                )
                                                            }
                                                        >
                                                            <div className="project-media-cell">
                                                                <div
                                                                    className="project-thumbnail-img target-thumbnail-placeholder"
                                                                    aria-hidden="true"
                                                                >
                                                                    <span>▶</span>
                                                                </div>

                                                                <div className="project-title-cluster">
                                                                    <strong><button type="button" className="overview-project-open" onClick={(event) => { event.stopPropagation(); openProjectDetails(project); }}>
                                                                        {
                                                                            project.title
                                                                        }
                                                                    </button></strong>
                                                                    <div className="project-sub-row">
                                                                        <span className="project-type-tag">
                                                                            {
                                                                                project.type
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="person-cell">
                                                                <span className="person-avatar">
                                                                    {String(
                                                                        project
                                                                            .creator
                                                                            ?.name ||
                                                                            project
                                                                                .creator
                                                                                ?.email ||
                                                                            "C"
                                                                    )
                                                                        .split(
                                                                            " "
                                                                        )
                                                                        .map(
                                                                            (
                                                                                part
                                                                            ) =>
                                                                                part[0]
                                                                        )
                                                                        .join(
                                                                            ""
                                                                        )
                                                                        .slice(
                                                                            0,
                                                                            2
                                                                        )
                                                                        .toUpperCase()}
                                                                </span>
                                                                <span className="person-name">
                                                                    {project
                                                                        .creator
                                                                        ?.name ||
                                                                        project
                                                                            .creator
                                                                            ?.email ||
                                                                        "—"}
                                                                </span>
                                                            </div>

                                                            <div className="person-cell">
                                                                <span className="person-avatar target-editor-avatar">
                                                                    {editor
                                                                        ? String(
                                                                              editor.name ||
                                                                                  editor.email
                                                                          )
                                                                              .split(
                                                                                  " "
                                                                              )
                                                                              .map(
                                                                                  (
                                                                                      part
                                                                                  ) =>
                                                                                      part[0]
                                                                              )
                                                                              .join(
                                                                                  ""
                                                                              )
                                                                              .slice(
                                                                                  0,
                                                                                  2
                                                                              )
                                                                              .toUpperCase()
                                                                        : "—"}
                                                                </span>
                                                                <span className="person-name">
                                                                    {editor
                                                                        ? editor.name ||
                                                                          editor.email
                                                                        : "Unassigned"}
                                                                </span>
                                                            </div>

                                                            <div>
                                                                <span
                                                                    className={`status-pill ${statusClass}`}
                                                                >
                                                                    {
                                                                        normalizedStatus ===
                                                                        "IN_REVIEW"
                                                                            ? "IN REVIEW"
                                                                            : normalizedStatus ===
                                                                                "IN_PRODUCTION"
                                                                              ? "IN PRODUCTION"
                                                                              : normalizedStatus
                                                                                    .replaceAll(
                                                                                        "_",
                                                                                        " "
                                                                                    )
                                                                    }
                                                                </span>
                                                            </div>

                                                            <span className="date-text">
                                                                {project.dueDate
                                                                    ? new Date(
                                                                          project.dueDate
                                                                      ).toLocaleDateString(
                                                                          "en-US",
                                                                          {
                                                                              month: "short",
                                                                              day: "2-digit",
                                                                              year: "numeric",
                                                                          }
                                                                      )
                                                                    : "No date"}
                                                            </span>

                                                            <span className="date-text">
                                                                {formatRelativeTime(
                                                                    project.updatedAt
                                                                )}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                className="row-actions-btn"
                                                                onClick={(
                                                                    event
                                                                ) => {
                                                                    event.stopPropagation();
                                                                    openProjectDetails(
                                                                        project
                                                                    );
                                                                }}
                                                                aria-label={`Open ${project.title}`}
                                                            >
                                                                ⋯
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                    </div>

                                    <div className="projects-table-footer">
                                        <span>
                                            {projects.length ? 1 : 0}&ndash;{Math.min(projects.length, 5)} of {projects.length} loaded projects
                                        </span>

                                        {projectsHasMore ? (
                                            <button
                                                type="button"
                                                className="btn-load-more"
                                                onClick={loadMoreProjects}
                                                disabled={
                                                    projectsLoadingMore
                                                }
                                            >
                                                {projectsLoadingMore
                                                    ? "Loading…"
                                                    : "Load More⌄"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn-load-more"
                                                onClick={() =>
                                                    setCurrentView(
                                                        "projects"
                                                    )
                                                }
                                            >
                                                View All
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="right-column-stack">
                                    <aside className="activity-card-box">
                                        <div className="activity-card-header">
                                            <h3>Recent Activity</h3>
                                            <button
                                                type="button"
                                                className="view-all-purple"
                                                onClick={() =>
                                                    setShowAllOverviewActivity(
                                                        (current) =>
                                                            !current
                                                    )
                                                }
                                            >
                                                {showAllOverviewActivity
                                                    ? "Show less"
                                                    : "View all →"}
                                            </button>
                                        </div>

                                        <div className="activity-items-stack">
                                            {activityLoading && (
                                                <p className="target-activity-empty" role="status">
                                                    Loading activity…
                                                </p>
                                            )}

                                            {!activityLoading &&
                                                activityError && (
                                                    <p className="target-activity-empty target-error" role="alert">
                                                        {activityError}
                                                    </p>
                                                )}

                                            {!activityLoading &&
                                                !activityError &&
                                                activity.length === 0 && (
                                                    <p className="target-activity-empty" role="status">
                                                        No activity yet.
                                                    </p>
                                                )}

                                            {!activityLoading &&
                                                !activityError &&
                                                (showAllOverviewActivity
                                                    ? activity
                                                    : activity.slice(
                                                          0,
                                                          5
                                                      )
                                                ).map(
                                                    (
                                                        entry,
                                                        index
                                                    ) => {
                                                        const action =
                                                            entry.action ||
                                                            "";
                                                        const isComment =
                                                            action.includes(
                                                                "COMMENT"
                                                            );
                                                        const isApproved =
                                                            action.includes(
                                                                "APPROVED"
                                                            );
                                                        const isReview =
                                                            action.includes(
                                                                "REVIEW"
                                                            );
                                                        const bubbleClass =
                                                            isApproved
                                                                ? "bubble-green"
                                                                : isComment
                                                                  ? "bubble-amber"
                                                                  : isReview
                                                                    ? "bubble-blue"
                                                                    : "bubble-purple";
                                                        const icon =
                                                            isApproved
                                                                ? "✓"
                                                                : isComment
                                                                  ? "□"
                                                                  : isReview
                                                                    ? "♙"
                                                                    : index %
                                                                          2 ===
                                                                      0
                                                                      ? "↗"
                                                                      : "⇧";

                                                        return (
                                                            <div
                                                                className="activity-row-item"
                                                                key={
                                                                    entry.id
                                                                }
                                                            >
                                                                <div
                                                                    className={`activity-bubble-icon ${bubbleClass}`}
                                                                >
                                                                    {icon}
                                                                </div>
                                                                <div className="activity-content-meta">
                                                                    <p>
                                                                        {formatActivityDescription(
                                                                            entry
                                                                        )}
                                                                    </p>
                                                                    <span>
                                                                        {formatRelativeTime(
                                                                            entry.createdAt
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                        </div>
                                    </aside>

                                    <aside className="quick-actions-card-box">
                                        <h4>Quick Actions</h4>
                                        <div className="quick-action-buttons-wrap">
                                            {isCreator && (
                                                <button
                                                    type="button"
                                                    className="action-btn-new-proj"
                                                    onClick={() =>
                                                        setBriefModalOpen(true)
                                                    }
                                                >
                                                    □ New Project
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="action-btn-upload"
                                                onClick={() =>
                                                    setCurrentView(
                                                        "assets"
                                                    )
                                                }
                                            >
                                                ⇧ Upload Asset
                                            </button>
                                        </div>
                                    </aside>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className={`view-panel projects-view ${currentView === "projects" ? "active" : ""}`}>
                        <div className="panel-scroll-container">
                            <header className="projects-page-header">
                                <div>
                                    <span className="greeting-kicker">PRODUCTION WORKSPACE</span>
                                    <h1 className="page-title">Projects</h1>
                                    <p>Manage production, track feedback, and keep every project moving.</p>
                                </div>
                                {isCreator && <button type="button" className="btn-new-project-purple" onClick={() => setBriefModalOpen(true)}>+ New Project</button>}
                            </header>
                            <p className="projects-summary-caption">Status counts reflect loaded results and current filters.</p>
                            <div className="projects-summary" aria-label="Filter by project status">
                                {["all", "REQUESTED", "IN_PRODUCTION", "IN_REVIEW", "REVISION", "APPROVED"].map((status) => (
                                    <button type="button" key={status} className={`projects-summary-chip ${projectFilter === status ? "selected" : ""}`}
                                        aria-pressed={projectFilter === status} onClick={() => setProjectFilter(status)}>
                                        <span>{status === "all" ? "All Projects" : displayStatus(status)}</span>
                                        <strong>{projectsLoading || projectsError ? "—" : status === "all" ? projects.length : projects.filter((project) => normalizeProjectStatus(project.status) === status).length}</strong>
                                    </button>
                                ))}
                            </div>
                            <section className="projects-list-card" aria-label="Projects">
                                <div className="projects-list-toolbar">
                                    <input
                                        className="dash-input"
                                        type="search"
                                        placeholder="Search project or creator..."
                                        aria-label="Search projects" value={projectSearch}
                                        onChange={(event) =>
                                            setProjectSearch(
                                                event.target.value
                                            )
                                        }
                                    />

                                    <select
                                        className="dash-input"
                                        aria-label="Creator" value={projectCreatorFilter}
                                        onChange={(event) =>
                                            setProjectCreatorFilter(
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="all">
                                            All creators
                                        </option>
                                        {projectCreatorOptions.map(
                                            (creator) => (
                                                <option
                                                    key={creator.id}
                                                    value={creator.id}
                                                >
                                                    {creator.name ||
                                                        creator.email}
                                                </option>
                                            )
                                        )}
                                    </select>

                                    <select
                                        className="dash-input"
                                        aria-label="Assigned editor" value={projectEditorFilter}
                                        onChange={(event) =>
                                            setProjectEditorFilter(
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="all">
                                            All editors
                                        </option>
                                        {projectEditorOptions.map(
                                            (editor) => (
                                                <option
                                                    key={editor.id}
                                                    value={editor.id}
                                                >
                                                    {editor.name ||
                                                        editor.email}
                                                </option>
                                            )
                                        )}
                                    </select>

                                    <select
                                        className="dash-input"
                                        aria-label="Content type" value={projectTypeFilter}
                                        onChange={(event) =>
                                            setProjectTypeFilter(
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="all">
                                            All types
                                        </option>
                                        <option value="Short-form">
                                            Short-form
                                        </option>
                                        <option value="YouTube Long-form">
                                            YouTube Long-form
                                        </option>
                                        <option value="Repurposed Cuts">
                                            Repurposed Cuts
                                        </option>
                                    </select>

                                    <select
                                        className="dash-input"
                                        aria-label="Sort projects" value={projectSort}
                                        onChange={(event) =>
                                            setProjectSort(
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="updated-desc">
                                            Recently updated
                                        </option>
                                        <option value="newest">
                                            Newest
                                        </option>
                                        <option value="oldest">
                                            Oldest
                                        </option>
                                        <option value="due-date">
                                            Due date
                                        </option>
                                    </select>

                                </div>
                                <div className="projects-list-heading" aria-hidden="true">
                                    <span>Project</span><span>Creator</span><span>Editor</span><span>Status</span><span>Due Date</span><span>Updated</span><span>Actions</span>
                                </div>
                                {projectsLoading && <div className="projects-list-state" role="status"><span className="projects-loading-dot" />Loading projects…</div>}
                                {!projectsLoading && projectsError && <div className="projects-list-state projects-list-error" role="alert">{projectsError}</div>}
                                {!projectsLoading && !projectsError && filteredAndSortedProjects.length === 0 && (
                                    <div className="projects-list-state">
                                        <strong>{hasProjectFilters ? "No projects match these filters" : "No projects yet"}</strong>
                                        <p>{hasProjectFilters ? "Try a different search or clear your filters." : "Your production work will appear here."}</p>
                                        {hasProjectFilters ? <button type="button" className="btn-new-project-purple" onClick={clearProjectFilters}>Clear filters</button> : isCreator && <button type="button" className="btn-new-project-purple" onClick={() => setBriefModalOpen(true)}>+ New Project</button>}
                                    </div>
                                )}
                                {!projectsLoading && !projectsError && filteredAndSortedProjects.map((proj) => {
                                    const creatorName = proj.creator?.name || proj.creator?.email || "Creator";
                                    const editors = proj.assignedEditors || [];
                                    const statusClass = normalizeProjectStatus(proj.status).toLowerCase().replaceAll("_", "-");
                                    return (
                                        <article className="projects-list-row" key={proj.id} aria-label={proj.title} onClick={() => openProjectDetails(proj)}>
                                            <div className="projects-list-identity">
                                                <span className="project-thumbnail-img target-thumbnail-placeholder" aria-hidden="true">▶</span>
                                                <div>
                                                    <button type="button" className="projects-title-button" onClick={(event) => { event.stopPropagation(); openProjectDetails(proj); }}>{proj.title}</button>
                                                    <span className="projects-secondary">{proj.type}</span>
                                                    <span className="projects-secondary">{proj.date}{proj.eta ? ` · ${proj.eta}` : ""}</span>
                                                </div>
                                            </div>
                                            <div className="projects-list-meta" data-label="Creator">
                                                <span className="projects-person"><span className="person-avatar" aria-hidden="true">{creatorName.slice(0, 1).toUpperCase()}</span><span>{creatorName}</span></span>
                                            </div>
                                            <div className="projects-list-meta" data-label="Editor">
                                                {editors.length ? editors.map((editor) => <span className="projects-person" key={editor.id}><span className="person-avatar" aria-hidden="true">{(editor.name || editor.email || "E").slice(0, 1).toUpperCase()}</span><span>{editor.name || editor.email}</span></span>) : <span className="projects-secondary">Unassigned</span>}
                                            </div>
                                            <div className="projects-list-meta" data-label="Status"><span className={`status-pill ${statusClass}`}>{displayStatus(proj.status)}</span></div>
                                            <div className="projects-list-meta" data-label="Due Date">{proj.dueDate ? new Date(proj.dueDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "No date"}</div>
                                            <div className="projects-list-meta" data-label="Updated">{formatRelativeTime(proj.updatedAt)}</div>
                                            <div className="projects-list-actions">
                                                <button type="button" className="projects-detail-button" onClick={(event) => { event.stopPropagation(); openProjectDetails(proj); }}>
                                                    {proj.status === "IN_REVIEW" ? "Review Cut ↗" : proj.status === "REVISION" ? "View Revision ↗" : proj.status === "APPROVED" ? "View Project ↗" : "View Brief"}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                                {!projectsLoading && !projectsError && (
                                    <footer className="projects-list-footer">
                                        <span>{projects.length} {projects.length === 1 ? "project" : "projects"} loaded{hasProjectFilters ? " matching current filters" : ""}</span>
                                        {projectsHasMore && <button type="button" className="btn-load-more" onClick={loadMoreProjects} disabled={projectsLoadingMore}>{projectsLoadingMore ? "Loading…" : "Load More Projects"}</button>}
                                    </footer>
                                )}
                            </section>
                        </div>
                    </div>
                    <div
                        className={`view-panel creators-view ${currentView ===
                            "creators"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel creators-page">
                                <header className="creators-page-header"><h1 className="page-title">Creators</h1><p>Manage creator workspaces and the people behind each production.</p></header>
                                <p className="creators-summary-caption">Profiles available in this organization</p>
                                <div className="creators-summary" aria-label="Loaded creator profiles">
                                    {[["Creators", creators.length], ["Linked accounts", creators.filter((creator) => creator.userId).length], ["Email provided", creators.filter((creator) => creator.email).length]].map(([label, count]) => <div key={label}><span>{label}</span><strong>{creatorsLoading || creatorsError ? "—" : count}</strong></div>)}
                                </div>
                                {creatorsLoading && (
                                    <div className="creators-state creators-loading" role="status"><div className="creators-skeleton" aria-hidden="true"><span /><span /><span /></div><p>Loading creator workspaces...</p></div>
                                )}

                                {!creatorsLoading &&
                                    creatorsError && (
                                        <p className="brief-error-msg active creators-state" role="alert">
                                            {
                                                creatorsError
                                            }
                                        </p>
                                    )}

                                {!creatorsLoading &&
                                    !creatorsError &&
                                    creators.length ===
                                    0 && (
                                        <div className="creators-state"><strong>No creators yet</strong><p>Creator workspaces will appear here when profiles are added to this organization.</p></div>
                                    )}

                                {!creatorsLoading &&
                                    !creatorsError &&
                                    creators.length >
                                    0 && (
                                        <div className="project-list creator-list">
                                            {creators.map(
                                                (
                                                    creator
                                                ) => (
                                                    <div
                                                        className="project-item creator-row"
                                                        key={
                                                            creator.id
                                                        }
                                                    >
                                                        <span className="person-avatar creator-profile-avatar" aria-hidden="true">{(creator.name || creator.email || "C").slice(0, 1).toUpperCase()}</span>
                                                        <div className="project-info">
                                                            <strong>
                                                                {
                                                                    creator.name
                                                                }
                                                            </strong>

                                                            <small>
                                                                {creator.email ||
                                                                    "No email provided"}
                                                            </small>
                                                        </div>

                                                        <div className="creator-profile-meta"><span>Profile added</span><strong>{creator.createdAt ? new Date(creator.createdAt).toLocaleDateString() : "Date unavailable"}</strong></div>

                                                        <button
                                                            type="button"
                                                            className="action-btn active"
                                                            onClick={() => {
                                                                setSelectedCreator(
                                                                    creator
                                                                );

                                                                setCurrentView(
                                                                    "creator-workspace"
                                                                );

                                                                loadCreatorProjects(
                                                                    creator.id
                                                                );

                                                                loadCreatorAssignments(
                                                                    creator.id
                                                                );
                                                            }}
                                                        >
                                                            Open workspace
                                                            ↗
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`view-panel creator-workspace-view ${currentView ===
                            "creator-workspace"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel creator-workspace-page">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            CREATOR WORKSPACE
                                        </span>

                                        <h1 className="creator-workspace-title page-title"><span className="person-avatar creator-profile-avatar" aria-hidden="true">{(selectedCreator?.name || "C").slice(0, 1).toUpperCase()}</span>
                                            {selectedCreator
                                                ? selectedCreator.name
                                                : "CREATOR WORKSPACE"}
                                        </h1>
                                    </div>

                                    <button
                                        type="button"
                                        className="action-btn"
                                        onClick={() => {
                                            setSelectedCreator(
                                                null
                                            );

                                            setCurrentView(
                                                "creators"
                                            );

                                            loadProjects(
                                                activeOrganizationId
                                            );
                                        }}
                                    >
                                        ← Back to Creators
                                    </button>
                                </div>

                                {!selectedCreator ? (
                                    <p className="text-link">
                                        Select a creator to
                                        open their workspace.
                                    </p>
                                ) : (
                                    <>
                                        <div className="metrics-grid creator-summary-grid" aria-busy={projectsLoading}>
                                            <div className="metric-card">
                                                <span className="metric-label">
                                                    CREATOR
                                                </span>

                                                <strong className="metric-value">
                                                    {
                                                        selectedCreator.name
                                                    }
                                                </strong>

                                                <span className="metric-delta">
                                                    {selectedCreator.email ||
                                                        "No email provided"}
                                                </span>
                                            </div>

                                            <div className="metric-card">
                                                <span className="metric-label">
                                                    ACTIVE PROJECTS
                                                </span>

                                                <strong className="metric-value">
                                                    {
                                                        projects.filter(
                                                            (
                                                                project
                                                            ) =>
                                                                ![
                                                                    "APPROVED",
                                                                ].includes(
                                                                    normalizeProjectStatus(
                                                                        project.status
                                                                    )
                                                                )
                                                        ).length
                                                    }
                                                </strong>

                                                <span className="metric-delta">
                                                    Current
                                                    production
                                                    queue
                                                </span>
                                            </div>

                                            <div className="metric-card">
                                                <span className="metric-label">
                                                    IN REVIEW
                                                </span>

                                                <strong className="metric-value">
                                                    {
                                                        projects.filter(
                                                            (
                                                                project
                                                            ) =>
                                                                normalizeProjectStatus(
                                                                    project.status
                                                                ) ===
                                                                "IN_REVIEW"
                                                        ).length
                                                    }
                                                </strong>

                                                <span className="metric-delta">
                                                    Awaiting
                                                    review
                                                </span>
                                            </div>

                                            <div className="metric-card">
                                                <span className="metric-label">
                                                    APPROVED
                                                </span>

                                                <strong className="metric-value">
                                                    {
                                                        projects.filter(
                                                            (
                                                                project
                                                            ) =>
                                                                normalizeProjectStatus(
                                                                    project.status
                                                                ) ===
                                                                "APPROVED"
                                                        ).length
                                                    }
                                                </strong>

                                                <span className="metric-delta">
                                                    Final
                                                    approved cuts
                                                </span>
                                            </div>
                                        </div>

                                        {isEditor &&
                                            canManageCreatorAssignments && (
                                                <div
                                                    className="panel creator-assignment-panel"
                                                    style={{
                                                        marginBottom:
                                                            "20px",
                                                    }}
                                                >
                                                    <div className="panel-header">
                                                        <div>
                                                            <span className="status-tag">
                                                                CREATOR
                                                                ACCESS
                                                            </span>

                                                            <h3>
                                                                Creator-wide access
                                                            </h3>
                                                        </div>

                                                        <span className="graph-tag">
                                                            {
                                                                creatorAssignments.length
                                                            }{" "}
                                                            ASSIGNED
                                                        </span>
                                                    </div>

                                                    <p className="text-link">
                                                        Editors
                                                        assigned here
                                                        can access every
                                                        project for this
                                                        Creator,
                                                        including future
                                                        projects.
                                                    </p>

                                                    {creatorAssignmentsLoading && (
                                                        <p className="text-link">
                                                            Loading
                                                            assignments…
                                                        </p>
                                                    )}

                                                    {!creatorAssignmentsLoading &&
                                                        creatorAssignmentsError && (
                                                            <p className="brief-error-msg active" role="alert">
                                                                {
                                                                    creatorAssignmentsError
                                                                }
                                                            </p>
                                                        )}

                                                    {!creatorAssignmentsLoading &&
                                                        creatorAssignments.length >
                                                            0 && (
                                                            <div
                                                                className="project-list"
                                                                style={{
                                                                    marginTop:
                                                                        "14px",
                                                                }}
                                                            >
                                                                {creatorAssignments.map(
                                                                    (
                                                                        assignment
                                                                    ) => (
                                                                        <div
                                                                            className="project-item"
                                                                            key={
                                                                                assignment.assignmentId
                                                                            }
                                                                        >
                                                                            <span className="person-avatar" aria-hidden="true">{(assignment.user?.name || assignment.user?.email || "E").slice(0, 1).toUpperCase()}</span><div className="project-info">
                                                                                <strong>
                                                                                    {assignment
                                                                                        .user
                                                                                        ?.name ||
                                                                                        assignment
                                                                                            .user
                                                                                            ?.email ||
                                                                                        "Editor"}
                                                                                </strong>

                                                                                <small>
                                                                                    {assignment
                                                                                        .user
                                                                                        ?.email ||
                                                                                        "No email"}
                                                                                </small>
                                                                            </div>

                                                                            <div className="project-status completed">
                                                                                CREATOR
                                                                                ACCESS
                                                                            </div>

                                                                            <button
                                                                                type="button"
                                                                                className="action-btn creator-remove-action"
                                                                                disabled={
                                                                                    creatorAssignmentUpdatingUserId ===
                                                                                    assignment
                                                                                        .user
                                                                                        ?.id
                                                                                }
                                                                                onClick={() =>
                                                                                    unassignEditorFromCreator(
                                                                                        selectedCreator.id,
                                                                                        assignment
                                                                                            .user
                                                                                            .id
                                                                                    )
                                                                                }
                                                                            >
                                                                                {creatorAssignmentUpdatingUserId ===
                                                                                assignment
                                                                                    .user
                                                                                    ?.id
                                                                                    ? "REMOVING…"
                                                                                    : "REMOVE"}
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}

                                                    {!creatorAssignmentsLoading &&
                                                        creatorAssignments.length ===
                                                            0 && (
                                                            <p className="text-link">
                                                                No
                                                                Editors
                                                                currently
                                                                have
                                                                Creator-wide
                                                                access.
                                                            </p>
                                                        )}

                                                    <div
                                                        style={{
                                                            marginTop:
                                                                "22px",
                                                        }}
                                                    >
                                                        <div className="panel-header">
                                                            <h3>
                                                                Available editors
                                                            </h3>

                                                            <span className="graph-tag">
                                                                {
                                                                    creatorAvailableEditors.length
                                                                }{" "}
                                                                AVAILABLE
                                                            </span>
                                                        </div>

                                                        {!creatorAssignmentsLoading &&
                                                            creatorAvailableEditors.length ===
                                                                0 && (
                                                                <p className="text-link">
                                                                    No
                                                                    additional
                                                                    Editors
                                                                    are
                                                                    available
                                                                    to
                                                                    assign.
                                                                </p>
                                                            )}

                                                        {!creatorAssignmentsLoading &&
                                                            creatorAvailableEditors.length >
                                                                0 && (
                                                                <div className="project-list">
                                                                    {creatorAvailableEditors.map(
                                                                        (
                                                                            editor
                                                                        ) => (
                                                                            <div
                                                                                className="project-item"
                                                                                key={
                                                                                    editor.id
                                                                                }
                                                                            >
                                                                                <span className="person-avatar" aria-hidden="true">{(editor.name || editor.email || "E").slice(0, 1).toUpperCase()}</span><div className="project-info">
                                                                                    <strong>
                                                                                        {editor.name ||
                                                                                            editor.email ||
                                                                                            "Editor"}
                                                                                    </strong>

                                                                                    <small>
                                                                                        {editor.email ||
                                                                                            "No email"}
                                                                                    </small>
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    className="action-btn active"
                                                                                    disabled={
                                                                                        creatorAssignmentUpdatingUserId ===
                                                                                        editor.id
                                                                                    }
                                                                                    onClick={() =>
                                                                                        assignEditorToCreator(
                                                                                            selectedCreator.id,
                                                                                            editor.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {creatorAssignmentUpdatingUserId ===
                                                                                    editor.id
                                                                                        ? "ASSIGNING…"
                                                                                        : "+ ASSIGN CREATOR"}
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            )}

                                        <div className="panel creator-projects-panel">
                                            <div className="panel-header">
                                                <h3>
                                                    Creator projects
                                                </h3>

                                                <span className="graph-tag">
                                                    {
                                                        projects.length
                                                    }{" "}
                                                    PROJECT
                                                    {projects.length ===
                                                        1
                                                        ? ""
                                                        : "S"}
                                                </span>
                                            </div>

                                            {projectsLoading && (
                                                <p className="text-link">
                                                    Loading
                                                    projects…
                                                </p>
                                            )}

                                            {!projectsLoading &&
                                                projectsError && (
                                                    <p className="brief-error-msg active" role="alert">
                                                        {
                                                            projectsError
                                                        }
                                                    </p>
                                                )}

                                            {!projectsLoading &&
                                                !projectsError &&
                                                projects.length ===
                                                0 && (
                                                    <p className="text-link">
                                                        No
                                                        projects
                                                        have
                                                        been
                                                        submitted
                                                        by this
                                                        creator
                                                        yet.
                                                    </p>
                                                )}

                                            {!projectsLoading &&
                                                !projectsError &&
                                                projects.length >
                                                0 && (
                                                    <div className="project-list">
                                                        {projects.map(
                                                            (
                                                                project
                                                            ) => (
                                                                <div
                                                                    className="project-item"
                                                                    key={
                                                                        project.id
                                                                    }
                                                                    role="button"
                                                                    tabIndex={
                                                                        0
                                                                    }
                                                                    onClick={() =>
                                                                        openProjectDetails(
                                                                            project
                                                                        )
                                                                    }
                                                                    onKeyDown={(
                                                                        e
                                                                    ) => {
                                                                        if (
                                                                            e.key ===
                                                                            "Enter" ||
                                                                            e.key ===
                                                                            " "
                                                                        ) {
                                                                            e.preventDefault();

                                                                            openProjectDetails(
                                                                                project
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="project-info">
                                                                        <strong>
                                                                            {
                                                                                project.title
                                                                            }
                                                                        </strong>

                                                                        <small>
                                                                            {
                                                                                project.type
                                                                            }{" "}
                                                                            •{" "}
                                                                            {
                                                                                project.date
                                                                            }
                                                                        </small>
                                                                    </div>

                                                                    <div
                                                                        className={`status-pill ${normalizeProjectStatus(project.status).toLowerCase().replaceAll("_", "-")}`}
                                                                    >
                                                                        {displayStatus(
                                                                            project.status
                                                                        )}
                                                                    </div>

                                                                    <div className="creator-project-meta">
                                                                        <span>Editors: {project.assignedEditors?.map((editor) => editor.name || editor.email).join(", ") || "Unassigned"}</span>
                                                                        <span>Due {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "date not set"}</span>
                                                                        <span>Updated {formatRelativeTime(project.updatedAt)}</span>
                                                                    </div>
                                                                    <span className="creator-project-open">Open project &rarr;</span>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`view-panel project-detail-view ${currentView ===
                            "project-details"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel detail-page">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            PROJECT DETAILS
                                        </span>

                                        <h1 className="page-title">
                                            {selectedProject
                                                ?.content
                                                ?.title ||
                                                "PROJECT"}
                                        </h1>
                                    </div>

                                    <div
                                        className="detail-header-actions"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            flexWrap: "wrap",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="action-btn detail-back-action"
                                            onClick={() => {
                                                setProjectEditing(false);
                                                setProjectEditError(null);
                                                setSelectedProject(
                                                    null
                                                );

                                                if (
                                                    selectedCreator
                                                ) {
                                                    setCurrentView(
                                                        "creator-workspace"
                                                    );

                                                    loadCreatorProjects(
                                                        selectedCreator.id
                                                    );
                                                } else {
                                                    setCurrentView(
                                                        "projects"
                                                    );

                                                    loadProjects(
                                                        activeOrganizationId
                                                    );
                                                }
                                            }}
                                        >
                                            ← Back to Projects
                                        </button>
                                        {canEditProjectDetails &&
                                            selectedProject && (
                                                <button
                                                    type="button"
                                                    className="action-btn detail-edit-action"
                                                    onClick={
                                                        projectEditing
                                                            ? cancelProjectEditing
                                                            : startProjectEditing
                                                    }
                                                    disabled={
                                                        projectEditSaving
                                                    }
                                                >
                                                    {projectEditing
                                                        ? "Cancel Edit"
                                                        : "Edit Project"}
                                                </button>
                                            )}

                                        {canDeleteProject &&
                                            selectedProject && (
                                                <button
                                                    type="button"
                                                    className="action-btn detail-delete-action"
                                                    onClick={
                                                        deleteProject
                                                    }
                                                    disabled={
                                                        projectDeleting
                                                    }
                                                    style={{
                                                        borderColor:
                                                            "var(--red)",
                                                        color:
                                                            "var(--red)",
                                                    }}
                                                >
                                                    {projectDeleting
                                                        ? "DELETING..."
                                                        : "Delete Project"}
                                                </button>
                                            )}


                                    </div>
                                </div>

                                {selectedProject && !projectDetailsLoading && (
                                    <div className="detail-header-meta">
                                        <span>{selectedProject.content.contentType}</span>
                                        <span>{selectedProject.project?.creator?.name || selectedProject.project?.creator?.email || "Unassigned creator"}</span>
                                        <span className={`status-pill ${currentProjectStatus.toLowerCase().replaceAll("_", "-")}`}>{currentProjectStatus.replaceAll("_", " ")}</span>
                                        <span>Due {selectedProject.content.dueDate ? new Date(selectedProject.content.dueDate).toLocaleDateString() : "date not set"}</span>
                                        <span>Editors: {(projects.find((project) => project.id === selectedProject.content.id)?.assignedEditors || []).map((editor) => editor.name || editor.email).join(", ") || "Unassigned"}</span>
                                    </div>
                                )}
                                {projectDetailsLoading && (
                                    <p className="text-link">
                                        Loading project
                                        details…
                                    </p>
                                )}

                                {!projectDetailsLoading &&
                                    projectDetailsError && (
                                        <p className="brief-error-msg active" role="alert">
                                            {
                                                projectDetailsError
                                            }
                                        </p>
                                    )}

                                {!projectDetailsLoading &&
                                    !projectDetailsError &&
                                    selectedProject && (
                                        <>
                                            <section className="detail-progress" aria-label="Production progress">
                                                <div className="detail-section-heading"><h3>Production progress</h3><span className={`status-pill ${currentProjectStatus.toLowerCase().replaceAll("_", "-")}`}>{currentProjectStatus.replaceAll("_", " ")}</span></div>
                                                <ol>
                                                    {["REQUESTED", "IN_PRODUCTION", "IN_REVIEW", "REVISION", "APPROVED"].map((status, index) => {
                                                        const stages = ["REQUESTED", "IN_PRODUCTION", "IN_REVIEW", "REVISION", "APPROVED"];
                                                        const isCurrent = currentProjectStatus === status;
                                                        const completed = status !== "REVISION" && !isCurrent && stages.indexOf(currentProjectStatus) > index;
                                                        return <li key={status} className={isCurrent ? "is-current" : completed ? "is-complete" : ""} aria-current={isCurrent ? "step" : undefined}>
                                                            <span aria-hidden="true">{completed ? "✓" : index + 1}</span><strong>{status.replaceAll("_", " ")}</strong>
                                                            <small>{isCurrent ? "Current stage" : completed ? "Completed" : status === "REVISION" ? "If requested" : ""}</small>
                                                        </li>;
                                                    })}
                                                </ol>
                                                <p>Revisions return to production and review. Approval completes Nexus production.</p>
                                            </section>
                                            <div className="detail-overview-grid">
                                                <section className="panel detail-information">
                                                    <div className="panel-header"><h3>Project information</h3></div>
                                                    <h4>{selectedProject.content.title}</h4>
                                                    <p className="detail-description">{selectedProject.content.description || "No description provided."}</p>
                                                    <dl className="detail-facts">
                                                        <div><dt>Content type</dt><dd>{selectedProject.content.contentType || "—"}</dd></div>
                                                        <div><dt>Due date</dt><dd>{selectedProject.content.dueDate ? new Date(selectedProject.content.dueDate).toLocaleDateString() : "No due date"}</dd></div>
                                                        <div><dt>Submitted</dt><dd>{selectedProject.content.createdAt ? new Date(selectedProject.content.createdAt).toLocaleDateString() : "—"}</dd></div>
                                                        <div><dt>Updated</dt><dd>{formatRelativeTime(selectedProject.content.updatedAt)}</dd></div>
                                                    </dl>
                                                    {selectedProject.content.footageLink ? <a className="asset-action" href={selectedProject.content.footageLink} target="_blank" rel="noopener noreferrer">Open footage folder ↗</a> : <p className="text-link">No footage folder linked.</p>}
                                                </section>
                                                <aside className="panel detail-people">
                                                    <div className="panel-header"><h3>People</h3></div>
                                                    <span className="detail-person-label">Creator</span>
                                                    <strong>{selectedProject.project?.creator?.name || selectedProject.project?.creator?.email || "Unassigned"}</strong>
                                                    <small>{selectedProject.project?.creator?.email}</small>
                                                    <span className="detail-person-label">Assigned editors</span>
                                                    {(projects.find((project) => project.id === selectedProject.content.id)?.assignedEditors || []).map((editor) => <div className="detail-person projects-person" key={editor.id}><span className="person-avatar" aria-hidden="true">{(editor.name || editor.email || "E").slice(0, 1).toUpperCase()}</span><span>{editor.name || editor.email}</span></div>)}
                                                    {!(projects.find((project) => project.id === selectedProject.content.id)?.assignedEditors?.length) && <p className="text-link">No editors listed.</p>}
                                                </aside>
                                            </div>
                                            {projectEditing && (
                                                <div
                                                    className="panel"
                                                    style={{
                                                        marginTop: "20px",
                                                    }}
                                                >
                                                    <div className="panel-header">
                                                        <div>
                                                            <span className="status-tag">
                                                                PROJECT SETTINGS
                                                            </span>

                                                            <h3>
                                                                EDIT PROJECT DETAILS
                                                            </h3>
                                                        </div>

                                                        <span className="graph-tag">
                                                            {currentProjectStatus}
                                                        </span>
                                                    </div>

                                                    <form
                                                        className="brief-form"
                                                        onSubmit={
                                                            saveProjectDetails
                                                        }
                                                    >
                                                        <div className="form-row">
                                                            <div className="form-field">
                                                                <label htmlFor="editProjectTitle">
                                                                    PROJECT TITLE
                                                                </label>

                                                                <input
                                                                    id="editProjectTitle"
                                                                    type="text"
                                                                    className="dash-input"
                                                                    value={
                                                                        projectEditDraft.title
                                                                    }
                                                                    onChange={(event) =>
                                                                        setProjectEditDraft(
                                                                            (current) => ({
                                                                                ...current,
                                                                                title: event.target.value,
                                                                            })
                                                                        )
                                                                    }
                                                                    required
                                                                />
                                                            </div>

                                                            <div className="form-field">
                                                                <label htmlFor="editProjectType">
                                                                    CONTENT TYPE
                                                                </label>

                                                                <select
                                                                    id="editProjectType"
                                                                    className="dash-input"
                                                                    value={
                                                                        projectEditDraft.contentType
                                                                    }
                                                                    disabled={
                                                                        !canEditProjectContentType
                                                                    }
                                                                    onChange={(event) =>
                                                                        setProjectEditDraft(
                                                                            (current) => ({
                                                                                ...current,
                                                                                contentType: event.target.value,
                                                                            })
                                                                        )
                                                                    }
                                                                >
                                                                    <option value="Short-form">
                                                                        Short-form Reel / TikTok
                                                                    </option>
                                                                    <option value="YouTube Long-form">
                                                                        YouTube Long-form
                                                                    </option>
                                                                    <option value="Repurposed Cuts">
                                                                        Social Repurpose Pack
                                                                    </option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="form-row">
                                                            <div className="form-field">
                                                                <label htmlFor="editProjectFootage">
                                                                    GOOGLE DRIVE FOOTAGE FOLDER
                                                                </label>

                                                                <input
                                                                    id="editProjectFootage"
                                                                    type="url"
                                                                    className="dash-input"
                                                                    value={
                                                                        projectEditDraft.footageLink
                                                                    }
                                                                    disabled={
                                                                        !canEditProjectFootage
                                                                    }
                                                                    onChange={(event) =>
                                                                        setProjectEditDraft(
                                                                            (current) => ({
                                                                                ...current,
                                                                                footageLink: event.target.value,
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                            </div>

                                                            <div className="form-field">
                                                                <label htmlFor="editProjectDueDate">
                                                                    DUE DATE
                                                                </label>

                                                                <input
                                                                    id="editProjectDueDate"
                                                                    type="date"
                                                                    className="dash-input"
                                                                    value={
                                                                        projectEditDraft.dueDate
                                                                    }
                                                                    onChange={(event) =>
                                                                        setProjectEditDraft(
                                                                            (current) => ({
                                                                                ...current,
                                                                                dueDate: event.target.value,
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="form-field">
                                                            <label htmlFor="editProjectDescription">
                                                                PROJECT BRIEF / DESCRIPTION
                                                            </label>

                                                            <textarea
                                                                id="editProjectDescription"
                                                                className="dash-input"
                                                                rows={4}
                                                                value={
                                                                    projectEditDraft.description
                                                                }
                                                                onChange={(event) =>
                                                                    setProjectEditDraft(
                                                                        (current) => ({
                                                                            ...current,
                                                                            description: event.target.value,
                                                                        })
                                                                    )
                                                                }
                                                                placeholder="Add project context, editing notes, goals, or other important information."
                                                            />
                                                        </div>

                                                        {!canEditProjectContentType &&
                                                            isCreator && (
                                                                <p className="text-link">
                                                                    Content type is locked once production has started.
                                                                </p>
                                                            )}

                                                        {!canEditProjectFootage &&
                                                            isCreator && (
                                                                <p className="text-link">
                                                                    The footage folder is locked while the project is in review or revision.
                                                                </p>
                                                            )}

                                                        {projectEditError && (
                                                            <p className="brief-error-msg active" role="alert">
                                                                {projectEditError}
                                                            </p>
                                                        )}

                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                gap: "10px",
                                                                flexWrap: "wrap",
                                                            }}
                                                        >
                                                            <button
                                                                type="submit"
                                                                className="button button-primary"
                                                                disabled={
                                                                    projectEditSaving
                                                                }
                                                            >
                                                                {projectEditSaving
                                                                    ? "SAVING…"
                                                                    : "SAVE PROJECT"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="button button-ghost"
                                                                onClick={
                                                                    cancelProjectEditing
                                                                }
                                                                disabled={
                                                                    projectEditSaving
                                                                }
                                                            >
                                                                CANCEL
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            )}

                                            <div
                                                className="panel"
                                                style={{
                                                    marginTop:
                                                        "20px",
                                                }}
                                            >
                                                <div className="panel-header">
                                                    <div>
                                                        <h3>Production Tasks</h3>
                                                    </div>

                                                    <span className="graph-tag">
                                                        {
                                                            tasks.length
                                                        }{" "}
                                                        TASK
                                                        {tasks.length ===
                                                        1
                                                            ? ""
                                                            : "S"}
                                                    </span>
                                                </div>

                                                {tasksLoading && (
                                                    <p className="text-link">
                                                        Loading
                                                        tasks…
                                                    </p>
                                                )}

                                                {!tasksLoading &&
                                                    tasksError && (
                                                        <p className="brief-error-msg active" role="alert">
                                                            {
                                                                tasksError
                                                            }
                                                        </p>
                                                    )}

                                                {canManageTaskStructure && (
                                                        <form
                                                            onSubmit={
                                                                createTask
                                                            }
                                                            style={{
                                                                marginTop:
                                                                    "18px",
                                                                padding:
                                                                    "16px",
                                                                border:
                                                                    "1px solid var(--line)",
                                                                borderRadius:
                                                                    "8px",
                                                            }}
                                                        >
                                                            <div className="panel-header">
                                                                <div><h3>New task</h3><p className="detail-task-help">Add a production step and assign it to your team.</p></div>
                                                            </div>

                                                            <div className="form-row">
                                                                <div className="form-field">
                                                                    <label htmlFor="newTaskTitle">
                                                                        TASK
                                                                        TITLE
                                                                    </label>

                                                                    <input
                                                                        id="newTaskTitle"
                                                                        type="text"
                                                                        className="dash-input"
                                                                        value={
                                                                            newTask.title
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setNewTask(
                                                                                (
                                                                                    current
                                                                                ) => ({
                                                                                    ...current,
                                                                                    title: e
                                                                                        .target
                                                                                        .value,
                                                                                })
                                                                            )
                                                                        }
                                                                        placeholder="e.g. Edit main video"
                                                                        required
                                                                    />
                                                                </div>

                                                                <div className="form-field">
                                                                    <label htmlFor="newTaskPriority">
                                                                        PRIORITY
                                                                    </label>

                                                                    <select
                                                                        id="newTaskPriority"
                                                                        className="dash-input"
                                                                        value={
                                                                            newTask.priority
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setNewTask(
                                                                                (
                                                                                    current
                                                                                ) => ({
                                                                                    ...current,
                                                                                    priority:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                })
                                                                            )
                                                                        }
                                                                    >
                                                                        {[
                                                                            "LOW",
                                                                            "MEDIUM",
                                                                            "HIGH",
                                                                            "URGENT",
                                                                        ].map(
                                                                            (
                                                                                priority
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        priority
                                                                                    }
                                                                                    value={
                                                                                        priority
                                                                                    }
                                                                                >
                                                                                    {displayTaskPriority(
                                                                                        priority
                                                                                    )}
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div className="form-row">
                                                                <div className="form-field">
                                                                    <label htmlFor="newTaskAssignee">
                                                                        ASSIGNED
                                                                        EDITOR
                                                                    </label>

                                                                    <select
                                                                        id="newTaskAssignee"
                                                                        className="dash-input"
                                                                        value={
                                                                            newTask.assignedToId
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setNewTask(
                                                                                (
                                                                                    current
                                                                                ) => ({
                                                                                    ...current,
                                                                                    assignedToId:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                })
                                                                            )
                                                                        }
                                                                    >
                                                                        <option value="">
                                                                            UNASSIGNED
                                                                        </option>

                                                                        {taskAssignableEditors.map(
                                                                            (
                                                                                editor
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        editor.id
                                                                                    }
                                                                                    value={
                                                                                        editor.id
                                                                                    }
                                                                                >
                                                                                    {editor.name ||
                                                                                        editor.email ||
                                                                                        "Editor"}
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                </div>

                                                                <div className="form-field">
                                                                    <label htmlFor="newTaskDueDate">
                                                                        DUE
                                                                        DATE
                                                                    </label>

                                                                    <input
                                                                        id="newTaskDueDate"
                                                                        type="date"
                                                                        className="dash-input"
                                                                        value={
                                                                            newTask.dueDate
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setNewTask(
                                                                                (
                                                                                    current
                                                                                ) => ({
                                                                                    ...current,
                                                                                    dueDate:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                })
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="form-field">
                                                                <label htmlFor="newTaskDescription">
                                                                    DESCRIPTION
                                                                </label>

                                                                <textarea
                                                                    id="newTaskDescription"
                                                                    className="dash-input"
                                                                    rows={
                                                                        3
                                                                    }
                                                                    value={
                                                                        newTask.description
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setNewTask(
                                                                            (
                                                                                current
                                                                            ) => ({
                                                                                ...current,
                                                                                description:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            })
                                                                        )
                                                                    }
                                                                    placeholder="Optional production notes..."
                                                                />
                                                            </div>

                                                            <button
                                                                type="submit"
                                                                className="button button-primary"
                                                                disabled={
                                                                    taskCreating ||
                                                                    !newTask.title.trim()
                                                                }
                                                                style={{
                                                                    marginTop:
                                                                        "14px",
                                                                }}
                                                            >
                                                                {taskCreating
                                                                    ? "CREATING…"
                                                                    : "+ Create Task"}
                                                            </button>
                                                        </form>
                                                    )}

                                                {!tasksLoading &&
                                                    !tasksError &&
                                                    tasks.length ===
                                                        0 && (
                                                        <p
                                                            className="text-link"
                                                            style={{
                                                                marginTop:
                                                                    "16px",
                                                            }}
                                                        >
                                                            No
                                                            production
                                                            tasks have
                                                            been created
                                                            for this
                                                            project yet.
                                                        </p>
                                                    )}

                                                {!tasksLoading &&
                                                    tasks.length >
                                                        0 && (
                                                        <div
                                                            style={{
                                                                display:
                                                                    "grid",
                                                                gap: "14px",
                                                                marginTop:
                                                                    "18px",
                                                            }}
                                                        >
                                                            {tasks.map(
                                                                (
                                                                    task
                                                                ) => {
                                                                    const draft =
                                                                        taskDrafts[
                                                                            task
                                                                                .id
                                                                        ] ||
                                                                        toTaskDraft(
                                                                            task
                                                                        );

                                                                    const priorityClass =
                                                                        String(
                                                                            draft.priority ||
                                                                                "MEDIUM"
                                                                        ).toLowerCase();

                                                                    if (
                                                                        task.status ===
                                                                            "COMPLETED" &&
                                                                        !expandedCompletedTasks[
                                                                            task.id
                                                                        ]
                                                                    ) {
                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    task.id
                                                                                }
                                                                                className={`task-card task-card-completed task-priority-border-${priorityClass}`}
                                                                            >
                                                                                <div className="task-completed-copy">
                                                                                    <span
                                                                                        className={`task-priority-label task-priority-${priorityClass}`}
                                                                                    >
                                                                                        {displayTaskPriority(
                                                                                            task.priority
                                                                                        )}{" "}
                                                                                        PRIORITY
                                                                                    </span>

                                                                                    <strong className="task-completed-title">
                                                                                        {
                                                                                            task.title
                                                                                        }
                                                                                    </strong>
                                                                                    <div className="detail-task-meta">
                                                                                        {task.assignedTo && <span>Assigned to {task.assignedTo.name || task.assignedTo.email}</span>}
                                                                                        {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                                                                                    </div>
                                                                                </div>

                                                                                <div className="task-completed-controls">
                                                                                    <span className="task-completed-status">
                                                                                        COMPLETED
                                                                                    </span>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="action-btn task-expand-btn"
                                                                                        onClick={() =>
                                                                                            setExpandedCompletedTasks(
                                                                                                (
                                                                                                    current
                                                                                                ) => ({
                                                                                                    ...current,
                                                                                                    [task.id]:
                                                                                                        true,
                                                                                                })
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        EXPAND ↗
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                task.id
                                                                            }
                                                                            className={`task-card task-priority-border-${priorityClass}`}
                                                                        >
                                                                            <div className="panel-header task-card-header">
                                                                                <div>
                                                                                    <span
                                                                                        className={`task-priority-label task-priority-${priorityClass}`}
                                                                                    >
                                                                                        {displayTaskPriority(
                                                                                            draft.priority
                                                                                        )}{" "}
                                                                                        PRIORITY
                                                                                    </span>

                                                                                    <h3>
                                                                                        {task.title}
                                                                                    </h3>
                                                                                </div>

                                                                                <span
                                                                                    className={`task-status-badge task-status-${String(
                                                                                        draft.status ||
                                                                                            "TODO"
                                                                                    )
                                                                                        .toLowerCase()
                                                                                        .replaceAll(
                                                                                            "_",
                                                                                            "-"
                                                                                        )}`}
                                                                                >
                                                                                    {displayTaskStatus(
                                                                                        draft.status
                                                                                    )}
                                                                                </span>
                                                                            </div>

                                                                            <div className="detail-task-meta">{task.assignedTo && <span>Assigned to {task.assignedTo.name || task.assignedTo.email}</span>}{task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}</div>
                                                                            <div className="form-row">
                                                                                <div className="form-field">
                                                                                    <label>
                                                                                        TASK
                                                                                        TITLE
                                                                                    </label>

                                                                                    <input
                                                                                        type="text"
                                                                                        className="dash-input"
                                                                                        value={
                                                                                            draft.title
                                                                                        }
                                                                                        readOnly={
                                                                                            !canManageTaskStructure
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateTaskDraft(
                                                                                                task.id,
                                                                                                "title",
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                <div className="form-field">
                                                                                    <label>
                                                                                        STATUS
                                                                                    </label>

                                                                                    <select
                                                                                        className="dash-input"
                                                                                        value={
                                                                                            draft.status
                                                                                        }
                                                                                        disabled={
                                                                                             !canUpdateTaskStatus ||
                                                                                             taskUpdatingId ===
                                                                                                 task.id
                                                                                         }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateTaskDraft(
                                                                                                task.id,
                                                                                                "status",
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {[
                                                                                            "TODO",
                                                                                            "IN_PROGRESS",
                                                                                            "IN_REVIEW",
                                                                                            "COMPLETED",
                                                                                        ].map(
                                                                                            (
                                                                                                status
                                                                                            ) => (
                                                                                                <option
                                                                                                    key={
                                                                                                        status
                                                                                                    }
                                                                                                    value={
                                                                                                        status
                                                                                                    }
                                                                                                >
                                                                                                    {displayTaskStatus(
                                                                                                        status
                                                                                                    )}
                                                                                                </option>
                                                                                            )
                                                                                        )}
                                                                                    </select>
                                                                                </div>
                                                                            </div>

                                                                            <div className="form-row">
                                                                                <div className="form-field">
                                                                                    <label>
                                                                                        PRIORITY
                                                                                    </label>

                                                                                    <select
                                                                                        className="dash-input"
                                                                                        value={
                                                                                            draft.priority
                                                                                        }
                                                                                        disabled={
                                                                                            !canManageTaskStructure
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateTaskDraft(
                                                                                                task.id,
                                                                                                "priority",
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {[
                                                                                            "LOW",
                                                                                            "MEDIUM",
                                                                                            "HIGH",
                                                                                            "URGENT",
                                                                                        ].map(
                                                                                            (
                                                                                                priority
                                                                                            ) => (
                                                                                                <option
                                                                                                    key={
                                                                                                        priority
                                                                                                    }
                                                                                                    value={
                                                                                                        priority
                                                                                                    }
                                                                                                >
                                                                                                    {displayTaskPriority(
                                                                                                        priority
                                                                                                    )}
                                                                                                </option>
                                                                                            )
                                                                                        )}
                                                                                    </select>
                                                                                </div>

                                                                                <div className="form-field">
                                                                                    <label>
                                                                                        DUE
                                                                                        DATE
                                                                                    </label>

                                                                                    <input
                                                                                        type="date"
                                                                                        className="dash-input"
                                                                                        value={
                                                                                            draft.dueDate
                                                                                        }
                                                                                        readOnly={
                                                                                            !canManageTaskStructure
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateTaskDraft(
                                                                                                task.id,
                                                                                                "dueDate",
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </div>

                                                                            <div className="form-field">
                                                                                <label>
                                                                                    ASSIGNED
                                                                                    EDITOR
                                                                                </label>

                                                                                {canManageTaskStructure ? (
                                                                                    <select
                                                                                        className="dash-input"
                                                                                        value={
                                                                                            draft.assignedToId
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateTaskDraft(
                                                                                                task.id,
                                                                                                "assignedToId",
                                                                                                e
                                                                                                    .target
                                                                                                    .value
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <option value="">
                                                                                            UNASSIGNED
                                                                                        </option>

                                                                                        {taskAssignableEditors.map(
                                                                                            (
                                                                                                editor
                                                                                            ) => (
                                                                                                <option
                                                                                                    key={
                                                                                                        editor.id
                                                                                                    }
                                                                                                    value={
                                                                                                        editor.id
                                                                                                    }
                                                                                                >
                                                                                                    {editor.name ||
                                                                                                        editor.email ||
                                                                                                        "Editor"}
                                                                                                </option>
                                                                                            )
                                                                                        )}
                                                                                    </select>
                                                                                ) : (
                                                                                    <input
                                                                                        type="text"
                                                                                        className="dash-input"
                                                                                        readOnly
                                                                                        value={
                                                                                            task
                                                                                                .assignedTo
                                                                                                ?.name ||
                                                                                            task
                                                                                                .assignedTo
                                                                                                ?.email ||
                                                                                            "UNASSIGNED"
                                                                                        }
                                                                                    />
                                                                                )}
                                                                            </div>

                                                                            <div className="form-field">
                                                                                <label>
                                                                                    DESCRIPTION
                                                                                </label>

                                                                                <textarea
                                                                                    className="dash-input"
                                                                                    rows={
                                                                                        3
                                                                                    }
                                                                                    value={
                                                                                        draft.description
                                                                                    }
                                                                                    readOnly={
                                                                                        !canManageTaskStructure
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateTaskDraft(
                                                                                            task.id,
                                                                                            "description",
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                    placeholder="No description"
                                                                                />
                                                                            </div>

                                                                            {task.status ===
                                                                                "COMPLETED" &&
                                                                                expandedCompletedTasks[
                                                                                    task.id
                                                                                ] && (
                                                                                    <div className="task-expanded-toolbar">
                                                                                        <button
                                                                                            type="button"
                                                                                            className="action-btn"
                                                                                            onClick={() =>
                                                                                                setExpandedCompletedTasks(
                                                                                                    (
                                                                                                        current
                                                                                                    ) => {
                                                                                                        const next = {
                                                                                                            ...current,
                                                                                                        };
                                                                                                        delete next[
                                                                                                            task
                                                                                                                .id
                                                                                                        ];
                                                                                                        return next;
                                                                                                    }
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            COLLAPSE
                                                                                        </button>
                                                                                    </div>
                                                                                )}

                                                                            {(isEditor || isCreator) && (
                                                                                <div className="task-actions">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="button button-primary"
                                                                                        disabled={
                                                                                            taskUpdatingId ===
                                                                                            task.id
                                                                                        }
                                                                                        onClick={() =>
                                                                                            saveTask(
                                                                                                task.id
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {taskUpdatingId ===
                                                                                        task.id
                                                                                            ? "SAVING…"
                                                                                            : canManageTaskStructure
                                                                                                ? "SAVE TASK"
                                                                                                : "SAVE STATUS"}
                                                                                    </button>

                                                                                    {canManageTaskStructure && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="action-btn"
                                                                                            disabled={
                                                                                                taskDeletingId ===
                                                                                                task.id
                                                                                            }
                                                                                            onClick={() =>
                                                                                                deleteTask(
                                                                                                    task.id
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            {taskDeletingId ===
                                                                                            task.id
                                                                                                ? "DELETING…"
                                                                                                : "DELETE TASK"}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }
                                                            )}
                                                        </div>
                                                    )}
                                            </div>

                                            {isEditor &&
                                                canManageAssignments && (
                                                    <div
                                                        className="panel"
                                                        style={{
                                                            marginTop:
                                                                "20px",
                                                        }}
                                                    >
                                                        <div className="panel-header">
                                                            <div>
                                                                <span className="status-tag">
                                                                    PROJECT
                                                                    ACCESS
                                                                </span>

                                                                <h3>
                                                                    ASSIGNED
                                                                    EDITORS
                                                                </h3>
                                                            </div>

                                                            <span className="graph-tag">
                                                                {
                                                                    projectAssignments.length
                                                                }{" "}
                                                                DIRECT
                                                            </span>
                                                        </div>

                                                        <p className="text-link">
                                                            Editors
                                                            assigned here
                                                            only receive
                                                            access to
                                                            this project.
                                                        </p>

                                                        {assignmentsLoading && (
                                                            <p className="text-link">
                                                                Loading
                                                                assignments…
                                                            </p>
                                                        )}

                                                        {!assignmentsLoading &&
                                                            assignmentsError && (
                                                                <p className="brief-error-msg active" role="alert">
                                                                    {
                                                                        assignmentsError
                                                                    }
                                                                </p>
                                                            )}

                                                        {!assignmentsLoading &&
                                                            inheritedProjectEditors.length >
                                                                0 && (
                                                                <div
                                                                    style={{
                                                                        marginTop:
                                                                            "18px",
                                                                    }}
                                                                >
                                                                    <div className="panel-header">
                                                                        <h3>
                                                                            CREATOR
                                                                            ACCESS
                                                                        </h3>

                                                                        <span className="graph-tag">
                                                                            {
                                                                                inheritedProjectEditors.length
                                                                            }{" "}
                                                                            INHERITED
                                                                        </span>
                                                                    </div>

                                                                    <div className="project-list">
                                                                        {inheritedProjectEditors.map(
                                                                            (
                                                                                assignment
                                                                            ) => (
                                                                                <div
                                                                                    className="project-item"
                                                                                    key={`creator-${assignment.assignmentId}`}
                                                                                >
                                                                                    <div className="project-info">
                                                                                        <strong>
                                                                                            {assignment
                                                                                                .user
                                                                                                ?.name ||
                                                                                                assignment
                                                                                                    .user
                                                                                                    ?.email ||
                                                                                                "Editor"}
                                                                                        </strong>

                                                                                        <small>
                                                                                            {assignment
                                                                                                .user
                                                                                                ?.email ||
                                                                                                "No email"}
                                                                                        </small>
                                                                                    </div>

                                                                                    <div className="project-status completed">
                                                                                        CREATOR
                                                                                        ACCESS
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>

                                                                    <p className="text-link">
                                                                        Remove
                                                                        Creator-wide
                                                                        access
                                                                        from the
                                                                        Creator
                                                                        Workspace.
                                                                    </p>
                                                                </div>
                                                            )}

                                                        <div
                                                            style={{
                                                                marginTop:
                                                                    "18px",
                                                            }}
                                                        >
                                                            <div className="panel-header">
                                                                <h3>
                                                                    PROJECT
                                                                    ACCESS
                                                                </h3>

                                                                <span className="graph-tag">
                                                                    {
                                                                        projectAssignments.length
                                                                    }{" "}
                                                                    ASSIGNED
                                                                </span>
                                                            </div>

                                                            {!assignmentsLoading &&
                                                                projectAssignments.length ===
                                                                    0 && (
                                                                    <p className="text-link">
                                                                        No
                                                                        Editors
                                                                        are
                                                                        directly
                                                                        assigned
                                                                        to this
                                                                        project
                                                                        yet.
                                                                    </p>
                                                                )}

                                                            {!assignmentsLoading &&
                                                                projectAssignments.length >
                                                                    0 && (
                                                                    <div className="project-list">
                                                                        {projectAssignments.map(
                                                                            (
                                                                                assignment
                                                                            ) => (
                                                                                <div
                                                                                    className="project-item"
                                                                                    key={
                                                                                        assignment.assignmentId
                                                                                    }
                                                                                >
                                                                                    <div className="project-info">
                                                                                        <strong>
                                                                                            {assignment
                                                                                                .user
                                                                                                ?.name ||
                                                                                                assignment
                                                                                                    .user
                                                                                                    ?.email ||
                                                                                                "Editor"}
                                                                                        </strong>

                                                                                        <small>
                                                                                            {assignment
                                                                                                .user
                                                                                                ?.email ||
                                                                                                "No email"}
                                                                                        </small>
                                                                                    </div>

                                                                                    <div
                                                                                        style={{
                                                                                            marginLeft:
                                                                                                "auto",
                                                                                            display:
                                                                                                "flex",
                                                                                            alignItems:
                                                                                                "center",
                                                                                            justifyContent:
                                                                                                "flex-end",
                                                                                            gap:
                                                                                                "12px",
                                                                                        }}
                                                                                    >
                                                                                        <div className="project-status completed">
                                                                                            PROJECT
                                                                                            ACCESS
                                                                                        </div>

                                                                                        <button
                                                                                            type="button"
                                                                                            className="action-btn"
                                                                                            disabled={
                                                                                                assignmentUpdatingUserId ===
                                                                                                assignment
                                                                                                    .user
                                                                                                    ?.id
                                                                                            }
                                                                                            onClick={() =>
                                                                                                unassignEditorFromProject(
                                                                                                    selectedProject
                                                                                                        .content
                                                                                                        .id,
                                                                                                    assignment
                                                                                                        .user
                                                                                                        .id
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            {assignmentUpdatingUserId ===
                                                                                            assignment
                                                                                                .user
                                                                                                ?.id
                                                                                                ? "REMOVING…"
                                                                                                : "REMOVE"}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>

                                                        <div
                                                            style={{
                                                                marginTop:
                                                                    "22px",
                                                            }}
                                                        >
                                                            <div className="panel-header">
                                                                <h3>
                                                                    AVAILABLE
                                                                    EDITORS
                                                                </h3>

                                                                <span className="graph-tag">
                                                                    {
                                                                        availableEditors.length
                                                                    }{" "}
                                                                    AVAILABLE
                                                                </span>
                                                            </div>

                                                            {!assignmentsLoading &&
                                                                availableEditors.length ===
                                                                    0 && (
                                                                    <p className="text-link">
                                                                        No
                                                                        additional
                                                                        Editors
                                                                        are
                                                                        available
                                                                        to
                                                                        assign.
                                                                    </p>
                                                                )}

                                                            {!assignmentsLoading &&
                                                                availableEditors.length >
                                                                    0 && (
                                                                    <div className="project-list">
                                                                        {availableEditors.map(
                                                                            (
                                                                                editor
                                                                            ) => (
                                                                                <div
                                                                                    className="project-item"
                                                                                    key={
                                                                                        editor.id
                                                                                    }
                                                                                >
                                                                                    <div className="project-info">
                                                                                        <strong>
                                                                                            {editor.name ||
                                                                                                editor.email ||
                                                                                                "Editor"}
                                                                                        </strong>

                                                                                        <small>
                                                                                            {editor.email ||
                                                                                                "No email"}
                                                                                        </small>
                                                                                    </div>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="action-btn active"
                                                                                        disabled={
                                                                                            assignmentUpdatingUserId ===
                                                                                            editor.id
                                                                                        }
                                                                                        onClick={() =>
                                                                                            assignEditorToProject(
                                                                                                selectedProject
                                                                                                    .content
                                                                                                    .id,
                                                                                                editor.id
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        {assignmentUpdatingUserId ===
                                                                                        editor.id
                                                                                            ? "ASSIGNING…"
                                                                                            : "+ ASSIGN PROJECT"}
                                                                                    </button>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                )}

                                            <div
                                                className="panel"
                                                style={{
                                                    marginTop:
                                                        "20px",
                                                }}
                                            >
                                                <div className="panel-header">
                                                    <h3>
                                                        GOOGLE DRIVE
                                                        FOOTAGE FOLDER
                                                    </h3>
                                                </div>

                                                {selectedProject
                                                    .content
                                                    ?.footageLink ? (
                                                    <a
                                                        href={
                                                            selectedProject
                                                                .content
                                                                .footageLink
                                                        }
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-link"
                                                        style={{
                                                            display:
                                                                "block",
                                                            overflowWrap:
                                                                "anywhere",
                                                        }}
                                                    >
                                                        {
                                                            selectedProject
                                                                .content
                                                                .footageLink
                                                        }
                                                    </a>
                                                ) : (
                                                    <p className="text-link">
                                                        No Google
                                                        Drive footage
                                                        folder was
                                                        attached to
                                                        this project.
                                                    </p>
                                                )}
                                            </div>

                                            <section className="panel detail-files">
                                                <div className="panel-header"><div><span className="status-tag">PROJECT FILES</span><h3>Assets &amp; versions</h3></div>
                                                    <button type="button" className="action-btn" onClick={() => { setAssetUploadContentId(selectedProject.content.id); setCurrentView("assets"); }}>Manage / upload files ↗</button>
                                                </div>
                                                <p className="text-link">Upload, replace versions, and manage files in the Asset Vault. Review links below stay bound to their reviewed version.</p>
                                                {(selectedProject.assets || []).length === 0 && <p className="detail-empty">No files have been added to this project.</p>}
                                                {(selectedProject.assets || []).map((asset) => {
                                                    const loadedAsset = assets.find((item) => item.id === asset.id);
                                                    return <div className="detail-file" key={asset.id}>
                                                        <div><strong>{asset.fileName}</strong><small>{asset.assetType} · {formatAssetSize(asset.fileSize)} · {formatRelativeTime(asset.createdAt)}{loadedAsset?.latestVersion ? ` · Latest v${loadedAsset.latestVersion}` : ""}</small></div>
                                                        <div className="detail-file-actions">
                                                            {asset.assetType === "VIDEO" && <a className="asset-action" href={`/api/assets/${encodeURIComponent(asset.id)}/download?mode=inline`} target="_blank" rel="noopener noreferrer">Open / stream</a>}
                                                            <a className="asset-action" href={`/api/assets/${encodeURIComponent(asset.id)}/download?mode=attachment`}>Download</a>
                                                        </div>
                                                        {!!loadedAsset?.versions?.length && <details className="detail-file-versions"><summary>Version history ({loadedAsset.versions.length})</summary>{loadedAsset.versions.map((version) => <div key={version.id || version.version}><span>v{version.version} · {version.fileName} · {formatRelativeTime(version.createdAt)}</span><a className="asset-action" href={`/api/assets/${encodeURIComponent(asset.id)}/download?version=${encodeURIComponent(version.version)}&mode=attachment`}>Download v{version.version}</a></div>)}</details>}
                                                    </div>;
                                                })}
                                            </section>
                                            {isEditor && (
                                                <div
                                                    className="panel"
                                                    style={{
                                                        marginTop:
                                                            "20px",
                                                    }}
                                                >
                                                    <div className="panel-header">
                                                        <div>
                                                            <span className="status-tag">
                                                                PRODUCTION
                                                            </span>

                                                            <h3>
                                                                NEXT ACTION
                                                            </h3>
                                                        </div>
                                                    </div>

                                                    <div
                                                        style={{
                                                            display:
                                                                "flex",
                                                            gap: "10px",
                                                            flexWrap:
                                                                "wrap",
                                                        }}
                                                    >
                                                        {currentProjectStatus ===
                                                            "REQUESTED" && (
                                                            <button
                                                                type="button"
                                                                className="button button-primary"
                                                                disabled={
                                                                    projectStatusUpdating
                                                                }
                                                                onClick={() =>
                                                                    updateProductionStatus(
                                                                        "IN_PRODUCTION"
                                                                    )
                                                                }
                                                            >
                                                                {projectStatusUpdating
                                                                    ? "UPDATING…"
                                                                    : "START PRODUCTION"}
                                                            </button>
                                                        )}

                                                        {currentProjectStatus ===
                                                            "REVISION" && (
                                                            <button
                                                                type="button"
                                                                className="button button-primary"
                                                                disabled={
                                                                    projectStatusUpdating
                                                                }
                                                                onClick={() =>
                                                                    updateProductionStatus(
                                                                        "IN_PRODUCTION"
                                                                    )
                                                                }
                                                            >
                                                                {projectStatusUpdating
                                                                    ? "UPDATING…"
                                                                    : "START REVISION"}
                                                            </button>
                                                        )}

                                                        {currentProjectStatus ===
                                                            "IN_PRODUCTION" && (
                                                            <button
                                                                type="button"
                                                                className="button button-primary"
                                                                disabled={
                                                                    projectStatusUpdating
                                                                }
                                                                onClick={() =>
                                                                    updateProductionStatus(
                                                                        "IN_REVIEW"
                                                                    )
                                                                }
                                                            >
                                                                {projectStatusUpdating
                                                                    ? "SUBMITTING…"
                                                                    : "SUBMIT FOR REVIEW"}
                                                            </button>
                                                        )}

                                                        {currentProjectStatus ===
                                                            "APPROVED" && (
                                                            <p className="text-link">
                                                                Final cut approved. Nexus production is complete.
                                                            </p>
                                                        )}

                                                        {currentProjectStatus ===
                                                            "IN_REVIEW" && (
                                                            <p className="text-link">
                                                                This cut is waiting for a review decision.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {currentProjectStatus ===
                                                "APPROVED" && (
                                                <div
                                                    className="panel review-panel detail-final-delivery"
                                                    style={{
                                                        marginBottom:
                                                            "20px",
                                                    }}
                                                >
                                                    <div className="panel-header review-panel-header">
                                                        <div>
                                                            <span className="status-tag">
                                                                FINAL
                                                                DELIVERY
                                                            </span>

                                                            <h3>
                                                                APPROVED
                                                                FILES
                                                            </h3>
                                                        </div>

                                                        <span className="graph-tag">
                                                            COMPLETE
                                                        </span>
                                                    </div>

                                                    <p className="detail-delivery-complete">Final cut approved. Nexus production is complete.</p>

                                                    {approvedAssetVersion ? (
                                                        <>
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    justifyContent:
                                                                        "flex-end",
                                                                    marginBottom:
                                                                        "12px",
                                                                }}
                                                            >
                                                                <a
                                                                    className="asset-action"
                                                                    href={`/api/projects/${encodeURIComponent(
                                                                        selectedProject.content.id
                                                                    )}/delivery`}
                                                                >
                                                                    DOWNLOAD
                                                                    DELIVERY
                                                                    PACKAGE
                                                                </a>
                                                            </div>

                                                            <div
                                                                className="review-history-card"
                                                                style={{
                                                                    marginBottom:
                                                                        "16px",
                                                                }}
                                                            >
                                                            <div className="review-history-top">
                                                                <strong>
                                                                    APPROVED
                                                                    CUT
                                                                </strong>

                                                                <span className="graph-tag">
                                                                    v{
                                                                        approvedAssetVersion.version
                                                                    }
                                                                </span>
                                                            </div>

                                                            <p
                                                                style={{
                                                                    marginTop:
                                                                        "8px",
                                                                    wordBreak:
                                                                        "break-word",
                                                                }}
                                                            >
                                                                {
                                                                    approvedAssetVersion.fileName
                                                                }
                                                            </p>

                                                            <small
                                                                style={{
                                                                    display:
                                                                        "block",
                                                                    marginTop:
                                                                        "6px",
                                                                }}
                                                            >
                                                                This is
                                                                the exact
                                                                version
                                                                approved
                                                                during
                                                                review.
                                                            </small>

                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    gap:
                                                                        "8px",
                                                                    flexWrap:
                                                                        "wrap",
                                                                    marginTop:
                                                                        "12px",
                                                                }}
                                                            >
                                                                {approvedAssetVersion.assetType ===
                                                                    "VIDEO" && (
                                                                    <a
                                                                        className="asset-action"
                                                                        href={`/api/assets/${encodeURIComponent(
                                                                            approvedAssetVersion.assetId
                                                                        )}/download?version=${encodeURIComponent(
                                                                            approvedAssetVersion.version
                                                                        )}&mode=inline`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        OPEN
                                                                        APPROVED
                                                                        CUT
                                                                    </a>
                                                                )}

                                                                <a
                                                                    className="asset-action"
                                                                    href={`/api/assets/${encodeURIComponent(
                                                                        approvedAssetVersion.assetId
                                                                    )}/download?version=${encodeURIComponent(
                                                                        approvedAssetVersion.version
                                                                    )}&mode=attachment`}
                                                                >
                                                                    DOWNLOAD
                                                                    APPROVED
                                                                    CUT
                                                                </a>
                                                            </div>
                                                        </div>
                                                        </>
                                                    ) : (
                                                        <div
                                                            className="review-history-card detail-approved-project"
                                                            style={{
                                                                marginBottom:
                                                                    "16px",
                                                            }}
                                                        >
                                                            <strong>
                                                                APPROVED
                                                                PROJECT
                                                            </strong>

                                                            <p
                                                                className="text-link"
                                                                style={{
                                                                    marginTop:
                                                                        "8px",
                                                                }}
                                                            >
                                                                This
                                                                project
                                                                was
                                                                approved
                                                                before a
                                                                specific
                                                                asset
                                                                version
                                                                was
                                                                attached
                                                                to the
                                                                review.
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div
                                                        className="review-history-card"
                                                        style={{
                                                            marginBottom:
                                                                "16px",
                                                        }}
                                                    >
                                                        <div className="review-history-top">
                                                            <strong>
                                                                DELIVERY
                                                                HISTORY
                                                            </strong>

                                                            <span className="graph-tag">
                                                                {
                                                                    (
                                                                        selectedProject
                                                                            ?.deliveryHistory ||
                                                                        []
                                                                    ).length
                                                                }{" "}
                                                                DOWNLOAD
                                                                {(
                                                                    selectedProject
                                                                        ?.deliveryHistory ||
                                                                    []
                                                                ).length ===
                                                                1
                                                                    ? ""
                                                                    : "S"}
                                                            </span>
                                                        </div>

                                                        {(
                                                            selectedProject
                                                                ?.deliveryHistory ||
                                                            []
                                                        ).length >
                                                        0 ? (
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "grid",
                                                                    gap:
                                                                        "10px",
                                                                    marginTop:
                                                                        "12px",
                                                                }}
                                                            >
                                                                {(
                                                                    selectedProject
                                                                        ?.deliveryHistory ||
                                                                    []
                                                                ).map(
                                                                    (
                                                                        entry
                                                                    ) => {
                                                                        const metadata =
                                                                            entry.metadata ||
                                                                            {};

                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    entry.id
                                                                                }
                                                                                style={{
                                                                                    padding:
                                                                                        "10px 0",
                                                                                    borderBottom:
                                                                                        "1px solid var(--border)",
                                                                                }}
                                                                            >
                                                                                <strong
                                                                                    style={{
                                                                                        display:
                                                                                            "block",
                                                                                    }}
                                                                                >
                                                                                    {entry
                                                                                        .user
                                                                                        ?.name ||
                                                                                        entry
                                                                                            .user
                                                                                            ?.email ||
                                                                                        "Nexus user"}
                                                                                </strong>

                                                                                <small
                                                                                    style={{
                                                                                        display:
                                                                                            "block",
                                                                                        marginTop:
                                                                                            "4px",
                                                                                    }}
                                                                                >
                                                                                    {new Date(
                                                                                        entry.createdAt
                                                                                    ).toLocaleString()}
                                                                                </small>

                                                                                <small
                                                                                    style={{
                                                                                        display:
                                                                                            "block",
                                                                                        marginTop:
                                                                                            "4px",
                                                                                    }}
                                                                                >
                                                                                    Package:{" "}
                                                                                    {metadata.approvedAssetVersion
                                                                                        ? `v${metadata.approvedAssetVersion}`
                                                                                        : "approved cut"}
                                                                                    {" + "}
                                                                                    {Number(
                                                                                        metadata.supportingFileCount ||
                                                                                            0
                                                                                    )}{" "}
                                                                                    supporting{" "}
                                                                                    {Number(
                                                                                        metadata.supportingFileCount ||
                                                                                            0
                                                                                    ) ===
                                                                                    1
                                                                                        ? "file"
                                                                                        : "files"}
                                                                                </small>
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p
                                                                className="text-link"
                                                                style={{
                                                                    marginTop:
                                                                        "10px",
                                                                }}
                                                            >
                                                                No
                                                                delivery
                                                                package
                                                                downloads
                                                                have
                                                                been
                                                                recorded
                                                                yet.
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div
                                                        className="review-history-card"
                                                    >
                                                        <div className="review-history-top">
                                                            <strong>
                                                                SUPPORTING
                                                                FILES
                                                            </strong>

                                                            <span className="graph-tag">
                                                                {
                                                                    finalDeliveryAssets.length
                                                                }{" "}
                                                                FILE
                                                                {finalDeliveryAssets.length ===
                                                                1
                                                                    ? ""
                                                                    : "S"}
                                                            </span>
                                                        </div>

                                                        {finalDeliveryAssets.length >
                                                        0 ? (
                                                            <div
                                                                style={{
                                                                    display:
                                                                        "grid",
                                                                    gap:
                                                                        "10px",
                                                                    marginTop:
                                                                        "12px",
                                                                }}
                                                            >
                                                                {finalDeliveryAssets.map(
                                                                    (
                                                                        asset
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                asset.id
                                                                            }
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                justifyContent:
                                                                                    "space-between",
                                                                                gap:
                                                                                    "12px",
                                                                                flexWrap:
                                                                                    "wrap",
                                                                                padding:
                                                                                    "10px 0",
                                                                                borderBottom:
                                                                                    "1px solid var(--border)",
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    minWidth:
                                                                                        0,
                                                                                }}
                                                                            >
                                                                                <strong
                                                                                    style={{
                                                                                        display:
                                                                                            "block",
                                                                                        wordBreak:
                                                                                            "break-word",
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        asset.fileName
                                                                                    }
                                                                                </strong>

                                                                                <small>
                                                                                    {asset.assetType ||
                                                                                        "ASSET"}
                                                                                </small>
                                                                            </div>

                                                                            <div
                                                                                style={{
                                                                                    display:
                                                                                        "flex",
                                                                                    gap:
                                                                                        "8px",
                                                                                    flexWrap:
                                                                                        "wrap",
                                                                                }}
                                                                            >
                                                                                {asset.assetType ===
                                                                                    "VIDEO" && (
                                                                                    <a
                                                                                        className="asset-action"
                                                                                        href={`/api/assets/${encodeURIComponent(
                                                                                            asset.id
                                                                                        )}/download?mode=inline`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                    >
                                                                                        OPEN
                                                                                    </a>
                                                                                )}

                                                                                <a
                                                                                    className="asset-action"
                                                                                    href={`/api/assets/${encodeURIComponent(
                                                                                        asset.id
                                                                                    )}/download?mode=attachment`}
                                                                                >
                                                                                    DOWNLOAD
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p
                                                                className="text-link"
                                                                style={{
                                                                    marginTop:
                                                                        "10px",
                                                                }}
                                                            >
                                                                No
                                                                additional
                                                                delivery
                                                                files
                                                                have
                                                                been
                                                                added.
                                                            </p>
                                                        )}

                                                        {finalDeliveryAssets.length >
                                                            1 && (
                                                            <p
                                                                className="text-link"
                                                                style={{
                                                                    marginTop:
                                                                        "12px",
                                                                }}
                                                            >
                                                                Files
                                                                download
                                                                individually
                                                                for now.
                                                                A bundled
                                                                download
                                                                can be
                                                                added
                                                                later.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="panel review-panel">
                                                <div className="panel-header review-panel-header">
                                                    <div>
                                                        <span className="status-tag">
                                                            PROJECT
                                                            REVIEW
                                                        </span>

                                                        <h3>
                                                            REVIEW
                                                            &
                                                            APPROVAL
                                                        </h3>
                                                    </div>

                                                    <span className="graph-tag">
                                                        {selectedProject
                                                            .reviews
                                                            ?.length ||
                                                            0}{" "}
                                                        REVIEW
                                                        {selectedProject
                                                            .reviews
                                                            ?.length ===
                                                            1
                                                            ? ""
                                                            : "S"}
                                                    </span>
                                                </div>

                                                {reviewError && (
                                                    <p className="brief-error-msg active" role="alert">
                                                        {
                                                            reviewError
                                                        }
                                                    </p>
                                                )}

                                                {selectedProject
                                                    .reviews
                                                    ?.length >
                                                0 ? (
                                                    <div className="review-history-list">
                                                        {selectedProject.reviews.map(
                                                            (
                                                                review
                                                            ) => (
                                                                <div
                                                                    key={
                                                                        review.id
                                                                    }
                                                                    className="review-history-card"
                                                                >
                                                                    <div className="review-history-top">
                                                                        <strong>
                                                                            {review.status.replaceAll(
                                                                                "_",
                                                                                " "
                                                                            )}
                                                                        </strong>

                                                                        <small>
                                                                            {new Date(
                                                                                review.createdAt
                                                                            ).toLocaleString()}
                                                                        </small>
                                                                    </div>

                                                                    {review.assetVersion ? (
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                alignItems:
                                                                                    "center",
                                                                                gap:
                                                                                    "10px",
                                                                                flexWrap:
                                                                                    "wrap",
                                                                                marginTop:
                                                                                    "10px",
                                                                            }}
                                                                        >
                                                                            <span className="graph-tag">
                                                                                CUT v{
                                                                                    review
                                                                                        .assetVersion
                                                                                        .version
                                                                                }
                                                                                {" • "}
                                                                                {
                                                                                    review
                                                                                        .assetVersion
                                                                                        .fileName
                                                                                }
                                                                            </span>

                                                                            <a
                                                                                className="asset-action"
                                                                                href={`/api/assets/${encodeURIComponent(
                                                                                    review
                                                                                        .assetVersion
                                                                                        .assetId
                                                                                )}/download?version=${encodeURIComponent(
                                                                                    review
                                                                                        .assetVersion
                                                                                        .version
                                                                                )}&mode=${
                                                                                    review
                                                                                        .assetVersion
                                                                                        .assetType ===
                                                                                    "VIDEO"
                                                                                        ? "inline"
                                                                                        : "attachment"
                                                                                }`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                {review
                                                                                    .assetVersion
                                                                                    .assetType ===
                                                                                "VIDEO"
                                                                                    ? "OPEN CUT"
                                                                                    : "DOWNLOAD VERSION"}
                                                                            </a>
                                                                        </div>
                                                                    ) : (
                                                                        <small
                                                                            style={{
                                                                                display:
                                                                                    "block",
                                                                                marginTop:
                                                                                    "10px",
                                                                            }}
                                                                        >
                                                                            Legacy review • no asset version attached
                                                                        </small>
                                                                    )}

                                                                    {review.notes && (
                                                                        <p
                                                                            style={{
                                                                                marginTop:
                                                                                    "8px",
                                                                            }}
                                                                        >
                                                                            {
                                                                                review.notes
                                                                            }
                                                                        </p>
                                                                    )}

                                                                    <small>
                                                                        Submitted
                                                                        by{" "}
                                                                        {review
                                                                            .author
                                                                            ?.name ||
                                                                            review
                                                                                .author
                                                                                ?.email ||
                                                                            "Unknown user"}
                                                                    </small>

                                                                    {review
                                                                        .comments
                                                                        ?.length >
                                                                        0 && (
                                                                        <div className="review-comments-list">
                                                                            {review.comments.map(
                                                                                (
                                                                                    comment
                                                                                ) => {
                                                                                    const canEditOrDeleteComment =
                                                                                        comment
                                                                                            .author
                                                                                            ?.id ===
                                                                                            user
                                                                                                ?.id ||
                                                                                        canManageAnyReviewComment;

                                                                                    const isEditingComment =
                                                                                        reviewCommentEditingId ===
                                                                                        comment.id;

                                                                                    return (
                                                                                        <div
                                                                                            key={
                                                                                                comment.id
                                                                                            }
                                                                                            className={`review-comment-card ${comment.resolvedAt ? "is-resolved" : "is-unresolved"}`}
                                                                                            style={{
                                                                                                opacity:
                                                                                                    comment.resolved
                                                                                                        ? 0.72
                                                                                                        : 1,
                                                                                            }}
                                                                                        >
                                                                                            <div className="review-comment-top">
                                                                                                <span className="graph-tag">{comment.resolvedAt ? "Resolved" : "Unresolved"}</span>
                                                                                                <strong>
                                                                                                    {comment
                                                                                                        .author
                                                                                                        ?.name ||
                                                                                                        comment
                                                                                                            .author
                                                                                                            ?.email ||
                                                                                                        "Unknown user"}
                                                                                                </strong>

                                                                                                <small>
                                                                                                    {comment.timestamp !==
                                                                                                        null &&
                                                                                                    comment.timestamp !==
                                                                                                        undefined
                                                                                                        ? `${formatReviewTimestamp(
                                                                                                              comment.timestamp
                                                                                                          )} • `
                                                                                                        : ""}
                                                                                                    {new Date(
                                                                                                        comment.createdAt
                                                                                                    ).toLocaleString()}
                                                                                                </small>
                                                                                            </div>

                                                                                            {isEditingComment ? (
                                                                                                <div
                                                                                                    style={{
                                                                                                        marginTop:
                                                                                                            "8px",
                                                                                                        display:
                                                                                                            "grid",
                                                                                                        gap:
                                                                                                            "8px",
                                                                                                    }}
                                                                                                >
                                                                                                    <textarea
                                                                                                        className="dash-input"
                                                                                                        rows={3}
                                                                                                        value={
                                                                                                            reviewCommentEditDraft.comment
                                                                                                        }
                                                                                                        onChange={(
                                                                                                            event
                                                                                                        ) =>
                                                                                                            setReviewCommentEditDraft(
                                                                                                                (
                                                                                                                    current
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    comment:
                                                                                                                        event
                                                                                                                            .target
                                                                                                                            .value,
                                                                                                                })
                                                                                                            )
                                                                                                        }
                                                                                                    />

                                                                                                    <input
                                                                                                        className="dash-input"
                                                                                                        type="text"
                                                                                                        placeholder="Timestamp, e.g. 1:23"
                                                                                                        value={
                                                                                                            reviewCommentEditDraft.timestamp
                                                                                                        }
                                                                                                        onChange={(
                                                                                                            event
                                                                                                        ) =>
                                                                                                            setReviewCommentEditDraft(
                                                                                                                (
                                                                                                                    current
                                                                                                                ) => ({
                                                                                                                    ...current,
                                                                                                                    timestamp:
                                                                                                                        event
                                                                                                                            .target
                                                                                                                            .value,
                                                                                                                })
                                                                                                            )
                                                                                                        }
                                                                                                    />

                                                                                                    <div
                                                                                                        style={{
                                                                                                            display:
                                                                                                                "flex",
                                                                                                            gap:
                                                                                                                "8px",
                                                                                                            flexWrap:
                                                                                                                "wrap",
                                                                                                        }}
                                                                                                    >
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="asset-action"
                                                                                                            disabled={
                                                                                                                reviewCommentUpdatingId ===
                                                                                                                comment.id
                                                                                                            }
                                                                                                            onClick={() =>
                                                                                                                updateReviewComment(
                                                                                                                    review.id,
                                                                                                                    comment.id
                                                                                                                )
                                                                                                            }
                                                                                                        >
                                                                                                            {reviewCommentUpdatingId ===
                                                                                                            comment.id
                                                                                                                ? "SAVING…"
                                                                                                                : "SAVE"}
                                                                                                        </button>

                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="asset-action"
                                                                                                            onClick={
                                                                                                                cancelEditingReviewComment
                                                                                                            }
                                                                                                        >
                                                                                                            CANCEL
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <p
                                                                                                    style={{
                                                                                                        marginTop:
                                                                                                            "6px",
                                                                                                        textDecoration:
                                                                                                            comment.resolved
                                                                                                                ? "line-through"
                                                                                                                : "none",
                                                                                                    }}
                                                                                                >
                                                                                                    {
                                                                                                        comment.comment
                                                                                                    }
                                                                                                </p>
                                                                                            )}

                                                                                            {comment.resolved && (
                                                                                                <small
                                                                                                    style={{
                                                                                                        display:
                                                                                                            "block",
                                                                                                        marginTop:
                                                                                                            "8px",
                                                                                                    }}
                                                                                                >
                                                                                                    RESOLVED
                                                                                                    {comment
                                                                                                        .resolvedBy
                                                                                                        ? ` by ${
                                                                                                              comment
                                                                                                                  .resolvedBy
                                                                                                                  .name ||
                                                                                                              comment
                                                                                                                  .resolvedBy
                                                                                                                  .email ||
                                                                                                              "Nexus user"
                                                                                                          }`
                                                                                                        : ""}
                                                                                                </small>
                                                                                            )}

                                                                                            {!isEditingComment && (
                                                                                                <div
                                                                                                    style={{
                                                                                                        display:
                                                                                                            "flex",
                                                                                                        gap:
                                                                                                            "8px",
                                                                                                        flexWrap:
                                                                                                            "wrap",
                                                                                                        marginTop:
                                                                                                            "10px",
                                                                                                    }}
                                                                                                >
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="asset-action"
                                                                                                        disabled={
                                                                                                            reviewCommentUpdatingId ===
                                                                                                            comment.id
                                                                                                        }
                                                                                                        onClick={() =>
                                                                                                            setReviewCommentResolved(
                                                                                                                review.id,
                                                                                                                comment.id,
                                                                                                                !comment.resolved
                                                                                                            )
                                                                                                        }
                                                                                                    >
                                                                                                        {comment.resolved
                                                                                                            ? "REOPEN"
                                                                                                            : "RESOLVE"}
                                                                                                    </button>

                                                                                                    {canEditOrDeleteComment && (
                                                                                                        <>
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                className="asset-action"
                                                                                                                onClick={() =>
                                                                                                                    startEditingReviewComment(
                                                                                                                        comment
                                                                                                                    )
                                                                                                                }
                                                                                                            >
                                                                                                                EDIT
                                                                                                            </button>

                                                                                                            <button
                                                                                                                type="button"
                                                                                                                className="asset-action"
                                                                                                                disabled={
                                                                                                                    reviewCommentDeletingId ===
                                                                                                                    comment.id
                                                                                                                }
                                                                                                                onClick={() =>
                                                                                                                    deleteReviewComment(
                                                                                                                        review.id,
                                                                                                                        comment.id
                                                                                                                    )
                                                                                                                }
                                                                                                            >
                                                                                                                {reviewCommentDeletingId ===
                                                                                                                comment.id
                                                                                                                    ? "DELETING…"
                                                                                                                    : "DELETE"}
                                                                                                            </button>
                                                                                                        </>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p
                                                        className="text-link"
                                                        style={{
                                                            marginBottom:
                                                                "20px",
                                                        }}
                                                    >
                                                        No review
                                                        cycle has
                                                        started yet.
                                                    </p>
                                                )}

                                                {pendingReview && (
                                                    <div
                                                        className="review-history-card"
                                                        style={{
                                                            marginBottom:
                                                                "16px",
                                                        }}
                                                    >
                                                        <div className="review-history-top"><strong>Current review</strong><span className="status-pill">{pendingReview.status.replaceAll("_", " ")}</span></div>
                                                        <dl className="detail-review-meta"><div><dt>Reviewed version</dt><dd>{pendingReview.assetVersion ? `Version ${pendingReview.assetVersion.version}` : "Legacy review - no asset version attached"}</dd></div><div><dt>Submitted by</dt><dd>{pendingReview.author?.name || pendingReview.author?.email || "Unknown user"}</dd></div><div><dt>Submitted time</dt><dd>{new Date(pendingReview.createdAt).toLocaleString()}</dd></div></dl>
                                                        {pendingReview.assetVersion && <>
                                                        <p
                                                            style={{
                                                                marginTop:
                                                                    "8px",
                                                            }}
                                                        >
                                                            {
                                                                pendingReview
                                                                    .assetVersion
                                                                    .fileName
                                                            }
                                                        </p>

                                                        <a
                                                            className="asset-action"
                                                            href={`/api/assets/${encodeURIComponent(
                                                                pendingReview
                                                                    .assetVersion
                                                                    .assetId
                                                            )}/download?version=${encodeURIComponent(
                                                                pendingReview
                                                                    .assetVersion
                                                                    .version
                                                            )}&mode=${
                                                                pendingReview
                                                                    .assetVersion
                                                                    .assetType ===
                                                                "VIDEO"
                                                                    ? "inline"
                                                                    : "attachment"
                                                            }`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display:
                                                                    "inline-block",
                                                                marginTop:
                                                                    "8px",
                                                            }}
                                                        >
                                                            {pendingReview
                                                                .assetVersion
                                                                .assetType ===
                                                            "VIDEO"
                                                                ? "OPEN REVIEW CUT"
                                                                : "DOWNLOAD REVIEW VERSION"}
                                                        </a>
                                                        </>}
                                                    </div>
                                                )}

                                                {pendingReview && (
                                                    <form
                                                        onSubmit={(
                                                            event
                                                        ) =>
                                                            submitReviewComment(
                                                                event,
                                                                pendingReview.id
                                                            )
                                                        }
                                                        className="review-comment-form"
                                                    >
                                                        <div className="form-field review-comment-main">
                                                            <label htmlFor="reviewComment">
                                                                REVIEW
                                                                COMMENT
                                                                {pendingReview
                                                                    ?.assetVersion
                                                                    ? ` • v${pendingReview.assetVersion.version}`
                                                                    : ""}
                                                            </label>

                                                            <textarea
                                                                id="reviewComment"
                                                                className="dash-input"
                                                                value={
                                                                    reviewComment
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    setReviewComment(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="Add feedback, a question, or a note about the current cut..."
                                                                rows={
                                                                    4
                                                                }
                                                            />
                                                        </div>

                                                        <div className="form-field review-timestamp-field">
                                                            <label htmlFor="reviewTimestamp">
                                                                TIMESTAMP
                                                                (OPTIONAL)
                                                            </label>

                                                            <input
                                                                id="reviewTimestamp"
                                                                type="text"
                                                                className="dash-input"
                                                                value={
                                                                    reviewTimestamp
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    setReviewTimestamp(
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder="1:23 or 01:23:45"
                                                            />
                                                        </div>

                                                        <div className="review-comment-submit">
                                                            <button
                                                                type="submit"
                                                                className="button button-primary"
                                                                disabled={
                                                                    reviewCommentSubmitting ||
                                                                    !reviewComment.trim()
                                                                }
                                                            >
                                                                {reviewCommentSubmitting
                                                                    ? "ADDING…"
                                                                    : "ADD COMMENT"}
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}

                                                {pendingReview &&
                                                    canMakeReviewDecision && (
                                                        <div className="review-decision-card">
                                                            <div className="form-field">
                                                                <label htmlFor="reviewNote">
                                                                    DECISION
                                                                    NOTES
                                                                </label>

                                                                <textarea
                                                                    id="reviewNote"
                                                                    className="dash-input"
                                                                    value={
                                                                        reviewNote
                                                                    }
                                                                    onChange={(
                                                                        event
                                                                    ) =>
                                                                        setReviewNote(
                                                                            event
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    placeholder="Optional for approval. Required when requesting a revision."
                                                                    rows={
                                                                        4
                                                                    }
                                                                />
                                                            </div>

                                                            <div className="review-decision-actions">
                                                                <button
                                                                    type="button"
                                                                    className="button button-primary"
                                                                    disabled={
                                                                        projectStatusUpdating
                                                                    }
                                                                    onClick={() =>
                                                                        submitReviewDecision(
                                                                            pendingReview.id,
                                                                            "APPROVE"
                                                                        )
                                                                    }
                                                                >
                                                                    {projectStatusUpdating
                                                                        ? "UPDATING…"
                                                                        : "✓ Approve Cut"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="action-btn detail-revision-action"
                                                                    disabled={
                                                                        projectStatusUpdating ||
                                                                        !reviewNote.trim()
                                                                    }
                                                                    onClick={() =>
                                                                        submitReviewDecision(
                                                                            pendingReview.id,
                                                                            "REQUEST_REVISION"
                                                                        )
                                                                    }
                                                                >
                                                                    ↻ Request Revision
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                {pendingReview &&
                                                    isEditor &&
                                                    !canManageAssignments && (
                                                        <p
                                                            className="text-link"
                                                            style={{
                                                                marginTop:
                                                                    "16px",
                                                            }}
                                                        >
                                                            You can
                                                            add review
                                                            comments,
                                                            but the
                                                            Creator,
                                                            Admin, or
                                                            Manager
                                                            makes the
                                                            approval
                                                            decision.
                                                        </p>
                                                    )}

                                                {!pendingReview && (
                                                    <p
                                                        className="text-link"
                                                        style={{
                                                            marginTop:
                                                                "16px",
                                                        }}
                                                    >
                                                        {currentProjectStatus ===
                                                        "IN_REVIEW"
                                                            ? "The review is loading or has already been resolved."
                                                            : "There is no active review awaiting a decision."}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`view-panel assets-view ${currentView === "assets"
                            ? "active"
                            : ""
                            }`}
                    >
                        <dialog ref={assetDeleteDialogRef} className="vault-delete-dialog" aria-labelledby="vault-delete-title" aria-describedby="vault-delete-description" onCancel={() => { if (assetDeleteDialogRef.current) assetDeleteDialogRef.current.returnValue = "cancel"; }} onClose={() => {
                            assetDeleteResolveRef.current?.(assetDeleteDialogRef.current?.returnValue === "delete");
                            assetDeleteResolveRef.current = null;
                            setAssetDeletePrompt(null);
                        }}>
                            <h2 id="vault-delete-title">Delete asset?</h2>
                            <p id="vault-delete-description">Delete <strong>{assetDeletePrompt?.fileName}</strong>? This permanently removes this asset and all its versions from storage and Nexus.</p>
                            <form method="dialog"><button className="asset-action" value="cancel" autoFocus>Cancel</button><button className="asset-action vault-delete" value="delete">Delete asset</button></form>
                        </dialog>
                        <div className="panel-scroll-container">
                            <div className="panel asset-vault-panel">
                                <header className="asset-vault-header">
                                    <div><h1 className="page-title">Assets</h1><p>Manage project deliverables, revisions, and supporting files.</p></div>
                                    <button type="button" className="asset-action vault-primary" disabled={assetUploading || !projects.length} onClick={() => document.getElementById("assetUploadProject")?.focus()}>+ Upload Asset</button>
                                </header>
                                <p className="vault-summary-caption">{assetSearch.trim() ? "Summary of matching assets" : "Summary of loaded assets"}</p>
                                <div className="vault-summary" aria-label="Asset summary">
                                    {[
                                        ["Assets", assets.length],
                                        ["Video", assets.filter((asset) => asset.assetType === "VIDEO").length],
                                        ["Images", assets.filter((asset) => asset.assetType === "IMAGE").length],
                                        ["Audio", assets.filter((asset) => asset.assetType === "AUDIO").length],
                                        ["Documents / Other", assets.filter((asset) => !["VIDEO", "IMAGE", "AUDIO"].includes(asset.assetType)).length],
                                        ["Projects with assets", new Set(assets.map((asset) => asset.contentId).filter(Boolean)).size],
                                    ].map(([label, count]) => <div className="vault-summary-item" key={label}><span>{label}</span><strong>{assetsLoading || assetsError ? "—" : count}</strong></div>)}
                                </div>
                                <div className="asset-vault-surface">
                                    <form
                                        onSubmit={uploadAsset}
                                        className="asset-upload-card"
                                    >
                                    <div className="asset-upload-card-header">
                                        <div>
                                            <span className="asset-upload-kicker">
                                                NEW FILE
                                            </span>
                                            <strong>
                                                Upload a new asset
                                            </strong>
                                        </div>

                                        <span className="asset-upload-limit">
                                            Up to 5 GiB
                                        </span>
                                    </div>

                                    <div className="asset-upload-grid">
                                        <div className="form-field">
                                            <label htmlFor="assetUploadProject">
                                                PROJECT
                                            </label>

                                            <select
                                                id="assetUploadProject"
                                                className="dash-input"
                                                value={
                                                    assetUploadContentId
                                                }
                                                onChange={(e) =>
                                                    setAssetUploadContentId(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    assetUploading ||
                                                    projects.length ===
                                                        0
                                                }
                                                required
                                            >
                                                {projects.length ===
                                                0 ? (
                                                    <option value="">
                                                        NO ACCESSIBLE
                                                        PROJECTS
                                                    </option>
                                                ) : (
                                                    projects.map(
                                                        (
                                                            project
                                                        ) => (
                                                            <option
                                                                key={
                                                                    project.id
                                                                }
                                                                value={
                                                                    project.id
                                                                }
                                                            >
                                                                {
                                                                    project.title
                                                                }
                                                            </option>
                                                        )
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        <div className="form-field asset-file-field">
                                            <label htmlFor="assetUploadFile">
                                                FILE
                                            </label>

                                            <input
                                                id="assetUploadFile"
                                                type="file"
                                                className="dash-input asset-file-input"
                                                onChange={
                                                    handleAssetFileChange
                                                }
                                                disabled={
                                                    assetUploading
                                                }
                                                required
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label htmlFor="assetUploadType">
                                                TYPE
                                            </label>

                                            <select
                                                id="assetUploadType"
                                                className="dash-input"
                                                value={
                                                    assetUploadType
                                                }
                                                onChange={(e) =>
                                                    setAssetUploadType(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    assetUploading
                                                }
                                            >
                                                <option value="VIDEO">
                                                    VIDEO
                                                </option>
                                                <option value="IMAGE">
                                                    IMAGE
                                                </option>
                                                <option value="AUDIO">
                                                    AUDIO
                                                </option>
                                                <option value="DOCUMENT">
                                                    DOCUMENT
                                                </option>
                                                <option value="OTHER">
                                                    OTHER
                                                </option>
                                            </select>
                                        </div>

                                        <button
                                            type="submit"
                                            className="button button-primary asset-upload-button"
                                            disabled={
                                                assetUploading ||
                                                !assetUploadFile ||
                                                !assetUploadContentId
                                            }
                                        >
                                            {assetUploading
                                                ? `UPLOADING ${assetUploadProgress}%`
                                                : "UPLOAD ASSET ↗"}
                                        </button>
                                    </div>

                                    {(assetUploading ||
                                        assetUploadProgress >
                                            0) && (
                                        <div className="asset-upload-progress">
                                            <div
                                                className="asset-upload-progress-fill"
                                                style={{
                                                    width: `${assetUploadProgress}%`,
                                                }}
                                            />
                                        </div>
                                    )}

                                    {assetUploadError && (
                                        <p className="brief-error-msg active asset-upload-error" role="alert">
                                            {
                                                assetUploadError
                                            }
                                        </p>
                                    )}

                                    <div className="asset-upload-footer">
                                        <span>
                                            Create a separate asset for this project.
                                        </span>

                                        <span>
                                            To revise an existing file, use its New Version action.
                                        </span>
                                    </div>
                                </form>

                                    {assetVersionError && (
                                        <p className="brief-error-msg active asset-upload-error" role="alert">
                                            {assetVersionError}
                                        </p>
                                    )}

                                    <div className="vault-toolbar">
                                        <label className="vault-search"><span>Search assets</span><input type="search" className="dash-input asset-search-input" placeholder="Search filenames..." value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} /></label>
                                        {assetSearch && <button type="button" className="asset-action" onClick={() => setAssetSearch("")}>Clear search</button>}
                                        <span className="vault-result-count" role="status">{assetsLoading ? "Loading assets..." : assetsError ? "Assets unavailable" : `${assets.length} ${assets.length === 1 ? "asset" : "assets"}${assetSearch.trim() ? " found" : " loaded"}`}</span>
                                    </div>
                                    <div className="asset-grid">
                                    {assetsLoading ? (
                                        <div className="asset-state-card vault-loading" role="status">
                                            <div className="vault-skeleton" aria-hidden="true"><span /><span /><span /></div>
                                            <strong>
                                                Loading your assets...
                                            </strong>
                                        </div>
                                    ) : assetsError ? (
                                        <div className="asset-state-card asset-state-error" role="alert">
                                            <p>
                                                {
                                                    assetsError
                                                }
                                            </p>

                                            <button
                                                type="button"
                                                className="action-btn active asset-state-action"
                                                onClick={() =>
                                                    loadAssets(
                                                        activeOrganizationId
                                                    )
                                                }
                                            >
                                                RETRY
                                            </button>
                                        </div>
                                    ) : assets.length ===
                                      0 ? (
                                        <div className="asset-empty-state">
                                            <div className="asset-empty-icon" aria-hidden="true">&#9633;</div>

                                            <div>
                                                <strong>
                                                    {assetSearch.trim()
                                                        ? "No matching assets"
                                                        : "Your asset vault is ready"}
                                                </strong>

                                                <p>
                                                    {assetSearch.trim()
                                                        ? "Try another file name or clear the search."
                                                        : "Upload a finished deliverable, thumbnail, document, audio file, or other supporting asset."}
                                                </p>
                                                {assetSearch.trim() ? <button type="button" className="asset-action" onClick={() => setAssetSearch("")}>Clear search</button> : <button type="button" className="asset-action vault-primary" disabled={assetUploading || !projects.length} onClick={() => document.getElementById("assetUploadProject")?.focus()}>+ Upload Asset</button>}
                                            </div>
                                        </div>
                                    ) : (
                                        assets.map(
                                            (asset) => {
                                                const versions =
                                                    asset.versions ||
                                                    [];
                                                const latestVersion =
                                                    Number(
                                                        asset.latestVersion ||
                                                            versions[0]?.version ||
                                                            1
                                                    );
                                                const versionInputId =
                                                    `asset-version-${asset.id}`;

                                                return (
                                                    <div
                                                        className="asset-card"
                                                        key={asset.id}
                                                        style={{
                                                            alignItems:
                                                                "flex-start",
                                                        }}
                                                    >
                                                        <div className={`asset-icon vault-type-${String(asset.assetType).toLowerCase()}`} aria-hidden="true">
                                                            {({ VIDEO: "VID", IMAGE: "IMG", AUDIO: "AUD", DOCUMENT: "DOC" })[asset.assetType] || "FILE"}
                                                        </div>

                                                        <div
                                                            className="asset-details"
                                                            style={{
                                                                minWidth: 0,
                                                                flex: 1,
                                                            }}
                                                        >
                                                            <strong>
                                                                {asset.fileName}
                                                            </strong>

                                                            <small>
                                                                {assetMeta(
                                                                    asset
                                                                )}
                                                            </small>

                                                            <dl className="vault-asset-meta">
                                                                <div><dt>Project</dt><dd>{asset.content?.title || asset.project?.name || "Project unavailable"}</dd></div>
                                                                <div><dt>Uploaded by</dt><dd>{asset.uploadedBy?.name || asset.uploadedBy?.email || (asset.uploadedById === user?.id ? (user?.name || user?.email || "You") : "Name unavailable")}</dd></div>
                                                                <div><dt>Latest version</dt><dd><span className="vault-version-badge">v{latestVersion}</span></dd></div>
                                                                <div><dt>Updated</dt><dd>{asset.updatedAt || asset.createdAt ? new Date(asset.updatedAt || asset.createdAt).toLocaleString() : "Date unavailable"}</dd></div>
                                                            </dl>
                                                            {expandedAssetVersions[
                                                                asset.id
                                                            ] && (
                                                                <div id={`vault-versions-${asset.id}`} className="vault-version-history"
                                                                    style={{
                                                                        marginTop:
                                                                            "12px",
                                                                        display:
                                                                            "grid",
                                                                        gap:
                                                                            "8px",
                                                                    }}
                                                                >
                                                                    <h4>Version history</h4>
                                                                    {!versions.length && <p className="vault-muted">No historical versions available.</p>}
                                                                    {versions.map(
                                                                        (version) => (
                                                                            <div className="vault-version-row"
                                                                                key={
                                                                                    version.id ||
                                                                                    `${asset.id}-${version.version}`
                                                                                }
                                                                                style={{
                                                                                    display:
                                                                                        "flex",
                                                                                    alignItems:
                                                                                        "center",
                                                                                    justifyContent:
                                                                                        "space-between",
                                                                                    gap:
                                                                                        "10px",
                                                                                    padding:
                                                                                        "9px 10px",
                                                                                    border:
                                                                                        "1px solid var(--line)",
                                                                                    borderRadius:
                                                                                        "6px",
                                                                                    flexWrap:
                                                                                        "wrap",
                                                                                }}
                                                                            >
                                                                                <div>
                                                                                    <strong
                                                                                        style={{
                                                                                            fontSize:
                                                                                                "12px",
                                                                                        }}
                                                                                    >
                                                                                        v{
                                                                                            version.version
                                                                                        }
                                                                                        {version.version ===
                                                                                        latestVersion
                                                                                            ? " • LATEST"
                                                                                            : ""}
                                                                                    </strong>
                                                                                    <small
                                                                                        style={{
                                                                                            display:
                                                                                                "block",
                                                                                            marginTop:
                                                                                                "3px",
                                                                                        }}
                                                                                    >
                                                                                        {
                                                                                            version.fileName
                                                                                        }{" "}
                                                                                        •{" "}
                                                                                        {formatAssetSize(
                                                                                            version.fileSize
                                                                                        )}
                                                                                    </small>
                                                                                    <small className="vault-version-date">Uploaded {version.createdAt ? new Date(version.createdAt).toLocaleString() : "date unavailable"}{version.uploadedBy?.name || version.uploadedBy?.email ? ` by ${version.uploadedBy.name || version.uploadedBy.email}` : ""}</small>
                                                                                </div>

                                                                                <a
                                                                                    className="asset-action"
                                                                                    href={`/api/assets/${encodeURIComponent(
                                                                                        asset.id
                                                                                    )}/download?version=${encodeURIComponent(
                                                                                        version.version
                                                                                    )}&mode=${
                                                                                        asset.assetType ===
                                                                                        "VIDEO"
                                                                                            ? "inline"
                                                                                            : "attachment"
                                                                                    }`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                >
                                                                                    {asset.assetType ===
                                                                                    "VIDEO"
                                                                                        ? "Stream"
                                                                                        : "Download"}
                                                                                </a>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="vault-asset-actions"
                                                            style={{
                                                                display:
                                                                    "flex",
                                                                gap: "6px",
                                                                flexWrap:
                                                                    "wrap",
                                                                justifyContent:
                                                                    "flex-end",
                                                            }}
                                                        >
                                                            <a
                                                                className="asset-action"
                                                                href={`/api/assets/${encodeURIComponent(
                                                                    asset.id
                                                                )}/download?mode=${
                                                                    asset.assetType ===
                                                                    "VIDEO"
                                                                        ? "inline"
                                                                        : "attachment"
                                                                }`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                {asset.assetType ===
                                                                "VIDEO"
                                                                    ? "Stream latest"
                                                                    : "Download latest"}
                                                            </a>

                                                            <button
                                                                type="button"
                                                                className="asset-action" aria-expanded={Boolean(expandedAssetVersions[asset.id])} aria-controls={`vault-versions-${asset.id}`}
                                                                onClick={() =>
                                                                    toggleAssetVersions(
                                                                        asset.id
                                                                    )
                                                                }
                                                            >
                                                                {expandedAssetVersions[
                                                                    asset.id
                                                                ]
                                                                    ? "Hide versions"
                                                                    : `Version history (${versions.length})`}
                                                            </button>

                                                            <input
                                                                id={versionInputId}
                                                                type="file"
                                                                style={{
                                                                    display:
                                                                        "none",
                                                                }}
                                                                disabled={
                                                                    assetVersionUploadingId !==
                                                                    null
                                                                }
                                                                onChange={(event) =>
                                                                    uploadAssetVersion(
                                                                        asset,
                                                                        event
                                                                    )
                                                                }
                                                            />

                                                            <button type="button" className="asset-action vault-new-version" title="Upload a new revision of this asset" disabled={assetVersionUploadingId !== null} onClick={() => document.getElementById(versionInputId)?.click()}
                                                                style={{
                                                                    cursor:
                                                                        assetVersionUploadingId !==
                                                                        null
                                                                            ? "not-allowed"
                                                                            : "pointer",
                                                                    opacity:
                                                                        assetVersionUploadingId !==
                                                                        null
                                                                            ? 0.55
                                                                            : 1,
                                                                }}
                                                            >
                                                                {assetVersionUploadingId ===
                                                                asset.id
                                                                    ? `UPLOADING ${assetVersionUploadProgress}%`
                                                                    : "New Version"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="asset-action vault-delete"
                                                                disabled={
                                                                    assetDeletingId ===
                                                                    asset.id
                                                                }
                                                                onClick={() =>
                                                                    deleteAsset(
                                                                        asset
                                                                    )
                                                                }
                                                            >
                                                                {assetDeletingId ===
                                                                asset.id
                                                                    ? "DELETING…"
                                                                    : "Delete"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        )
                                    )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`view-panel ${
                            currentView === "analytics" ? "active" : ""
                        }`}
                    >
                        <div className="analytics-scroll-container">
                            <div className="analytics-platform-bar">
                                <div className="analytics-platform-heading">
                                    <span className="status-tag">ANALYTICS</span>
                                    <strong>CREATOR PERFORMANCE</strong>
                                </div>

                                <div className="analytics-platform-tabs">
                                    <button type="button" className="analytics-platform-tab active">
                                        YOUTUBE
                                    </button>
                                    <button type="button" className="analytics-platform-tab" disabled>
                                        TIKTOK <small>SOON</small>
                                    </button>
                                    <button type="button" className="analytics-platform-tab" disabled>
                                        INSTAGRAM <small>SOON</small>
                                    </button>
                                    <button type="button" className="analytics-platform-tab" disabled>
                                        TWITCH <small>SOON</small>
                                    </button>
                                </div>
                            </div>

                            <div className="analytics-connect-card">
                                <div className="analytics-connect-copy">
                                    <div className="analytics-platform-mark">YT</div>

                                    <div>
                                        <span className="analytics-kicker">YOUTUBE ANALYTICS</span>
                                        <h3>CONNECT YOUR YOUTUBE CHANNEL</h3>
                                        <p>
                                            Connect a creator channel to bring channel growth,
                                            watch time, reach and video performance into Nexus.
                                        </p>
                                    </div>
                                </div>

                                <div className="analytics-connect-actions">
                                    <span className="analytics-connection-status">NOT CONNECTED</span>
                                    <button
                                        type="button"
                                        className="button button-primary"
                                        disabled
                                        title="YouTube account connection is the next integration step."
                                    >
                                        CONNECT YOUTUBE
                                    </button>
                                    <small>OAuth connection will be enabled in the next step.</small>
                                </div>
                            </div>

                            <div className="analytics-metric-grid">
                                <div className="analytics-metric-card">
                                    <span>TOTAL VIEWS</span>
                                    <strong>—</strong>
                                    <small>Connect YouTube to load data</small>
                                </div>
                                <div className="analytics-metric-card">
                                    <span>WATCH TIME</span>
                                    <strong>—</strong>
                                    <small>Hours watched</small>
                                </div>
                                <div className="analytics-metric-card">
                                    <span>SUBSCRIBERS</span>
                                    <strong>—</strong>
                                    <small>Channel audience</small>
                                </div>
                                <div className="analytics-metric-card">
                                    <span>IMPRESSIONS CTR</span>
                                    <strong>—</strong>
                                    <small>Thumbnail click-through rate</small>
                                </div>
                            </div>

                            <div className="analytics-layout">
                                <div className="panel analytics-data-panel">
                                    <div className="panel-header">
                                        <div>
                                            <span className="analytics-kicker">CHANNEL TREND</span>
                                            <h3>PERFORMANCE OVER TIME</h3>
                                        </div>
                                        <span className="analytics-period">LAST 28 DAYS</span>
                                    </div>

                                    <div className="analytics-chart-empty">
                                        <div className="analytics-chart-grid">
                                            <span />
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                        <div className="analytics-empty-icon">◫</div>
                                        <strong>CHANNEL DATA WILL APPEAR HERE</strong>
                                        <p>
                                            Once YouTube is connected, Nexus will display performance
                                            trends without using sample metrics.
                                        </p>
                                    </div>
                                </div>

                                <div className="panel analytics-data-panel">
                                    <div className="panel-header">
                                        <div>
                                            <span className="analytics-kicker">CONTENT</span>
                                            <h3>TOP VIDEOS</h3>
                                        </div>
                                    </div>

                                    <div className="analytics-video-list">
                                        {[1, 2, 3, 4].map((item) => (
                                            <div className="analytics-video-placeholder" key={item}>
                                                <div className="analytics-video-thumb" />
                                                <div className="analytics-video-meta">
                                                    <span>VIDEO PERFORMANCE</span>
                                                    <strong>Waiting for YouTube data</strong>
                                                </div>
                                                <span className="analytics-video-value">—</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="analytics-roadmap">
                                <div>
                                    <span className="analytics-kicker">INTEGRATION ROADMAP</span>
                                    <h3>PLATFORM CONNECTIONS</h3>
                                </div>

                                <div className="analytics-roadmap-items">
                                    {[
                                        ["01", "YOUTUBE", "NEXT TO CONNECT", true],
                                        ["02", "TIKTOK", "PLANNED", false],
                                        ["03", "INSTAGRAM", "PLANNED", false],
                                        ["04", "TWITCH", "PLANNED", false],
                                    ].map(([number, platform, state, current]) => (
                                        <div
                                            className={`analytics-roadmap-item ${
                                                current ? "current" : ""
                                            }`}
                                            key={platform}
                                        >
                                            <span>{number}</span>
                                            <div>
                                                <strong>{platform}</strong>
                                                <small>{state}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`view-panel settings-view ${currentView ===
                            "settings"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel settings-panel">
                                <div className="panel-header settings-page-header">
                                    <div>
                                        <h1 className="page-title">Settings</h1><p className="settings-subtitle">Manage your account, workspace, security, and appearance.</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="action-btn settings-refresh"
                                        onClick={() =>
                                            loadSettings()
                                        }
                                        disabled={
                                            settingsLoading
                                        }
                                    >
                                        {settingsLoading
                                            ? "LOADING…"
                                            : "REFRESH ↻"}
                                    </button>
                                </div>

                                {settingsError && (
                                    <p className="brief-error-msg active settings-feedback settings-feedback-error" role="alert">
                                        {settingsError}
                                    </p>
                                )}

                                {settingsSuccess && (
                                    <div className="settings-feedback settings-feedback-success" role="status"
                                        style={{
                                            marginBottom:
                                                "16px",
                                            padding:
                                                "12px 14px",
                                            border:
                                                "1px solid var(--accent)",
                                            borderRadius:
                                                "8px",
                                        }}
                                    >
                                        <strong>
                                            {
                                                settingsSuccess
                                            }
                                        </strong>
                                    </div>
                                )}

                                {settingsLoading ? (
                                    <div className="settings-loading" role="status"><div className="settings-skeleton" aria-hidden="true"><span /><span /><span /></div><p>Loading account settings...</p></div>
                                ) : (
                                    <div className="settings-grid">
<div className="settings-column">
                                        <form
                                            className="settings-form settings-card"
                                            onSubmit={
                                                saveProfileSettings
                                            }
                                        >
                                            <div
                                                style={{
                                                    marginBottom:
                                                        "16px",
                                                }}
                                            >
                                                <h2>Account</h2>
                                                <p
                                                    className="text-link"
                                                    style={{
                                                        marginTop:
                                                            "5px",
                                                    }}
                                                >
                                                    Update your
                                                    account
                                                    identity.
                                                    Changing your
                                                    email requires
                                                    your current
                                                    password.
                                                </p>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="stgName">
                                                        ACCOUNT
                                                        NAME
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="stgName"
                                                        className="dash-input"
                                                        value={
                                                            profileDraft.name
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            setProfileDraft(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,
                                                                    name:
                                                                        e
                                                                            .target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        required
                                                    />
                                                </div>

                                                <div className="form-field">
                                                    <label htmlFor="stgEmail">
                                                        PRIMARY
                                                        EMAIL
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="stgEmail"
                                                        className="dash-input"
                                                        value={
                                                            profileDraft.email
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            setProfileDraft(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,
                                                                    email:
                                                                        e
                                                                            .target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="stgAccountType">
                                                        ACCOUNT
                                                        TYPE
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="stgAccountType"
                                                        className="dash-input settings-readonly"
                                                        value={
                                                            settingsProfile?.accountType ||
                                                            accountType
                                                        }
                                                        readOnly
                                                    />
                                                </div>

                                                <div className="form-field">
                                                    <label htmlFor="stgRole">
                                                        WORKSPACE
                                                        ROLE
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="stgRole"
                                                        className="dash-input settings-readonly"
                                                        value={
                                                            activeSettingsWorkspace?.role ||
                                                            "NO ACTIVE ROLE"
                                                        }
                                                        readOnly
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-field">
                                                <label htmlFor="stgProfilePassword">
                                                    CURRENT PASSWORD
                                                </label>
                                                <input
                                                    type="password"
                                                    id="stgProfilePassword" aria-describedby="settings-email-password-help"
                                                    className="dash-input"
                                                    autoComplete="current-password"
                                                    value={
                                                        profileDraft.currentPassword
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setProfileDraft(
                                                            (
                                                                current
                                                            ) => ({
                                                                ...current,
                                                                currentPassword:
                                                                    e
                                                                        .target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                /><p id="settings-email-password-help" className="settings-help">Required only when changing your email address.</p>
                                            </div>

                                            <button
                                                type="submit"
                                                className="button button-primary"
                                                disabled={
                                                    settingsSaving ===
                                                    "profile"
                                                }
                                            >
                                                {settingsSaving ===
                                                "profile"
                                                    ? "SAVING…"
                                                    : "Save account"}
                                            </button>
                                        </form>

                                        <form
                                            className="settings-form settings-card settings-security"
                                            onSubmit={
                                                savePasswordSettings
                                            }
                                        >
                                            <div
                                                style={{
                                                    marginBottom:
                                                        "16px",
                                                }}
                                            >
                                                <h2>Security</h2>
                                                <p
                                                    className="text-link"
                                                    style={{
                                                        marginTop:
                                                            "5px",
                                                    }}
                                                >
                                                    Change the
                                                    password used
                                                    for your Nexus
                                                    credentials
                                                    login.
                                                </p>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="stgCurrentPassword">
                                                        CURRENT
                                                        PASSWORD
                                                    </label>
                                                    <input
                                                        type="password"
                                                        id="stgCurrentPassword"
                                                        className="dash-input"
                                                        autoComplete="current-password"
                                                        value={
                                                            passwordDraft.currentPassword
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            setPasswordDraft(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,
                                                                    currentPassword:
                                                                        e
                                                                            .target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        required
                                                    />
                                                </div>

                                                <div className="form-field">
                                                    <label htmlFor="stgNewPassword">
                                                        NEW
                                                        PASSWORD
                                                    </label>
                                                    <input
                                                        type="password"
                                                        id="stgNewPassword" aria-describedby="settings-password-rules"
                                                        className="dash-input"
                                                        autoComplete="new-password"
                                                        minLength={
                                                            8
                                                        }
                                                        value={
                                                            passwordDraft.newPassword
                                                        }
                                                        onChange={(
                                                            e
                                                        ) =>
                                                            setPasswordDraft(
                                                                (
                                                                    current
                                                                ) => ({
                                                                    ...current,
                                                                    newPassword:
                                                                        e
                                                                            .target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        required
                                                    /><p id="settings-password-rules" className="settings-help">Use at least 8 characters.</p>
                                                </div>
                                            </div>

                                            <div className="form-field">
                                                <label htmlFor="stgConfirmPassword">
                                                    CONFIRM NEW
                                                    PASSWORD
                                                </label>
                                                <input
                                                    type="password"
                                                    id="stgConfirmPassword"
                                                    className="dash-input"
                                                    autoComplete="new-password"
                                                    minLength={
                                                        8
                                                    }
                                                    value={
                                                        passwordDraft.confirmPassword
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setPasswordDraft(
                                                            (
                                                                current
                                                            ) => ({
                                                                ...current,
                                                                confirmPassword:
                                                                    e
                                                                        .target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                    required
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                className="button button-primary"
                                                disabled={
                                                    settingsSaving ===
                                                    "password" ||
                                                    !settingsProfile?.hasPassword
                                                }
                                            >
                                                {settingsSaving ===
                                                "password"
                                                    ? "UPDATING…"
                                                    : "Change password"}
                                            </button>

                                            {!settingsProfile?.hasPassword && (
                                                <p
                                                    className="text-link"
                                                    style={{
                                                        marginTop:
                                                            "10px",
                                                    }}
                                                >
                                                    This account
                                                    does not
                                                    currently use
                                                    password
                                                    authentication.
                                                </p>
                                            )}
                                        </form>

</div>
<div className="settings-column">
                                        <form
                                            className="settings-form settings-card"
                                            onSubmit={
                                                saveWorkspaceSettings
                                            }
                                        >
                                            <div
                                                style={{
                                                    marginBottom:
                                                        "16px",
                                                }}
                                            >
                                                <h2>Workspace</h2>
                                                <p
                                                    className="text-link"
                                                    style={{
                                                        marginTop:
                                                            "5px",
                                                    }}
                                                >
                                                    Workspace
                                                    names can be
                                                    changed by
                                                    Admins and
                                                    Managers.
                                                </p>
                                            </div>

                                            <div className="form-row">
                                                <div className="form-field">
                                                    <label htmlFor="stgWorkspace">
                                                        ACTIVE
                                                        WORKSPACE
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="stgWorkspace"
                                                        className="dash-input"
                                                        value={
                                                            activeSettingsWorkspace?.name ||
                                                            ""
                                                        }
                                                        readOnly
                                                    />
                                                </div>

                                                <div className="form-field">
                                                    <label htmlFor="stgWorkspaceRole">
                                                        YOUR ROLE
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="stgWorkspaceRole"
                                                        className="dash-input settings-readonly"
                                                        value={
                                                            activeSettingsWorkspace?.role ||
                                                            ""
                                                        }
                                                        readOnly
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-field">
                                                <label htmlFor="stgWorkspaceName">
                                                    WORKSPACE
                                                    NAME
                                                </label>
                                                <input
                                                    type="text"
                                                    id="stgWorkspaceName"
                                                    className="dash-input"
                                                    value={
                                                        workspaceNameDraft
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        setWorkspaceNameDraft(
                                                            e
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                    readOnly={
                                                        !canManageWorkspaceSettings
                                                    }
                                                    required
                                                />
                                            </div>

                                            {canManageWorkspaceSettings ? (
                                                <button
                                                    type="submit"
                                                    className="button button-primary"
                                                    disabled={
                                                        settingsSaving ===
                                                        "workspace" ||
                                                        !activeSettingsWorkspace
                                                    }
                                                >
                                                    {settingsSaving ===
                                                    "workspace"
                                                        ? "SAVING…"
                                                        : "Save workspace"}
                                                </button>
                                            ) : (
                                                <p className="text-link">
                                                    Your role
                                                    has
                                                    read-only
                                                    workspace
                                                    settings.
                                                </p>
                                            )}
                                        </form>

                                        <div
                                            className="settings-form settings-card"
                                        >
                                            <div className="settings-section-heading"><h2>Appearance</h2><p className="text-link">Choose the theme for this browser.</p></div>

                                            <div className="settings-theme-options" role="group" aria-label="Color theme"
                                                style={{
                                                    display:
                                                        "flex",
                                                    gap: "10px",
                                                    flexWrap:
                                                        "wrap",
                                                    marginTop:
                                                        "14px",
                                                }}
                                            >
                                                <button
                                                    type="button" aria-pressed={theme === "dark"}
                                                    className={`action-btn ${
                                                        theme ===
                                                        "dark"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() => {
                                                        if (
                                                            theme !==
                                                            "dark"
                                                        ) {
                                                            toggleTheme();
                                                        }
                                                    }}
                                                >
                                                    DARK
                                                </button>

                                                <button
                                                    type="button" aria-pressed={theme === "light"}
                                                    className={`action-btn ${
                                                        theme ===
                                                        "light"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() => {
                                                        if (
                                                            theme !==
                                                            "light"
                                                        ) {
                                                            toggleTheme();
                                                        }
                                                    }}
                                                >
                                                    LIGHT
                                                </button>

                                                
                                            </div>

                                            <p
                                                className="text-link"
                                                style={{
                                                    marginTop:
                                                        "12px",
                                                }}
                                            >
                                                Your theme preference is saved on this browser.
                                            </p>
                                        </div><section className="settings-card settings-session"><div><h2>Session</h2><p className="text-link">Sign out of your Nexus account on this browser.</p></div><button
                                                    type="button"
                                                    className="action-btn settings-signout"
                                                    onClick={confirmAndSignOut}
                                                >
                                                    SIGN OUT ↗
                                                </button></section>
</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </main>
            </div>

            <div
                inert={!briefModalOpen}
                aria-hidden={!briefModalOpen}
                className={`modal-overlay nexus-form-surface ${briefModalOpen
                    ? "active"
                    : ""
                    }`}
                onClick={(e) => {
                    if (
                        e.target ===
                        e.currentTarget
                    ) {
                        setBriefModalOpen(false);
                    }
                }}
            >
                <div className="brief-card" ref={briefDialogRef} role="dialog" aria-modal="true" aria-labelledby="brief-dialog-title">
                    <button
                        className="modal-close"
                        aria-label="Close project brief"
                        type="button"
                        onClick={() =>
                            setBriefModalOpen(
                                false
                            )
                        }
                    >
                        ✕
                    </button>

                    <div className="brief-header">
                        <span className="brief-tag">
                            INTAKE ENGINE
                        </span>

                        <h3 id="brief-dialog-title">
                            SUBMIT NEW PROJECT BRIEF
                        </h3>
                    </div>

                    <form
                        className="brief-form"
                        onSubmit={
                            handleBriefSubmit
                        }
                    >
                        <div className="form-field">
                            <label htmlFor="briefTitle">
                                PROJECT TITLE
                            </label>

                            <input
                                type="text"
                                id="briefTitle"
                                name="briefTitle"
                                className="dash-input"
                                placeholder="e.g. CoD Bo7 Camo Grind Highlights"
                                required
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="briefType">
                                CONTENT TYPE
                            </label>

                            <select
                                id="briefType"
                                name="briefType"
                                className="dash-input"
                                required
                            >
                                <option value="Short-form">
                                    Short-form Reel /
                                    TikTok
                                    (1080x1920)
                                </option>

                                <option value="YouTube Long-form">
                                    YouTube Long-form
                                    (4K / 1080p)
                                </option>

                                <option value="Repurposed Cuts">
                                    Social Repurpose
                                    Pack
                                </option>
                            </select>
                        </div>

                        <div className="form-field">
                            <label htmlFor="briefLink">
                                GOOGLE DRIVE
                                FOOTAGE FOLDER
                            </label>

                            <input
                                type="url"
                                id="briefLink"
                                name="briefLink"
                                className="dash-input"
                                placeholder="https://drive.google.com/drive/folders/..."
                                required
                                aria-invalid={briefError || undefined}
                                aria-describedby={briefError ? "brief-link-error" : undefined}
                            />

                            <p
                                id="brief-link-error"
                                role={briefError ? "alert" : undefined}
                                className={`brief-error-msg ${briefError
                                    ? "active"
                                    : ""
                                    }`}
                            >
                                Please paste a valid
                                Google Drive folder
                                link. Individual file
                                links are not accepted.
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="button button-primary full-width"
                            disabled={
                                briefSubmitting
                            }
                        >
                            {briefSubmitting
                                ? "SUBMITTING…"
                                : "SUBMIT TO PRODUCTION QUEUE ↗"}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
