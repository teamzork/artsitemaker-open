const nameInput = document.getElementById(
    "project-name",
) as HTMLInputElement | null;
const statusEl = document.getElementById("project-status");
const continueBtn = document.getElementById(
    "project-continue-btn",
) as HTMLButtonElement | null;
const skipBtn = document.getElementById(
    "project-skip-btn",
) as HTMLButtonElement | null;
const skipWrap = document.getElementById("project-skip-wrap");

function getDefaultProjectName() {
    return (
        nameInput?.dataset.defaultName ||
        nameInput?.placeholder ||
        "My Portfolio"
    );
}

function getProjectTitle(useDefault = false) {
    const defaultName = getDefaultProjectName();
    if (useDefault) {
        return defaultName;
    }
    const raw = nameInput?.value?.trim() || "";
    return raw || defaultName;
}

function setStatus(message: string, tone: "muted" | "error" = "muted") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove(
        "text-admin-muted",
        "text-admin-error",
        "text-admin-success",
    );
    if (tone === "error") {
        statusEl.classList.add("text-admin-error");
    } else {
        statusEl.classList.add("text-admin-muted");
    }
}

function updateSkipVisibility() {
    if (!skipWrap || !nameInput) return;
    const trimmed = nameInput.value.trim();
    const hide = trimmed.length >= 2;
    skipWrap.classList.toggle("opacity-0", hide);
    skipWrap.classList.toggle("pointer-events-none", hide);
    skipWrap.classList.toggle("max-h-0", hide);
    skipWrap.classList.toggle("translate-y-1", hide);
}

function saveProjectTitle(useDefault = false) {
    const projectTitle = getProjectTitle(useDefault);

    if (!projectTitle) {
        setStatus("Project name is required.", "error");
        return;
    }

    sessionStorage.setItem("setup:new:projectTitle", projectTitle);
    window.location.href = "/tools/setup/new/theme";
}

nameInput?.addEventListener("input", updateSkipVisibility);
continueBtn?.addEventListener("click", () => saveProjectTitle(false));
skipBtn?.addEventListener("click", () => saveProjectTitle(true));

updateSkipVisibility();
