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
    const [reviewNote, setReviewNote] = useState("");

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

    // =========================
    // PROJECT STATUS HELPERS
    // =========================
    const normalizeProjectStatus = (status) => {
        const legacyStatusMap = {
            rendering: "IN_PRODUCTION",
            review: "IN_REVIEW",
            queued: "REQUESTED",
            completed: "PUBLISHED",
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
            SCHEDULED: "SCHEDULED",
            PUBLISHED: "DELIVERED",
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
            const payload = canManageAssignments
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
        if (!canManageAssignments) {
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

    const openProjectDetails = async (project) => {
        setSelectedProject(null);
        setProjectDetailsError(null);
        setAssignmentsError(null);
        setTasksError(null);
        setTasks([]);
        setTaskDrafts({});
        setCanManageAssignments(false);
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

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (activeOrganizationId) {
            loadProjects(activeOrganizationId);
            loadCreators(activeOrganizationId);
            loadAssets(activeOrganizationId);
        } else if (!organizationsLoading) {
            // No accessible organization means there is nothing left to
            // fetch, so finish the dependent loading states.
            setProjects([]);
            setCreators([]);
            setAssets([]);

            setProjectsError(null);
            setCreatorsError(null);
            setAssetsError(null);

            setProjectsLoading(false);
            setCreatorsLoading(false);
            setAssetsLoading(false);
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

        if (
            !link.includes("http://") &&
            !link.includes("https://")
        ) {
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

        return `${type} • ${formatAssetSize(asset.fileSize)}`;
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

    return (
        <>
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
                            {(user?.name ||
                                "Nexus Studio")
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
                                {user?.name ||
                                    "Nexus Studio"}
                            </strong>

                            <small>
                                {accountType} ACCOUNT
                            </small>
                        </div>

                        <a
                            href="/"
                            className="logout-btn"
                            title="Log Out"
                            onClick={(e) => {
                                e.preventDefault();

                                signOut({
                                    callbackUrl:
                                        "/",
                                });
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
                                                            "SCHEDULED",
                                                            "PUBLISHED",
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
                                    <span className="metric-label">DELIVERED</span>
                                    <strong className="metric-value">
                                        {projectsLoading
                                            ? "—"
                                            : String(
                                                projects.filter(
                                                    (p) =>
                                                        normalizeProjectStatus(p.status) ===
                                                        "PUBLISHED"
                                                ).length
                                            ).padStart(2, "0")}
                                    </strong>
                                    <span className="metric-delta">Published projects</span>
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
                                                            className="project-item"
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
                                                                className={`project-status ${proj.status}`}
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
                                    </div>

                                    <div style={{ padding: "18px 0" }}>
                                        <strong>NO ACTIVITY YET</strong>
                                        <p
                                            className="text-link"
                                            style={{ marginTop: "8px" }}
                                        >
                                            Project and account activity will appear here once the activity log is connected.
                                        </p>
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
                                            "SCHEDULED",
                                            "PUBLISHED",
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
                                                        className="table-row"
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
                                                                className={`project-status ${proj.status}`}
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
                                                                            "PUBLISHED"
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
                                        <div className="project-list">
                                            {creators.map(
                                                (
                                                    creator
                                                ) => (
                                                    <div
                                                        className="project-item"
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
                                        <div className="metrics-grid">
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
                                                                    "SCHEDULED",
                                                                    "PUBLISHED",
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
                                                    DELIVERED
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
                                                                "PUBLISHED"
                                                        ).length
                                                    }
                                                </strong>

                                                <span className="metric-delta">
                                                    Completed
                                                    content
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

                                    <button
                                        type="button"
                                        className="action-btn"
                                        onClick={() => {
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

                                                {isEditor &&
                                                    canManageAssignments && (
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

                                                                    return (
                                                                        <div
                                                                            key={
                                                                                task.id
                                                                            }
                                                                            style={{
                                                                                padding:
                                                                                    "16px",
                                                                                border:
                                                                                    "1px solid var(--line)",
                                                                                borderRadius:
                                                                                    "8px",
                                                                            }}
                                                                        >
                                                                            <div className="panel-header">
                                                                                <div>
                                                                                    <span className="status-tag">
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
                                                                                    className={`project-status ${draft.status}`}
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
                                                                                            !canManageAssignments
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
                                                                                            !isEditor ||
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
                                                                                            !canManageAssignments
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
                                                                                            !canManageAssignments
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

                                                                                {canManageAssignments ? (
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
                                                                                        !canManageAssignments
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

                                                                            {isEditor && (
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
                                                                                            : canManageAssignments
                                                                                                ? "SAVE TASK"
                                                                                                : "SAVE STATUS"}
                                                                                    </button>

                                                                                    {canManageAssignments && (
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

                                            {/* RAW FOOTAGE */}
                                            <div
                                                className="panel"
                                                style={{
                                                    marginTop:
                                                        "20px",
                                                }}
                                            >
                                                <div className="panel-header">
                                                    <h3>
                                                        RAW
                                                        FOOTAGE
                                                    </h3>

                                                    {selectedProject
                                                        .content
                                                        ?.footageLink && (
                                                            <a
                                                                href={
                                                                    selectedProject
                                                                        .content
                                                                        .footageLink
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="action-btn active"
                                                            >
                                                                OPEN
                                                                FOOTAGE
                                                                ↗
                                                            </a>
                                                        )}
                                                </div>

                                                {selectedProject
                                                    .content
                                                    ?.footageLink ? (
                                                    <p className="text-link">
                                                        {
                                                            selectedProject
                                                                .content
                                                                .footageLink
                                                        }
                                                    </p>
                                                ) : (
                                                    <p className="text-link">
                                                        No raw
                                                        footage
                                                        link was
                                                        attached
                                                        to this
                                                        project.
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
                                                        [
                                                            "SCHEDULED",
                                                            "SCHEDULED",
                                                        ],
                                                        [
                                                            "PUBLISHED",
                                                            "PUBLISHED",
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
                                                                    "SCHEDULED",
                                                                    "PUBLISHED",
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

                                            {/* REVIEW */}
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
                                                            EDITOR
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

                                                {/* REVIEW HISTORY */}
                                                {selectedProject
                                                    .reviews
                                                    ?.length >
                                                    0 && (
                                                        <div
                                                            style={{
                                                                display:
                                                                    "grid",
                                                                gap: "12px",
                                                                marginBottom:
                                                                    "20px",
                                                            }}
                                                        >
                                                            {selectedProject.reviews.map(
                                                                (
                                                                    review
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            review.id
                                                                        }
                                                                        style={{
                                                                            padding:
                                                                                "14px",
                                                                            border:
                                                                                "1px solid var(--line)",
                                                                            borderRadius:
                                                                                "8px",
                                                                        }}
                                                                    >
                                                                        <div
                                                                            style={{
                                                                                display:
                                                                                    "flex",
                                                                                justifyContent:
                                                                                    "space-between",
                                                                                gap: "12px",
                                                                            }}
                                                                        >
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

                                                                        <p
                                                                            style={{
                                                                                marginTop:
                                                                                    "8px",
                                                                            }}
                                                                        >
                                                                            {review.notes ||
                                                                                "No review notes."}
                                                                        </p>

                                                                        <small>
                                                                            By{" "}
                                                                            {review
                                                                                .author
                                                                                ?.name ||
                                                                                review
                                                                                    .author
                                                                                    ?.email ||
                                                                                "Unknown reviewer"}
                                                                        </small>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}

                                                {/* EDITOR REVIEW CONTROLS */}
                                                {isEditor &&
                                                    [
                                                        "IN_REVIEW",
                                                        "REVISION",
                                                    ].includes(
                                                        normalizeProjectStatus(
                                                            selectedProject
                                                                .content
                                                                ?.status
                                                        )
                                                    ) && (
                                                        <>
                                                            <div className="form-field">
                                                                <label htmlFor="reviewNote">
                                                                    REVIEW
                                                                    NOTES
                                                                </label>

                                                                <textarea
                                                                    id="reviewNote"
                                                                    className="dash-input"
                                                                    value={
                                                                        reviewNote
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setReviewNote(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    }
                                                                    placeholder="Tell the creator what needs to change, or leave notes for approval..."
                                                                    rows={
                                                                        5
                                                                    }
                                                                />
                                                            </div>

                                                            <div
                                                                style={{
                                                                    display:
                                                                        "flex",
                                                                    gap: "10px",
                                                                    flexWrap:
                                                                        "wrap",
                                                                    marginTop:
                                                                        "15px",
                                                                }}
                                                            >
                                                                {/* APPROVE */}
                                                                <button
                                                                    type="button"
                                                                    className="button button-primary"
                                                                    disabled={
                                                                        projectStatusUpdating
                                                                    }
                                                                    onClick={async () => {
                                                                        setProjectStatusUpdating(
                                                                            true
                                                                        );

                                                                        try {
                                                                            const res =
                                                                                await fetch(
                                                                                    `/api/projects/${selectedProject.content.id}`,
                                                                                    {
                                                                                        method: "PATCH",
                                                                                        headers: {
                                                                                            "Content-Type":
                                                                                                "application/json",
                                                                                        },
                                                                                        body: JSON.stringify(
                                                                                            {
                                                                                                status:
                                                                                                    "APPROVED",
                                                                                                reviewNotes:
                                                                                                    reviewNote,
                                                                                            }
                                                                                        ),
                                                                                    }
                                                                                );

                                                                            const data =
                                                                                await res.json();

                                                                            if (
                                                                                !res.ok
                                                                            ) {
                                                                                throw new Error(
                                                                                    data.error ||
                                                                                    "Failed to approve project."
                                                                                );
                                                                            }

                                                                            await loadProjectDetails(
                                                                                selectedProject
                                                                                    .content
                                                                                    .id
                                                                            );

                                                                            if (
                                                                                selectedCreator
                                                                            ) {
                                                                                await loadCreatorProjects(
                                                                                    selectedCreator.id
                                                                                );
                                                                            } else {
                                                                                await loadProjects(
                                                                                    activeOrganizationId
                                                                                );
                                                                            }

                                                                            setReviewNote(
                                                                                ""
                                                                            );
                                                                        } catch (
                                                                        err
                                                                        ) {
                                                                            console.error(
                                                                                err
                                                                            );

                                                                            setProjectDetailsError(
                                                                                err.message ||
                                                                                "Failed to approve project."
                                                                            );
                                                                        } finally {
                                                                            setProjectStatusUpdating(
                                                                                false
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    {projectStatusUpdating
                                                                        ? "UPDATING…"
                                                                        : "✓ APPROVE CUT"}
                                                                </button>

                                                                {/* REQUEST REVISION */}
                                                                <button
                                                                    type="button"
                                                                    className="action-btn active"
                                                                    disabled={
                                                                        projectStatusUpdating
                                                                    }
                                                                    onClick={async () => {
                                                                        setProjectStatusUpdating(
                                                                            true
                                                                        );

                                                                        try {
                                                                            const res =
                                                                                await fetch(
                                                                                    `/api/projects/${selectedProject.content.id}`,
                                                                                    {
                                                                                        method: "PATCH",
                                                                                        headers: {
                                                                                            "Content-Type":
                                                                                                "application/json",
                                                                                        },
                                                                                        body: JSON.stringify(
                                                                                            {
                                                                                                status:
                                                                                                    "REVISION",
                                                                                                reviewNotes:
                                                                                                    reviewNote,
                                                                                            }
                                                                                        ),
                                                                                    }
                                                                                );

                                                                            const data =
                                                                                await res.json();

                                                                            if (
                                                                                !res.ok
                                                                            ) {
                                                                                throw new Error(
                                                                                    data.error ||
                                                                                    "Failed to request revision."
                                                                                );
                                                                            }

                                                                            await loadProjectDetails(
                                                                                selectedProject
                                                                                    .content
                                                                                    .id
                                                                            );

                                                                            if (
                                                                                selectedCreator
                                                                            ) {
                                                                                await loadCreatorProjects(
                                                                                    selectedCreator.id
                                                                                );
                                                                            } else {
                                                                                await loadProjects(
                                                                                    activeOrganizationId
                                                                                );
                                                                            }

                                                                            setReviewNote(
                                                                                ""
                                                                            );
                                                                        } catch (
                                                                        err
                                                                        ) {
                                                                            console.error(
                                                                                err
                                                                            );

                                                                            setProjectDetailsError(
                                                                                err.message ||
                                                                                "Failed to request revision."
                                                                            );
                                                                        } finally {
                                                                            setProjectStatusUpdating(
                                                                                false
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    ↻ REQUEST
                                                                    REVISION
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}

                                                {/* NON-REVIEW STATE */}
                                                {(!isEditor ||
                                                    ![
                                                        "IN_REVIEW",
                                                        "REVISION",
                                                    ].includes(
                                                        normalizeProjectStatus(
                                                            selectedProject
                                                                .content
                                                                ?.status
                                                        )
                                                    )) && (
                                                        <p className="text-link">
                                                            {isEditor
                                                                ? "This project is not currently awaiting review."
                                                                : "Review actions are managed by the production team."}
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
                            <div className="panel">
                                <div className="panel-header">
                                    <h3>
                                        CREATOR ASSET VAULT
                                    </h3>

                                    <input
                                        type="text"
                                        className="dash-input"
                                        placeholder="Search 3D models, footage, overlays..."
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

                                <div className="asset-grid">
                                    {assetsLoading ? (
                                        <div
                                            style={{
                                                gridColumn: "1 / -1",
                                                padding: "30px",
                                                textAlign: "center",
                                                color: "var(--muted)",
                                            }}
                                        >
                                            LOADING ASSETS...
                                        </div>
                                    ) : assetsError ? (
                                        <div
                                            style={{
                                                gridColumn: "1 / -1",
                                                padding: "30px",
                                                textAlign: "center",
                                                color: "var(--muted)",
                                            }}
                                        >
                                            <p>{assetsError}</p>

                                            <button
                                                type="button"
                                                className="action-btn active"
                                                style={{ marginTop: "12px" }}
                                                onClick={() =>
                                                    loadAssets(activeOrganizationId)
                                                }
                                            >
                                                RETRY
                                            </button>
                                        </div>
                                    ) : assets.length === 0 ? (
                                        <div
                                            style={{
                                                gridColumn: "1 / -1",
                                                padding: "40px 20px",
                                                textAlign: "center",
                                                color: "var(--muted)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "28px",
                                                    marginBottom: "10px",
                                                }}
                                            >
                                                📁
                                            </div>

                                            <strong>
                                                {assetSearch.trim()
                                                    ? "NO ASSETS FOUND"
                                                    : "ASSET VAULT EMPTY"}
                                            </strong>

                                            <p
                                                style={{
                                                    marginTop: "8px",
                                                    fontSize: "13px",
                                                }}
                                            >
                                                {assetSearch.trim()
                                                    ? "Try a different search."
                                                    : "Uploaded project assets will appear here."}
                                            </p>
                                        </div>
                                    ) : (
                                        assets.map((asset) => (
                                            <div
                                                className="asset-card"
                                                key={asset.id}
                                            >
                                                <div className="asset-icon">
                                                    {assetIcon(asset.assetType)}
                                                </div>

                                                <div className="asset-details">
                                                    <strong>
                                                        {asset.fileName}
                                                    </strong>

                                                    <small>
                                                        {assetMeta(asset)}
                                                    </small>

                                                    {asset.content?.title && (
                                                        <small
                                                            style={{
                                                                display: "block",
                                                                marginTop: "4px",
                                                            }}
                                                        >
                                                            {asset.content.title}
                                                        </small>
                                                    )}
                                                </div>

                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "6px",
                                                    }}
                                                >
                                                    {asset.storageKey ? (
                                                        <a
                                                            className="asset-action"
                                                            href={asset.storageKey}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={
                                                                asset.assetType === "VIDEO"
                                                                    ? undefined
                                                                    : asset.fileName
                                                            }
                                                        >
                                                            {asset.assetType === "VIDEO"
                                                                ? "STREAM"
                                                                : "DOWNLOAD"}
                                                        </a>
                                                    ) : (
                                                        <span className="asset-action">
                                                            UNAVAILABLE
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
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
                        <div className="panel-scroll-container">
                            <div className="panel analytics-panel">
                                <div className="panel-header">
                                    <div>
                                        <span className="status-tag">
                                            ANALYTICS
                                        </span>

                                        <h3>
                                            PERFORMANCE ANALYTICS
                                        </h3>
                                    </div>
                                </div>

                                <div className="analytics-empty-state">
                                    <div className="analytics-empty-icon">
                                        📊
                                    </div>

                                    <strong>
                                        NO ANALYTICS DATA YET
                                    </strong>

                                    <p>
                                        Creator platform analytics have not been connected yet.
                                        Views, watch time, audience growth and content performance
                                        will appear here when integrations are added.
                                    </p>
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
                                <h3>ACCOUNT & WORKSPACE</h3>

                                <div className="settings-form">
                                    <div className="form-row">
                                        <div className="form-field">
                                            <label htmlFor="stgName">ACCOUNT NAME</label>
                                            <input
                                                type="text"
                                                id="stgName"
                                                className="dash-input"
                                                value={user?.name || ""}
                                                readOnly
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label htmlFor="stgEmail">PRIMARY EMAIL</label>
                                            <input
                                                type="email"
                                                id="stgEmail"
                                                className="dash-input"
                                                value={user?.email || ""}
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-field">
                                            <label htmlFor="stgAccountType">ACCOUNT TYPE</label>
                                            <input
                                                type="text"
                                                id="stgAccountType"
                                                className="dash-input"
                                                value={accountType}
                                                readOnly
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label htmlFor="stgWorkspace">WORKSPACE</label>
                                            <input
                                                type="text"
                                                id="stgWorkspace"
                                                className="dash-input"
                                                value={
                                                    organizations.find(
                                                        (organization) =>
                                                            organization.id === activeOrganizationId
                                                    )?.name || ""
                                                }
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    <p className="text-link">
                                        Editable account preferences will be enabled when the settings API is connected.
                                    </p>
                                </div>
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
                                RAW FOOTAGE LINK /
                                DRIVE
                            </label>

                            <input
                                type="text"
                                id="briefLink"
                                name="briefLink"
                                className="dash-input"
                                placeholder="https://youtube.com/... or https://drive.google.com/..."
                                required
                            />

                            <p
                                className={`brief-error-msg ${briefError
                                    ? "active"
                                    : ""
                                    }`}
                            >
                                Please enter a valid
                                URL, or check your
                                connection and try
                                again.
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