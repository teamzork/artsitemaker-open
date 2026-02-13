const addBtn = document.getElementById(
    "add-artwork-btn",
) as HTMLButtonElement | null;
const emptyBtn = document.getElementById(
    "start-empty-btn",
) as HTMLButtonElement | null;
const contentStatusEl = document.getElementById("content-status");

function setContentStatus(message: string, tone: "muted" | "error" = "muted") {
    if (!contentStatusEl) return;
    contentStatusEl.textContent = message;
    contentStatusEl.classList.remove("text-admin-muted", "text-admin-error");
    contentStatusEl.classList.add(
        tone === "error" ? "text-admin-error" : "text-admin-muted",
    );
}

function setBusy(isBusy: boolean) {
    if (addBtn) addBtn.disabled = isBusy;
    if (emptyBtn) emptyBtn.disabled = isBusy;
}

function getSetupData() {
    const projectTitle = sessionStorage.getItem("setup:new:projectTitle") || "";
    const themeId = sessionStorage.getItem("setup:new:themeId") || "";
    return { projectTitle, themeId };
}

async function finalizeSetup(nextPath: string) {
    const { projectTitle, themeId } = getSetupData();

    if (!projectTitle) {
        setContentStatus("Missing project name. Go back to Step 1.", "error");
        return;
    }

    setBusy(true);
    setContentStatus("Creating project...");

    try {
        const scaffoldRes = await fetch("/api/system/scaffold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectName: projectTitle }),
        });

        const scaffoldData = await scaffoldRes.json();
        if (!scaffoldRes.ok) {
            throw new Error(
                scaffoldData?.error || "Failed to create project.",
            );
        }

        if (!scaffoldData?.path) {
            throw new Error("Project created, but path was not returned.");
        }

        const pathRes = await fetch("/api/user-data-path", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                path: scaffoldData.path,
                projectName: scaffoldData.projectName,
            }),
        });

        const pathData = await pathRes.json();
        if (!pathRes.ok) {
            throw new Error(
                pathData?.error || "Failed to set user data path.",
            );
        }

        const settingsPayload: Record<string, string> = {
            "site.title": projectTitle,
        };
        if (themeId) {
            settingsPayload.theme = themeId;
        }

        const settingsRes = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingsPayload),
        });

        if (!settingsRes.ok) {
            window.dispatchEvent(
                new CustomEvent("artsitemaker:toast", {
                    detail: {
                        title: "Project created, but settings could not be saved.",
                        variant: "warning",
                    },
                }),
            );
        }

        sessionStorage.removeItem("setup:new:projectTitle");
        sessionStorage.removeItem("setup:new:themeId");

        window.dispatchEvent(
            new CustomEvent("artsitemaker:toast", {
                detail: {
                    title: "Project created",
                    variant: "success",
                },
            }),
        );

        window.location.href = nextPath;
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Something went wrong while creating the project.";
        setContentStatus(message, "error");
        window.dispatchEvent(
            new CustomEvent("artsitemaker:toast", {
                detail: {
                    title: message,
                    variant: "destructive",
                },
            }),
        );
    } finally {
        setBusy(false);
    }
}

function initialize() {
    const { projectTitle } = getSetupData();
    if (!projectTitle) {
        setContentStatus("Missing project name. Go back to Step 1.", "error");
        setBusy(true);
    }
}

addBtn?.addEventListener("click", () => finalizeSetup("/gallery/upload"));
emptyBtn?.addEventListener("click", () => finalizeSetup("/gallery"));

initialize();
