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
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { InterfaceTranslator, LanguageSelector } from "@/components/InterfaceLanguage";

export default function CreatorDashboard({ user }) {
    const accountType = user?.accountType || "CREATOR";
    const isEditor = accountType === "EDITOR";
    const isCreator = accountType === "CREATOR";

    // =========================
    // STATE MANAGEMENT
    // =========================
    const [theme, setTheme] = useState("dark");
    const [currentView, setCurrentView] = useState("overview");
    const [projectFilter, setProjectFilter] = useState("all");
    const [assetSearch, setAssetSearch] = useState("");
    const [briefModalOpen, setBriefModalOpen] = useState(false);
    const [briefError, setBriefError] = useState(false);
    const [briefSubmitting, setBriefSubmitting] = useState(false);

    // Projects now come from the database via /api/projects
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);

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

    // =========================
    // PROJECT STATUS HELPERS
    // =========================
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
            REQUESTED: "QUEUED",
            IN_PRODUCTION: "IN PRODUCTION",
            IN_REVIEW: "NEEDS REVIEW",
            REVISION: "REVISION REQUESTED",
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

    // =========================
    // PROJECT FORMATTING HELPERS
    // =========================
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

    // Map a raw DB project record into the shape the UI renders
    const toDisplayProject = (p) => ({
        id: p.id,
        projectId: p.projectId,
        title: p.title,
        type: p.type,
        status: normalizeProjectStatus(p.status),
        eta: p.eta,
        date: formatProjectDate(p.createdAt, p.type),
    });

    // =========================
    // FETCH ORGANIZATIONS
    // =========================
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
                // Zero accessible organizations is a valid state, such as
                // an Editor who has not been assigned to any projects yet.
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

    // =========================
    // FETCH CREATORS
    // =========================
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

    // =========================
    // FETCH PROJECTS
    // =========================
    // =========================
    // FETCH ASSETS
    // =========================
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

        const confirmed = window.confirm(
            `Delete ${asset.fileName}? This removes the file from Cloudflare R2 and Nexus.`
        );

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

    // =========================
    // FETCH SYSTEM ACTIVITY
    // =========================
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

    // =========================
    // NOTIFICATIONS
    // =========================
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

    // =========================
    // ACCOUNT SETTINGS
    // =========================
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
                    ? "Profile and email updated."
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
                "Password updated successfully."
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

    const loadProjects = async (
        organizationId = activeOrganizationId
    ) => {
        if (!organizationId) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }

        setProjectsLoading(true);
        setProjectsError(null);

        try {
            const res = await fetch(
                `/api/projects?organizationId=${encodeURIComponent(
                    organizationId
                )}`
            );

            if (!res.ok) {
                throw new Error("Failed to load projects");
            }

            const data = await res.json();

            setProjects(
                (data.projects || []).map(toDisplayProject)
            );
        } catch (err) {
            console.error("Failed to load projects:", err);

            setProjectsError(
                "Couldn't load your projects. Try refreshing."
            );
        } finally {
            setProjectsLoading(false);
        }
    };

    // =========================
    // FETCH CREATOR PROJECTS
    // =========================
    const loadCreatorProjects = async (creatorId) => {
        if (!creatorId || !activeOrganizationId) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }

        setProjectsLoading(true);
        setProjectsError(null);

        try {
            const res = await fetch(
                `/api/projects?organizationId=${encodeURIComponent(
                    activeOrganizationId
                )}&creatorId=${encodeURIComponent(creatorId)}`
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

    // =========================
    // PROJECT ASSIGNMENTS
    // =========================
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

    // =========================
    // CREATOR ASSIGNMENTS
    // =========================
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

    // =========================
    // TASK MANAGEMENT
    // =========================
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

    // =========================
    // FETCH PROJECT DETAILS
    // =========================
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

    // =========================
    // INITIAL DATA LOAD
    // =========================
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
        if (activeOrganizationId) {
            loadProjects(activeOrganizationId);
            loadCreators(activeOrganizationId);
            loadAssets(activeOrganizationId);
            loadActivity(activeOrganizationId);
        } else if (!organizationsLoading) {
            // No accessible organization means there is nothing left to
            // fetch, so finish the dependent loading states.
            setProjects([]);
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

    // =========================
    // THEME INITIALIZATION
    // =========================
    useEffect(() => {
        const savedTheme = localStorage.getItem("nexus-theme");

        if (savedTheme === "light") {
            setTheme("light");
            document.documentElement.setAttribute(
                "data-theme",
                "light"
            );
        } else {
            setTheme("dark");
            document.documentElement.setAttribute(
                "data-theme",
                "dark"
            );
        }
    }, []);

    const toggleTheme = () => {
        const newTheme =
            theme === "light" ? "dark" : "light";

        setTheme(newTheme);

        document.documentElement.setAttribute(
            "data-theme",
            newTheme
        );

        localStorage.setItem("nexus-theme", newTheme);
    };

    // =========================
    // VIEW TITLES
    // =========================
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

    // Analytics integrations are not connected yet.
    // Keep this view intentionally empty rather than displaying sample metrics.

    // =========================
    // BRIEF SUBMISSION
    // =========================
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

    // =========================
    // ASSET VAULT HELPERS
    // =========================
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

    return (
        <>
            <InterfaceTranslator />
            <div className="noise"></div>

            <div className="app-shell">
                {/* SIDEBAR NAVIGATION */}
                <aside className="sidebar">
                    <a href="/" className="brand">
                        <span>NEXUS</span>
                        <b>SETUPS</b>
                    </a>

                    <div className="sidebar-label">
                        WORKSPACE
                    </div>

                    <nav className="sidebar-nav">
                        {[
                            [
                                "overview",
                                "⚡",
                                isEditor
                                    ? "Overview"
                                    : "My Overview",
                            ],

                            [
                                "projects",
                                "🎬",
                                isEditor
                                    ? "Projects & Edits"
                                    : "My Projects",
                            ],

                            ...(isEditor
                                ? [
                                    [
                                        "creators",
                                        "👥",
                                        "Creators",
                                    ],
                                ]
                                : []),

                            [
                                "assets",
                                "📁",
                                isEditor
                                    ? "Asset Vault"
                                    : "My Assets",
                            ],

                            [
                                "analytics",
                                "📊",
                                "Analytics",
                            ],

                            [
                                "settings",
                                "⚙️",
                                "Settings",
                            ],
                        ].map(
                            ([view, icon, label]) => (
                                <button
                                    key={view}
                                    type="button"
                                    className={`nav-item ${currentView === view
                                        ? "active"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        setCurrentView(
                                            view
                                        )
                                    }
                                >
                                    <span className="icon">
                                        {icon}
                                    </span>

                                    <span>
                                        {label}
                                    </span>
                                </button>
                            )
                        )}
                    </nav>

                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {displayUserName
                                .split(" ")
                                .map(
                                    (part) =>
                                        part[0]
                                )
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                        </div>

                        <div className="user-meta">
                            <strong>
                                {displayUserName}
                            </strong>

                            <small>
                                {accountType} ACCOUNT
                            </small>
                        </div>

                        <button
                            type="button"
                            className="logout-btn"
                            title="Log Out"
                            aria-label="Log out"
                            onClick={confirmAndSignOut}
                        >
                            ↗
                        </button>
                    </div>
                </aside>

                {/* MAIN DASHBOARD CONTENT */}
                <main className="dashboard-main">
                    {/* TOP BAR */}
                    <header className="dash-header">
                        <div className="page-title">
                            <span className="status-tag">
                                ACTIVE SESSION
                            </span>

                            <h2>
                                {
                                    viewTitles[
                                    currentView
                                    ]
                                }
                            </h2>
                        </div>

                        <div className="dash-actions">
                            <div className="organization-selector">
                                <span className="organization-label">
                                    {isEditor
                                        ? "ORGANIZATION"
                                        : "WORKSPACE"}
                                </span>

                                <select
                                    className="organization-select"
                                    value={
                                        activeOrganizationId ||
                                        ""
                                    }
                                    onChange={(e) => {
                                        setActiveOrganizationId(
                                            e.target.value
                                        );
                                    }}
                                    disabled={
                                        organizationsLoading ||
                                        organizations.length ===
                                        0
                                    }
                                >
                                    {organizationsLoading && (
                                        <option value="">
                                            LOADING...
                                        </option>
                                    )}

                                    {!organizationsLoading &&
                                        organizations.map(
                                            (
                                                organization
                                            ) => (
                                                <option
                                                    key={
                                                        organization.id
                                                    }
                                                    value={
                                                        organization.id
                                                    }
                                                >
                                                    {
                                                        organization.name
                                                    }
                                                </option>
                                            )
                                        )}
                                </select>
                            </div>

                            <LanguageSelector compact />

                            <div
                                style={{
                                    position:
                                        "relative",
                                }}
                            >
                                <button
                                    type="button"
                                    className="action-btn"
                                    aria-label="Notifications"
                                    aria-expanded={
                                        notificationMenuOpen
                                    }
                                    onClick={() => {
                                        setNotificationMenuOpen(
                                            (current) =>
                                                !current
                                        );

                                        if (
                                            !notificationMenuOpen
                                        ) {
                                            loadNotifications({
                                                silent: true,
                                            });
                                        }
                                    }}
                                    style={{
                                        position:
                                            "relative",
                                        minWidth:
                                            "42px",
                                        minHeight:
                                            "42px",
                                        padding:
                                            "0 12px",
                                        display:
                                            "inline-flex",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                        fontSize:
                                            "1.05rem",
                                    }}
                                >
                                    🔔

                                    {unreadNotificationCount >
                                        0 && (
                                        <span
                                            style={{
                                                position:
                                                    "absolute",
                                                top: "-6px",
                                                right:
                                                    "-6px",
                                                minWidth:
                                                    "20px",
                                                height:
                                                    "20px",
                                                padding:
                                                    "0 5px",
                                                borderRadius:
                                                    "999px",
                                                display:
                                                    "inline-flex",
                                                alignItems:
                                                    "center",
                                                justifyContent:
                                                    "center",
                                                fontSize:
                                                    "0.68rem",
                                                fontWeight:
                                                    800,
                                                lineHeight:
                                                    1,
                                                background:
                                                    "var(--accent)",
                                                color:
                                                    "var(--bg)",
                                                border:
                                                    "2px solid var(--bg)",
                                            }}
                                        >
                                            {unreadNotificationCount >
                                            99
                                                ? "99+"
                                                : unreadNotificationCount}
                                        </span>
                                    )}
                                </button>

                                {notificationMenuOpen && (
                                    <div
                                        style={{
                                            position:
                                                "absolute",
                                            top:
                                                "calc(100% + 10px)",
                                            right: 0,
                                            width:
                                                "min(390px, calc(100vw - 32px))",
                                            maxHeight:
                                                "520px",
                                            overflowY:
                                                "auto",
                                            zIndex:
                                                1000,
                                            padding:
                                                "14px",
                                            border:
                                                "1px solid var(--line)",
                                            borderRadius:
                                                "10px",
                                            background:
                                                "var(--notification-bg)",
                                            backdropFilter:
                                                "blur(16px)",
                                            WebkitBackdropFilter:
                                                "blur(16px)",
                                            boxShadow:
                                                "var(--notification-shadow)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display:
                                                    "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems:
                                                    "center",
                                                gap:
                                                    "12px",
                                                marginBottom:
                                                    "12px",
                                            }}
                                        >
                                            <div>
                                                <strong>
                                                    NOTIFICATIONS
                                                </strong>

                                                <p
                                                    style={{
                                                        margin:
                                                            "4px 0 0",
                                                        fontSize:
                                                            "0.75rem",
                                                        color:
                                                            "var(--notification-muted)",
                                                    }}
                                                >
                                                    {unreadNotificationCount}{" "}
                                                    unread
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                className="text-link"
                                                disabled={
                                                    markingAllNotificationsRead ||
                                                    unreadNotificationCount ===
                                                        0
                                                }
                                                onClick={
                                                    markAllNotificationsRead
                                                }
                                            >
                                                {markingAllNotificationsRead
                                                    ? "UPDATING…"
                                                    : "MARK ALL READ"}
                                            </button>
                                        </div>

                                        {notificationsLoading && (
                                            <p className="text-link">
                                                Loading
                                                notifications…
                                            </p>
                                        )}

                                        {!notificationsLoading &&
                                            notificationsError && (
                                                <p className="brief-error-msg active">
                                                    {
                                                        notificationsError
                                                    }
                                                </p>
                                            )}

                                        {!notificationsLoading &&
                                            !notificationsError &&
                                            notifications.length ===
                                                0 && (
                                                <p
                                                    style={{
                                                        color:
                                                            "var(--notification-muted)",
                                                        margin:
                                                            0,
                                                    }}
                                                >
                                                    No
                                                    notifications
                                                    yet.
                                                </p>
                                            )}

                                        {!notificationsLoading &&
                                            notifications.length >
                                                0 && (
                                                <div
                                                    style={{
                                                        display:
                                                            "grid",
                                                        gap:
                                                            "8px",
                                                    }}
                                                >
                                                    {notifications.map(
                                                        (
                                                            notification
                                                        ) => (
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
                                                                style={{
                                                                    width:
                                                                        "100%",
                                                                    textAlign:
                                                                        "left",
                                                                    padding:
                                                                        "12px",
                                                                    border:
                                                                        "1px solid var(--line)",
                                                                    borderRadius:
                                                                        "8px",
                                                                    background:
                                                                        notification.read
                                                                            ? "var(--notification-read-bg)"
                                                                            : "var(--notification-unread-bg)",
                                                                    color:
                                                                        "inherit",
                                                                    cursor:
                                                                        notification.read
                                                                            ? "default"
                                                                            : "pointer",
                                                                    opacity:
                                                                        notificationUpdatingId ===
                                                                        notification.id
                                                                            ? 0.65
                                                                            : 1,
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "space-between",
                                                                        gap:
                                                                            "10px",
                                                                    }}
                                                                >
                                                                    <strong>
                                                                        {
                                                                            notification.title
                                                                        }
                                                                    </strong>

                                                                    {!notification.read && (
                                                                        <span
                                                                            title="Unread"
                                                                            style={{
                                                                                width:
                                                                                    "8px",
                                                                                height:
                                                                                    "8px",
                                                                                flex:
                                                                                    "0 0 8px",
                                                                                borderRadius:
                                                                                    "999px",
                                                                                background:
                                                                                    "var(--accent)",
                                                                            }}
                                                                        />
                                                                    )}
                                                                </div>

                                                                <p
                                                                    style={{
                                                                        margin:
                                                                            "6px 0 0",
                                                                        lineHeight:
                                                                            1.45,
                                                                        color:
                                                                            "var(--notification-text)",
                                                                    }}
                                                                >
                                                                    {
                                                                        notification.message
                                                                    }
                                                                </p>

                                                                <span
                                                                    className="text-link"
                                                                    style={{
                                                                        display:
                                                                            "block",
                                                                        marginTop:
                                                                            "7px",
                                                                        fontSize:
                                                                            "0.72rem",
                                                                    }}
                                                                >
                                                                    {formatActivityTime(
                                                                        notification.createdAt
                                                                    )}
                                                                </span>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>

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

                            {isCreator && (
                                <button
                                    type="button"
                                    className="button button-primary"
                                    onClick={() =>
                                        setBriefModalOpen(
                                            true
                                        )
                                    }
                                >
                                    + NEW PROJECT BRIEF
                                </button>
                            )}
                        </div>
                    </header>

                    {/* =========================================
                        VIEW 1: OVERVIEW
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "overview"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <section className="metrics-grid">
                                <div className="metric-card">
                                    <span className="metric-label">ACTIVE EDITS</span>
                                    <strong className="metric-value">
                                        {projectsLoading
                                            ? "—"
                                            : String(
                                                projects.filter(
                                                    (p) =>
                                                        ![
                                                            "APPROVED",
                                                        ].includes(
                                                            normalizeProjectStatus(p.status)
                                                        )
                                                ).length
                                            ).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta">
                                        {projectsLoading
                                            ? "Loading…"
                                            : `${projects.filter(
                                                (p) =>
                                                    normalizeProjectStatus(p.status) ===
                                                    "IN_PRODUCTION"
                                            ).length} in production`}
                                    </span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">APPROVED</span>
                                    <strong className="metric-value">
                                        {projectsLoading
                                            ? "—"
                                            : String(
                                                projects.filter(
                                                    (p) =>
                                                        normalizeProjectStatus(p.status) ===
                                                        "APPROVED"
                                                ).length
                                            ).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta">Final approved cuts</span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">ASSETS</span>
                                    <strong className="metric-value">
                                        {assetsLoading
                                            ? "—"
                                            : String(assets.length).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta">
                                        {assetsLoading ? "Loading…" : "Files in asset vault"}
                                    </span>
                                </div>

                                <div className="metric-card">
                                    <span className="metric-label">IN REVIEW</span>
                                    <strong className="metric-value">
                                        {projectsLoading
                                            ? "—"
                                            : String(
                                                projects.filter(
                                                    (p) =>
                                                        normalizeProjectStatus(p.status) ===
                                                        "IN_REVIEW"
                                                ).length
                                            ).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta">Awaiting review</span>
                                </div>
                            </section>

                            <section className="content-grid">
                                <div className="panel pipeline-panel">
                                    <div className="panel-header">
                                        <h3>
                                            ACTIVE PRODUCTION
                                            QUEUE
                                        </h3>

                                        <button
                                            type="button"
                                            className="text-link"
                                            onClick={() =>
                                                setCurrentView(
                                                    "projects"
                                                )
                                            }
                                        >
                                            VIEW ALL →
                                        </button>
                                    </div>

                                    <div className="project-list">
                                        {projectsLoading && (
                                            <p className="text-link">
                                                Loading
                                                projects…
                                            </p>
                                        )}

                                        {!projectsLoading &&
                                            projectsError && (
                                                <p className="brief-error-msg active">
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
                                                    No projects
                                                    yet —
                                                    submit a
                                                    brief to
                                                    get
                                                    started.
                                                </p>
                                            )}

                                        {!projectsLoading &&
                                            !projectsError &&
                                            projects
                                                .slice(
                                                    0,
                                                    3
                                                )
                                                .map(
                                                    (
                                                        proj
                                                    ) => (
                                                        <div
                                                            className={`project-item production-queue-item status-row-${normalizeProjectStatus(
                                                                proj.status
                                                            )
                                                                .toLowerCase()
                                                                .replaceAll(
                                                                    "_",
                                                                    "-"
                                                                )}`}
                                                            key={
                                                                proj.id
                                                            }
                                                        >
                                                            <div className="project-info">
                                                                <strong>
                                                                    {
                                                                        proj.title
                                                                    }
                                                                </strong>

                                                                <small>
                                                                    {
                                                                        proj.type
                                                                    }{" "}
                                                                    •{" "}
                                                                    {resolutionForType(
                                                                        proj.type
                                                                    )}
                                                                </small>
                                                            </div>

                                                            <div
                                                                className={`project-status status-${normalizeProjectStatus(
                                                                    proj.status
                                                                )
                                                                    .toLowerCase()
                                                                    .replaceAll(
                                                                        "_",
                                                                        "-"
                                                                    )}`}
                                                            >
                                                                {displayStatus(
                                                                    proj.status
                                                                )}
                                                            </div>

                                                            <div className="project-eta">
                                                                {
                                                                    proj.eta
                                                                }
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                    </div>
                                </div>

                                <div className="panel activity-panel">
                                    <div className="panel-header">
                                        <h3>SYSTEM ACTIVITY</h3>

                                        <button
                                            type="button"
                                            className="text-link"
                                            onClick={() =>
                                                loadActivity(
                                                    activeOrganizationId
                                                )
                                            }
                                            disabled={
                                                activityLoading ||
                                                !activeOrganizationId
                                            }
                                        >
                                            {activityLoading
                                                ? "LOADING…"
                                                : "REFRESH ↻"}
                                        </button>
                                    </div>

                                    <div className="activity-panel-body">
                                    {activityLoading && (
                                        <div
                                            style={{
                                                padding: "18px 0",
                                            }}
                                        >
                                            <p className="text-link">
                                                Loading system
                                                activity…
                                            </p>
                                        </div>
                                    )}

                                    {!activityLoading &&
                                        activityError && (
                                            <div
                                                style={{
                                                    padding:
                                                        "18px 0",
                                                }}
                                            >
                                                <p className="brief-error-msg active">
                                                    {
                                                        activityError
                                                    }
                                                </p>
                                            </div>
                                        )}

                                    {!activityLoading &&
                                        !activityError &&
                                        activity.length ===
                                            0 && (
                                            <div
                                                style={{
                                                    padding:
                                                        "18px 0",
                                                }}
                                            >
                                                <strong>
                                                    NO ACTIVITY YET
                                                </strong>

                                                <p
                                                    className="text-link"
                                                    style={{
                                                        marginTop:
                                                            "8px",
                                                    }}
                                                >
                                                    Project,
                                                    assignment,
                                                    and review
                                                    activity
                                                    will appear
                                                    here.
                                                </p>
                                            </div>
                                        )}

                                    {!activityLoading &&
                                        !activityError &&
                                        activity.length >
                                            0 && (
                                            <div
                                                style={{
                                                    display:
                                                        "grid",
                                                }}
                                            >
                                                {activity.map(
                                                    (
                                                        entry,
                                                        index
                                                    ) => (
                                                        <div
                                                            key={
                                                                entry.id
                                                            }
                                                            style={{
                                                                padding:
                                                                    "14px 0",
                                                                borderTop:
                                                                    index ===
                                                                    0
                                                                        ? "none"
                                                                        : "1px solid var(--line)",
                                                            }}
                                                        >
                                                            <p
                                                                style={{
                                                                    margin:
                                                                        0,
                                                                    lineHeight:
                                                                        1.5,
                                                                }}
                                                            >
                                                                {formatActivityDescription(
                                                                    entry
                                                                )}
                                                            </p>

                                                            <span
                                                                className="text-link"
                                                                style={{
                                                                    display:
                                                                        "block",
                                                                    marginTop:
                                                                        "5px",
                                                                    fontSize:
                                                                        "0.75rem",
                                                                }}
                                                            >
                                                                {formatActivityTime(
                                                                    entry.createdAt
                                                                )}
                                                            </span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* =========================================
                        VIEW 2: PROJECTS
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "projects"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <h3>
                                        ALL CREATOR PROJECTS
                                    </h3>

                                    <div className="filter-pills">
                                        {[
                                            "all",
                                            "REQUESTED",
                                            "IN_PRODUCTION",
                                            "IN_REVIEW",
                                            "REVISION",
                                            "APPROVED",
                                        ].map(
                                            (filter) => (
                                                <button
                                                    key={
                                                        filter
                                                    }
                                                    type="button"
                                                    className={`filter-pill ${projectFilter ===
                                                        filter
                                                        ? "active"
                                                        : ""
                                                        }`}
                                                    onClick={() =>
                                                        setProjectFilter(
                                                            filter
                                                        )
                                                    }
                                                >
                                                    {filter ===
                                                        "all"
                                                        ? "ALL"
                                                        : displayStatus(
                                                            filter
                                                        )}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="full-project-table">
                                    <div className="table-row table-head">
                                        <span>
                                            TITLE & FORMAT
                                        </span>

                                        <span>
                                            TYPE
                                        </span>

                                        <span>
                                            STATUS
                                        </span>

                                        <span>
                                            ETA / VERSION
                                        </span>

                                        <span>
                                            ACTION
                                        </span>
                                    </div>

                                    {projectsLoading && (
                                        <p
                                            className="text-link"
                                            style={{
                                                padding:
                                                    "16px",
                                            }}
                                        >
                                            Loading
                                            projects…
                                        </p>
                                    )}

                                    {!projectsLoading &&
                                        projectsError && (
                                            <p
                                                className="brief-error-msg active"
                                                style={{
                                                    padding:
                                                        "16px",
                                                }}
                                            >
                                                {
                                                    projectsError
                                                }
                                            </p>
                                        )}

                                    {!projectsLoading &&
                                        !projectsError &&
                                        projects
                                            .filter(
                                                (
                                                    p
                                                ) =>
                                                    projectFilter ===
                                                    "all" ||
                                                    normalizeProjectStatus(
                                                        p.status
                                                    ) ===
                                                    projectFilter
                                            )
                                            .map(
                                                (
                                                    proj
                                                ) => (
                                                    <div
                                                        className={`table-row project-table-row status-row-${normalizeProjectStatus(
                                                            proj.status
                                                        )
                                                            .toLowerCase()
                                                            .replaceAll(
                                                                "_",
                                                                "-"
                                                            )}`}
                                                        key={
                                                            proj.id
                                                        }
                                                    >
                                                        <div className="project-title-cell">
                                                            <strong>
                                                                {
                                                                    proj.title
                                                                }
                                                            </strong>

                                                            <small>
                                                                {
                                                                    proj.date
                                                                }
                                                            </small>
                                                        </div>

                                                        <span className="cell-type">
                                                            {
                                                                proj.type
                                                            }
                                                        </span>

                                                        <div>
                                                            <span
                                                                className={`project-status status-${normalizeProjectStatus(
                                                                    proj.status
                                                                )
                                                                    .toLowerCase()
                                                                    .replaceAll(
                                                                        "_",
                                                                        "-"
                                                                    )}`}
                                                            >
                                                                {displayStatus(
                                                                    proj.status
                                                                )}
                                                            </span>
                                                        </div>

                                                        <span className="cell-eta">
                                                            {
                                                                proj.eta
                                                            }
                                                        </span>

                                                        <div>
                                                            <button
                                                                type="button"
                                                                className={`action-btn ${proj.status ===
                                                                    "IN_REVIEW" ||
                                                                    proj.status ===
                                                                    "REVISION"
                                                                    ? "active"
                                                                    : ""
                                                                    }`}
                                                                onClick={() =>
                                                                    openProjectDetails(
                                                                        proj
                                                                    )
                                                                }
                                                            >
                                                                {proj.status ===
                                                                    "IN_REVIEW"
                                                                    ? "REVIEW CUT ↗"
                                                                    : proj.status ===
                                                                        "REVISION"
                                                                        ? "VIEW REVISION ↗"
                                                                        : proj.status ===
                                                                          "APPROVED"
                                                                            ? "VIEW PROJECT ↗"
                                                                            : "VIEW BRIEF"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* =========================================
                        VIEW 3: CREATORS
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "creators"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            EDITOR WORKSPACE
                                        </span>

                                        <h3>
                                            ALL CREATORS
                                        </h3>
                                    </div>

                                    <span className="graph-tag">
                                        {creatorsLoading
                                            ? "LOADING..."
                                            : `${creators.length} CREATOR${creators.length ===
                                                1
                                                ? ""
                                                : "S"
                                            }`}
                                    </span>
                                </div>

                                {creatorsLoading && (
                                    <p className="text-link">
                                        Loading creators…
                                    </p>
                                )}

                                {!creatorsLoading &&
                                    creatorsError && (
                                        <p className="brief-error-msg active">
                                            {
                                                creatorsError
                                            }
                                        </p>
                                    )}

                                {!creatorsLoading &&
                                    !creatorsError &&
                                    creators.length ===
                                    0 && (
                                        <p className="text-link">
                                            No creators have
                                            been added to this
                                            organization yet.
                                        </p>
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

                                                        <div className="project-status completed">
                                                            ACTIVE
                                                        </div>

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
                                                            OPEN
                                                            WORKSPACE
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

                    {/* =========================================
                        VIEW 4: CREATOR WORKSPACE
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "creator-workspace"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            CREATOR WORKSPACE
                                        </span>

                                        <h3>
                                            {selectedCreator
                                                ? selectedCreator.name.toUpperCase()
                                                : "CREATOR WORKSPACE"}
                                        </h3>
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
                                        ← BACK TO
                                        CREATORS
                                    </button>
                                </div>

                                {!selectedCreator ? (
                                    <p className="text-link">
                                        Select a creator to
                                        open their workspace.
                                    </p>
                                ) : (
                                    <>
                                        <div className="metrics-grid creator-summary-grid">
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
                                                    className="panel"
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
                                                                ASSIGN
                                                                ENTIRE
                                                                CREATOR
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
                                                            <p className="brief-error-msg active">
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

                                                                            <button
                                                                                type="button"
                                                                                className="action-btn"
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
                                                                AVAILABLE
                                                                EDITORS
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

                                        <div className="panel">
                                            <div className="panel-header">
                                                <h3>
                                                    CREATOR
                                                    PROJECT
                                                    QUEUE
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
                                                    <p className="brief-error-msg active">
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
                                                                        className={`project-status ${project.status}`}
                                                                    >
                                                                        {displayStatus(
                                                                            project.status
                                                                        )}
                                                                    </div>

                                                                    <div className="project-eta">
                                                                        {project.status ===
                                                                            "IN_REVIEW" ||
                                                                            project.status ===
                                                                            "REVISION"
                                                                            ? "REVIEW CUT ↗"
                                                                            : project.eta}
                                                                    </div>
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

                    {/* =========================================
                        VIEW 5: PROJECT DETAILS / REVIEW
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "project-details"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            PROJECT DETAILS
                                        </span>

                                        <h3>
                                            {selectedProject
                                                ?.content
                                                ?.title ||
                                                "PROJECT"}
                                        </h3>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            flexWrap: "wrap",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        {canEditProjectDetails &&
                                            selectedProject && (
                                                <button
                                                    type="button"
                                                    className="action-btn"
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
                                                        ? "CANCEL EDIT"
                                                        : "EDIT PROJECT"}
                                                </button>
                                            )}

                                        {canDeleteProject &&
                                            selectedProject && (
                                                <button
                                                    type="button"
                                                    className="action-btn"
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
                                                        : "DELETE PROJECT"}
                                                </button>
                                            )}

                                        <button
                                            type="button"
                                            className="action-btn"
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
                                            ← BACK
                                        </button>
                                    </div>
                                </div>

                                {projectDetailsLoading && (
                                    <p className="text-link">
                                        Loading project
                                        details…
                                    </p>
                                )}

                                {!projectDetailsLoading &&
                                    projectDetailsError && (
                                        <p className="brief-error-msg active">
                                            {
                                                projectDetailsError
                                            }
                                        </p>
                                    )}

                                {!projectDetailsLoading &&
                                    !projectDetailsError &&
                                    selectedProject && (
                                        <>
                                            {/* PROJECT INFORMATION */}
                                            <div className="metrics-grid">
                                                <div className="metric-card">
                                                    <span className="metric-label">
                                                        CONTENT TYPE
                                                    </span>

                                                    <strong className="metric-value">
                                                        {selectedProject
                                                            .content
                                                            ?.contentType ||
                                                            "—"}
                                                    </strong>

                                                    <span className="metric-delta">
                                                        {selectedProject
                                                            .content
                                                            ?.title ||
                                                            ""}
                                                    </span>
                                                </div>

                                                <div className="metric-card">
                                                    <span className="metric-label">
                                                        CREATOR
                                                    </span>

                                                    <strong className="metric-value">
                                                        {selectedProject
                                                            .project
                                                            ?.creator
                                                            ?.name ||
                                                            "Unassigned"}
                                                    </strong>

                                                    <span className="metric-delta">
                                                        {selectedProject
                                                            .project
                                                            ?.creator
                                                            ?.email ||
                                                            ""}
                                                    </span>
                                                </div>

                                                <div className="metric-card">
                                                    <span className="metric-label">
                                                        CURRENT
                                                        STATUS
                                                    </span>

                                                    <strong
                                                        className={`project-status ${selectedProject
                                                            .content
                                                            ?.status?.toLowerCase() ||
                                                            ""
                                                            }`}
                                                    >
                                                        {displayStatus(
                                                            selectedProject
                                                                .content
                                                                ?.status
                                                        )}
                                                    </strong>

                                                    <span className="metric-delta">
                                                        Last updated{" "}
                                                        {selectedProject
                                                            .content
                                                            ?.updatedAt
                                                            ? new Date(
                                                                selectedProject
                                                                    .content
                                                                    .updatedAt
                                                            ).toLocaleDateString()
                                                            : "—"}
                                                    </span>
                                                </div>

                                                <div className="metric-card">
                                                    <span className="metric-label">
                                                        SUBMITTED
                                                    </span>

                                                    <strong className="metric-value">
                                                        {selectedProject
                                                            .content
                                                            ?.createdAt
                                                            ? new Date(
                                                                selectedProject
                                                                    .content
                                                                    .createdAt
                                                            ).toLocaleDateString()
                                                            : "—"}
                                                    </strong>

                                                    <span className="metric-delta">
                                                        Nexus
                                                        production
                                                        queue
                                                    </span>
                                                </div>
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
                                                            <p className="brief-error-msg active">
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

                                            {/* PRODUCTION TASKS */}
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
                                                            TASKS
                                                        </span>

                                                        <h3>
                                                            PROJECT
                                                            TASKS
                                                        </h3>
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
                                                        <p className="brief-error-msg active">
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
                                                                <h3>
                                                                    CREATE
                                                                    TASK
                                                                </h3>

                                                                <span className="graph-tag">
                                                                    MANAGER
                                                                    CONTROL
                                                                </span>
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
                                                                    : "+ CREATE TASK"}
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

                                                                    /*
                                                                     * A completed task only collapses after the
                                                                     * completed status has actually been saved to
                                                                     * the database. This prevents the card from
                                                                     * disappearing before SAVE TASK is pressed.
                                                                     */
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

                                            {/* PROJECT ASSIGNMENTS */}
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
                                                                <p className="brief-error-msg active">
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

                                            {/* GOOGLE DRIVE FOOTAGE FOLDER */}
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

                                            {/* PRODUCTION WORKFLOW */}
                                            <div
                                                className="panel"
                                                style={{
                                                    marginTop:
                                                        "20px",
                                                }}
                                            >
                                                <div className="panel-header">
                                                    <h3>
                                                        PRODUCTION
                                                        WORKFLOW
                                                    </h3>

                                                    <span className="graph-tag">
                                                        {displayStatus(
                                                            selectedProject
                                                                .content
                                                                ?.status
                                                        )}
                                                    </span>
                                                </div>

                                                <div
                                                    style={{
                                                        display:
                                                            "grid",
                                                        gap: "10px",
                                                    }}
                                                >
                                                    {[
                                                        [
                                                            "REQUESTED",
                                                            "REQUEST RECEIVED",
                                                        ],
                                                        [
                                                            "IN_PRODUCTION",
                                                            "IN PRODUCTION",
                                                        ],
                                                        [
                                                            "IN_REVIEW",
                                                            "IN REVIEW",
                                                        ],
                                                        [
                                                            "REVISION",
                                                            "REVISION",
                                                        ],
                                                        [
                                                            "APPROVED",
                                                            "APPROVED",
                                                        ],
                                                    ].map(
                                                        (
                                                            [
                                                                status,
                                                                label,
                                                            ],
                                                            index
                                                        ) => {
                                                            const current =
                                                                normalizeProjectStatus(
                                                                    selectedProject
                                                                        .content
                                                                        ?.status
                                                                );

                                                            const statusOrder =
                                                                [
                                                                    "REQUESTED",
                                                                    "IN_PRODUCTION",
                                                                    "IN_REVIEW",
                                                                    "REVISION",
                                                                    "APPROVED",
                                                                ];

                                                            const currentIndex =
                                                                statusOrder.indexOf(
                                                                    current
                                                                );

                                                            const statusIndex =
                                                                statusOrder.indexOf(
                                                                    status
                                                                );

                                                            const completed =
                                                                statusIndex <=
                                                                currentIndex &&
                                                                current !==
                                                                "REVISION";

                                                            const isCurrent =
                                                                current ===
                                                                status;

                                                            return (
                                                                <div
                                                                    key={
                                                                        status
                                                                    }
                                                                    style={{
                                                                        display:
                                                                            "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap: "12px",
                                                                        padding:
                                                                            "10px 14px",
                                                                        border:
                                                                            "1px solid var(--line)",
                                                                        borderRadius:
                                                                            "8px",
                                                                        opacity:
                                                                            completed ||
                                                                                isCurrent
                                                                                ? 1
                                                                                : 0.45,
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            fontWeight:
                                                                                700,
                                                                            minWidth:
                                                                                "28px",
                                                                        }}
                                                                    >
                                                                        {completed
                                                                            ? "✓"
                                                                            : index +
                                                                            1}
                                                                    </span>

                                                                    <strong>
                                                                        {
                                                                            label
                                                                        }
                                                                    </strong>

                                                                    {isCurrent && (
                                                                        <span
                                                                            className="graph-tag"
                                                                            style={{
                                                                                marginLeft:
                                                                                    "auto",
                                                                            }}
                                                                        >
                                                                            CURRENT
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>

                                            {/* PRODUCTION ACTIONS */}
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

                                            {/* REVIEW */}
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
                                                    <p className="brief-error-msg active">
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
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            comment.id
                                                                                        }
                                                                                        className="review-comment-card"
                                                                                    >
                                                                                        <div className="review-comment-top">
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

                                                                                        <p
                                                                                            style={{
                                                                                                marginTop:
                                                                                                    "6px",
                                                                                            }}
                                                                                        >
                                                                                            {
                                                                                                comment.comment
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                )
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

                                                {pendingReview?.assetVersion && (
                                                    <div
                                                        className="review-history-card"
                                                        style={{
                                                            marginBottom:
                                                                "16px",
                                                        }}
                                                    >
                                                        <div className="review-history-top">
                                                            <strong>
                                                                CURRENT REVIEW CUT
                                                            </strong>
                                                            <span className="graph-tag">
                                                                v{
                                                                    pendingReview
                                                                        .assetVersion
                                                                        .version
                                                                }
                                                            </span>
                                                        </div>

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
                                                                        : "✓ APPROVE CUT"}
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    className="action-btn active"
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
                                                                    ↻ REQUEST
                                                                    REVISION
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

                    {/* =========================================
                        VIEW 6: ASSET VAULT
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView === "assets"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel asset-vault-panel">
                                <div className="panel-header asset-vault-header">
                                    <div>
                                        <span className="status-tag">
                                            CLOUDFLARE R2
                                        </span>

                                        <h3>
                                            CREATOR ASSET VAULT
                                        </h3>
                                    </div>

                                    <input
                                        type="text"
                                        className="dash-input asset-search-input"
                                        placeholder="Search assets..."
                                        value={
                                            assetSearch
                                        }
                                        onChange={(e) =>
                                            setAssetSearch(
                                                e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className="asset-vault-surface">
                                    <form
                                        onSubmit={uploadAsset}
                                        className="asset-upload-card"
                                    >
                                    <div className="asset-upload-card-header">
                                        <div>
                                            <span className="asset-upload-kicker">
                                                PRIVATE STORAGE
                                            </span>
                                            <strong>
                                                UPLOAD NEW ASSET
                                            </strong>
                                        </div>

                                        <span className="asset-upload-limit">
                                            MAX 5 GiB
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
                                        <p className="brief-error-msg active asset-upload-error">
                                            {
                                                assetUploadError
                                            }
                                        </p>
                                    )}

                                    <div className="asset-upload-footer">
                                        <span>
                                            Files upload directly
                                            from your browser to
                                            private Cloudflare R2.
                                        </span>

                                        <span>
                                            Deliverables and
                                            supporting files only
                                        </span>
                                    </div>
                                </form>

                                    {assetVersionError && (
                                        <p className="brief-error-msg active asset-upload-error">
                                            {assetVersionError}
                                        </p>
                                    )}

                                    <div className="asset-grid">
                                    {assetsLoading ? (
                                        <div className="asset-state-card">
                                            <span className="asset-state-icon">
                                                ◌
                                            </span>
                                            <strong>
                                                LOADING ASSETS...
                                            </strong>
                                        </div>
                                    ) : assetsError ? (
                                        <div className="asset-state-card asset-state-error">
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
                                            <div className="asset-empty-icon">
                                                📁
                                            </div>

                                            <div>
                                                <strong>
                                                    {assetSearch.trim()
                                                        ? "NO ASSETS FOUND"
                                                        : "ASSET VAULT EMPTY"}
                                                </strong>

                                                <p>
                                                    {assetSearch.trim()
                                                        ? "Try another file name or clear the search."
                                                        : "Upload a finished deliverable, thumbnail, document, audio file, or other supporting asset."}
                                                </p>
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
                                                        <div className="asset-icon">
                                                            {assetIcon(
                                                                asset.assetType
                                                            )}
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

                                                            {asset.content
                                                                ?.title && (
                                                                <small
                                                                    style={{
                                                                        display:
                                                                            "block",
                                                                        marginTop:
                                                                            "4px",
                                                                    }}
                                                                >
                                                                    {
                                                                        asset
                                                                            .content
                                                                            .title
                                                                    }
                                                                </small>
                                                            )}

                                                            {expandedAssetVersions[
                                                                asset.id
                                                            ] && (
                                                                <div
                                                                    style={{
                                                                        marginTop:
                                                                            "12px",
                                                                        display:
                                                                            "grid",
                                                                        gap:
                                                                            "8px",
                                                                    }}
                                                                >
                                                                    {versions.map(
                                                                        (version) => (
                                                                            <div
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
                                                                                        ? "STREAM"
                                                                                        : "DOWNLOAD"}
                                                                                </a>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div
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
                                                                    ? "STREAM LATEST"
                                                                    : "DOWNLOAD LATEST"}
                                                            </a>

                                                            <button
                                                                type="button"
                                                                className="asset-action"
                                                                onClick={() =>
                                                                    toggleAssetVersions(
                                                                        asset.id
                                                                    )
                                                                }
                                                            >
                                                                {expandedAssetVersions[
                                                                    asset.id
                                                                ]
                                                                    ? "HIDE VERSIONS"
                                                                    : `VERSIONS (${versions.length})`}
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

                                                            <label
                                                                htmlFor={
                                                                    versionInputId
                                                                }
                                                                className="asset-action"
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
                                                                    : "NEW VERSION"}
                                                            </label>

                                                            <button
                                                                type="button"
                                                                className="asset-action"
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
                                                                    : "DELETE"}
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

                    {/* =========================================
                        VIEW 7: ANALYTICS
                    ========================================= */}
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

                    {/* =========================================
                        VIEW 8: SETTINGS
                    ========================================= */}
                    <div
                        className={`view-panel ${currentView ===
                            "settings"
                            ? "active"
                            : ""
                            }`}
                    >
                        <div className="panel-scroll-container">
                            <div className="panel settings-panel">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            ACCOUNT CONTROL
                                        </span>
                                        <h3>
                                            ACCOUNT & WORKSPACE
                                        </h3>
                                    </div>

                                    <button
                                        type="button"
                                        className="text-link"
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
                                    <p className="brief-error-msg active">
                                        {settingsError}
                                    </p>
                                )}

                                {settingsSuccess && (
                                    <div
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
                                    <p className="text-link">
                                        Loading account
                                        settings…
                                    </p>
                                ) : (
                                    <div className="settings-grid">
                                        {/* PROFILE */}
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
                                                <strong>
                                                    PROFILE
                                                </strong>
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
                                                        className="dash-input"
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
                                                        className="dash-input"
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
                                                    CURRENT
                                                    PASSWORD
                                                    (ONLY NEEDED
                                                    TO CHANGE
                                                    EMAIL)
                                                </label>
                                                <input
                                                    type="password"
                                                    id="stgProfilePassword"
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
                                                />
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
                                                    : "SAVE PROFILE"}
                                            </button>
                                        </form>

                                        {/* WORKSPACE */}
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
                                                <strong>
                                                    WORKSPACE
                                                </strong>
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
                                                        className="dash-input"
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
                                                        : "SAVE WORKSPACE"}
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

                                        {/* SECURITY */}
                                        <form
                                            className="settings-form settings-card"
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
                                                <strong>
                                                    SECURITY
                                                </strong>
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
                                                        id="stgNewPassword"
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
                                                    />
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
                                                    : "CHANGE PASSWORD"}
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

                                        {/* APPEARANCE + SESSION */}
                                        <div
                                            className="settings-form settings-card"
                                        >
                                            <strong>
                                                APPEARANCE &
                                                SESSION
                                            </strong>

                                            <div
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
                                                    type="button"
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
                                                    type="button"
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

                                                <button
                                                    type="button"
                                                    className="action-btn"
                                                    onClick={confirmAndSignOut}
                                                >
                                                    SIGN OUT ↗
                                                </button>
                                            </div>

                                            <p
                                                className="text-link"
                                                style={{
                                                    marginTop:
                                                        "12px",
                                                }}
                                            >
                                                Theme preference
                                                is stored on this
                                                browser.
                                                Account deletion
                                                is not enabled in
                                                this version.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </main>
            </div>

            {/* =========================================
                NEW PROJECT BRIEF MODAL
            ========================================= */}
            <div
                className={`modal-overlay ${briefModalOpen
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
                <div className="brief-card">
                    <button
                        className="modal-close"
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

                        <h3>
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
                            />

                            <p
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