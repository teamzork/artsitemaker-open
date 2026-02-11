interface ChangeDetector {
  checkForChanges: () => void;
}

interface AssetLibraryItem {
  path: string;
  filename?: string;
  url?: string;
}

interface AssetLibraryConfig {
  label: string;
  apiEndpoint: string;
  responseKey: string;
  gridEl: HTMLElement | null;
  emptyEl: HTMLElement | null;
  statusEl: HTMLElement | null;
  refreshBtn: HTMLElement | null;
  itemClass: string;
  thumbClass: string;
  nameClass: string;
  dataAttr: string;
  getCurrentPath: () => string;
  getItemUrl: (item: AssetLibraryItem) => string;
  getItemName: (item: AssetLibraryItem) => string;
  onSelect: (path: string, url: string) => void;
}

interface AssetDeletionConfig {
  apiEndpoint: string;
  hiddenInput: HTMLInputElement | null;
  modalId: string;
  pathInputId: string;
  onSuccess?: () => void;
  updateSettings?: () => Promise<void>;
}

export class IdentityKitManager {
  private changeDetector: ChangeDetector;
  private tempTexturePath: string | null = null;
  private cleanupHandlers: Array<() => void> = [];
  private logoLibrary: { load: () => void } | null = null;
  private textureLibrary: { load: () => void } | null = null;
  private textureHiddenInput: HTMLInputElement | null = null;

  constructor({ changeDetector }: { changeDetector: ChangeDetector }) {
    this.changeDetector = changeDetector;
  }

  init() {
    this.initColorSync();
    this.initLogoManager();
    this.initTextureManager();
  }

  async commitPendingTexture(updateStatus?: (text: string) => void) {
    if (!this.tempTexturePath || !this.tempTexturePath.startsWith(".temp/")) {
      return;
    }

    updateStatus?.("Committing files...");

    const commitRes = await fetch("/api/identity/texture", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempPath: this.tempTexturePath }),
    });

    const commitData = await commitRes.json();

    if (commitRes.ok && commitData.success) {
      if (this.textureHiddenInput)
        this.textureHiddenInput.value = commitData.path;
      this.tempTexturePath = null;
      this.textureLibrary?.load();
      return;
    }

    throw new Error("Failed to commit texture file");
  }

  cleanup() {
    this.cleanupHandlers.forEach((remove) => remove());
    this.cleanupHandlers = [];
  }

  private addListener<T extends EventTarget>(
    target: T | null,
    type: string,
    handler: EventListenerOrEventListenerObject,
  ) {
    if (!target) return;
    target.addEventListener(type, handler);
    this.cleanupHandlers.push(() => target.removeEventListener(type, handler));
  }

  private initColorSync() {
    document.querySelectorAll<HTMLInputElement>(".color-input").forEach((input) => {
      this.addListener(input, "input", (event) => {
        const target = event.target as HTMLInputElement;
        const textInput = target.parentElement?.querySelector(
          ".color-text",
        ) as HTMLInputElement;
        if (textInput) textInput.value = target.value;
      });
    });
  }

  private initLogoManager() {
    const logoDropzone = document.getElementById("logo-dropzone");
    const logoFileInput = document.getElementById(
      "logo-file-upload",
    ) as HTMLInputElement | null;
    const logoHiddenInput = document.getElementById(
      "logo-file-input",
    ) as HTMLInputElement | null;
    const logoUploadStatus = document.getElementById("logo-upload-status");
    const logoPreview = document.getElementById(
      "logo-preview",
    ) as HTMLImageElement | null;
    const logoPreviewPlaceholder = document.getElementById(
      "logo-preview-placeholder",
    );
    const clearLogoBtn = document.getElementById("clear-logo-btn");
    const logoLibraryGrid = document.getElementById("logo-library-grid");
    const logoLibraryEmpty = document.getElementById("logo-library-empty");
    const logoLibraryStatus = document.getElementById("logo-library-status");
    const logoLibraryRefresh = document.getElementById("logo-library-refresh");
    const deleteLogoModal = document.getElementById("delete-logo-modal");

    const showLogoStatus = (
      message: string,
      type: "info" | "success" | "error",
    ) => {
      if (!logoUploadStatus) return;

      logoUploadStatus.textContent = message;
      logoUploadStatus.classList.remove(
        "hidden",
        "text-admin-muted",
        "text-green-400",
        "text-red-400",
      );

      switch (type) {
        case "success":
          logoUploadStatus.classList.add("text-green-400");
          break;
        case "error":
          logoUploadStatus.classList.add("text-red-400");
          break;
        default:
          logoUploadStatus.classList.add("text-admin-muted");
      }
    };

    const updateLogoPreview = (url: string) => {
      if (logoPreviewPlaceholder)
        logoPreviewPlaceholder.style.display = "none";

      if (logoPreview) {
        logoPreview.src = url;
        logoPreview.style.display = "block";
        return;
      }

      const container = document.getElementById("logo-preview-container");
      if (container) {
        const img = document.createElement("img");
        img.id = "logo-preview";
        img.src = url;
        img.alt = "Logo preview";
        img.className = "media-preview-image contain";
        container.innerHTML = "";
        container.appendChild(img);
      }
    };

    const uploadLogo = async (file: File) => {
      if (!logoDropzone || !logoUploadStatus) return;

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        showLogoStatus(
          "Invalid file type. Use PNG, JPG, WebP, or SVG.",
          "error",
        );
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showLogoStatus("File too large. Max size is 5MB.", "error");
        return;
      }

      logoDropzone.classList.add("uploading");
      showLogoStatus("Uploading...", "info");

      try {
        const formData = new FormData();
        formData.append("logo", file);

        const res = await fetch("/api/identity/logo", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.success) {
          if (logoHiddenInput) logoHiddenInput.value = data.path;

          updateLogoPreview(data.url);

          showLogoStatus(`✓ Uploaded: ${data.filename}`, "success");

          if (clearLogoBtn) clearLogoBtn.style.display = "inline-block";

          this.changeDetector.checkForChanges();

          this.logoLibrary?.load();

          window.dispatchEvent(
            new CustomEvent("artsitemaker:toast", {
              detail: { title: "Logo uploaded successfully", variant: "success" },
            }),
          );
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } catch (e: any) {
        showLogoStatus(`✗ ${e.message}`, "error");
        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: { title: "Logo upload failed", variant: "destructive" },
          }),
        );
      } finally {
        logoDropzone.classList.remove("uploading");
        if (logoFileInput) logoFileInput.value = "";
      }
    };

    this.addListener(logoDropzone, "click", () => {
      logoFileInput?.click();
    });

    this.addListener(logoDropzone, "keydown", (event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        logoFileInput?.click();
      }
    });

    this.addListener(logoFileInput, "change", async () => {
      const file = logoFileInput?.files?.[0];
      if (!file) return;
      await uploadLogo(file);
    });

    this.addListener(logoDropzone, "dragover", (event) => {
      event.preventDefault();
      logoDropzone?.classList.add("drag-over");
    });

    this.addListener(logoDropzone, "dragleave", () => {
      logoDropzone?.classList.remove("drag-over");
    });

    this.addListener(logoDropzone, "drop", async (event) => {
      event.preventDefault();
      logoDropzone?.classList.remove("drag-over");
      const dropEvent = event as DragEvent;
      const file = dropEvent.dataTransfer?.files?.[0];
      if (!file) return;
      await uploadLogo(file);
    });

    this.logoLibrary = this.initAssetLibrary({
      label: "logo",
      apiEndpoint: "/api/identity/logo",
      responseKey: "logos",
      gridEl: logoLibraryGrid,
      emptyEl: logoLibraryEmpty,
      statusEl: logoLibraryStatus,
      refreshBtn: logoLibraryRefresh,
      itemClass: "logo-library-item",
      thumbClass: "logo-library-thumb",
      nameClass: "logo-library-name",
      dataAttr: "data-logo-path",
      getCurrentPath: () => logoHiddenInput?.value || "",
      getItemUrl: (item) => item.url || `/user-assets/${item.path}`,
      getItemName: (item) => item.filename || item.path,
      onSelect: (path, url) => {
        if (logoHiddenInput) logoHiddenInput.value = path;
        updateLogoPreview(url);
        if (clearLogoBtn) clearLogoBtn.style.display = "inline-block";
        this.changeDetector.checkForChanges();
      },
    });

    this.logoLibrary?.load();

    if (clearLogoBtn) {
      this.addListener(clearLogoBtn, "click", () => {
        const currentLogoPath = logoHiddenInput?.value;

        if (!currentLogoPath) return;

        const logoPathInput = document.getElementById(
          "delete-logo-path",
        ) as HTMLInputElement;
        if (logoPathInput) logoPathInput.value = currentLogoPath;

        if (deleteLogoModal && (deleteLogoModal as any).open) {
          (deleteLogoModal as any).open();
        }
      });
    }

    this.addListener(deleteLogoModal, "confirm", async () => {
      try {
        await this.deleteAsset({
          apiEndpoint: "/api/identity/logo",
          hiddenInput: logoHiddenInput,
          modalId: "delete-logo-modal",
          pathInputId: "delete-logo-path",
          onSuccess: () => {
            if (logoPreview) logoPreview.style.display = "none";
            if (logoPreviewPlaceholder)
              logoPreviewPlaceholder.style.display = "flex";
            if (clearLogoBtn) clearLogoBtn.style.display = "none";
            this.logoLibrary?.load();
          },
          updateSettings: async () => {
            const settingsRes = await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identityKit: {
                  logo: {
                    file: null,
                  },
                },
              }),
            });

            if (!settingsRes.ok) {
              throw new Error("Failed to update settings");
            }
          },
        });

        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: { title: "Logo deleted successfully", variant: "success" },
          }),
        );
      } catch (e: any) {
        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: {
              title: `Failed to delete logo: ${e.message}`,
              variant: "destructive",
            },
          }),
        );
      }
    });
  }

  private initTextureManager() {
    const textureDropzone = document.getElementById("texture-dropzone");
    const textureFileUpload = document.getElementById(
      "texture-file-upload",
    ) as HTMLInputElement | null;
    const textureHiddenInput = document.getElementById(
      "texture-file-input",
    ) as HTMLInputElement | null;
    const textureUploadStatus = document.getElementById("texture-upload-status");
    const clearTextureBtn = document.getElementById("clear-texture-btn");
    const texturePreviewPlaceholder = document.getElementById(
      "texture-preview-placeholder",
    );
    const texturePreviewContainer = document.getElementById(
      "texture-preview-container",
    );
    const textureLibraryGrid = document.getElementById("texture-library-grid");
    const textureLibraryEmpty = document.getElementById(
      "texture-library-empty",
    );
    const textureLibraryStatus = document.getElementById(
      "texture-library-status",
    );
    const textureLibraryRefresh = document.getElementById(
      "texture-library-refresh",
    );
    const deleteTextureModal = document.getElementById("delete-texture-modal");

    this.textureHiddenInput = textureHiddenInput;

    const updateTexturePreview = (url: string) => {
      if (!texturePreviewContainer) return;

      if (texturePreviewPlaceholder)
        texturePreviewPlaceholder.style.display = "none";

      let previewImg = texturePreviewContainer.querySelector(
        "img",
      ) as HTMLImageElement;
      if (!previewImg) {
        previewImg = document.createElement("img");
        previewImg.id = "texture-preview";
        previewImg.alt = "Background preview";
        previewImg.className = "media-preview-image cover";
        texturePreviewContainer.appendChild(previewImg);
      }
      previewImg.src = url;
    };

    const showTextureStatus = (
      message: string,
      type: "info" | "success" | "error",
    ) => {
      if (!textureUploadStatus) return;

      textureUploadStatus.textContent = message;
      textureUploadStatus.classList.remove(
        "hidden",
        "text-admin-muted",
        "text-green-400",
        "text-red-400",
      );

      switch (type) {
        case "success":
          textureUploadStatus.classList.add("text-green-400");
          break;
        case "error":
          textureUploadStatus.classList.add("text-red-400");
          break;
        default:
          textureUploadStatus.classList.add("text-admin-muted");
      }

      textureUploadStatus.classList.remove("hidden");

      if (type !== "error") {
        setTimeout(() => {
          textureUploadStatus?.classList.add("hidden");
        }, 3000);
      }
    };

    const uploadTexture = async (file: File) => {
      if (!textureDropzone || !textureUploadStatus) return;

      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        showTextureStatus("Invalid file type. Use PNG, JPG, or WebP.", "error");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showTextureStatus("File too large. Maximum size is 10MB.", "error");
        return;
      }

      try {
        showTextureStatus("⏳ Uploading...", "info");
        textureDropzone.classList.add("uploading");

        if (this.tempTexturePath) {
          try {
            await fetch("/api/identity/texture", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: this.tempTexturePath }),
            });
          } catch (e) {
            console.warn("Failed to clean up old temp file:", e);
          }
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("temporary", "true");

        const res = await fetch("/api/identity/texture", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok && data.success) {
          this.tempTexturePath = data.path;

          if (textureHiddenInput) textureHiddenInput.value = data.path;

          const previewUrl = this.resolveTexturePreviewUrl(data.path);
          updateTexturePreview(previewUrl);

          if (clearTextureBtn) clearTextureBtn.style.display = "block";

          this.changeDetector.checkForChanges();

          showTextureStatus(`✓ Uploaded: ${data.filename} (temp)`, "success");

          window.dispatchEvent(
            new CustomEvent("artsitemaker:toast", {
              detail: {
                title: "Image uploaded (will be saved on form submit)",
                variant: "success",
              },
            }),
          );
        } else {
          throw new Error(data.error || "Upload failed");
        }
      } catch (e: any) {
        showTextureStatus(`✗ ${e.message}`, "error");
        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: {
              title: `Upload failed: ${e.message}`,
              variant: "destructive",
            },
          }),
        );
      } finally {
        textureDropzone?.classList.remove("uploading");
        if (textureFileUpload) textureFileUpload.value = "";
      }
    };

    const handleBeforeUnload = () => {
      if (this.tempTexturePath && this.tempTexturePath.startsWith(".temp/")) {
        const blob = new Blob([JSON.stringify({ path: this.tempTexturePath })], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/identity/texture?method=DELETE", blob);
      }
    };

    this.addListener(window, "beforeunload", handleBeforeUnload);

    this.addListener(textureDropzone, "click", () => {
      textureFileUpload?.click();
    });

    this.addListener(textureDropzone, "keydown", (event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        textureFileUpload?.click();
      }
    });

    this.addListener(textureDropzone, "dragover", (event) => {
      event.preventDefault();
      textureDropzone?.classList.add("drag-over");
    });

    this.addListener(textureDropzone, "dragleave", () => {
      textureDropzone?.classList.remove("drag-over");
    });

    this.addListener(textureDropzone, "drop", async (event) => {
      event.preventDefault();
      textureDropzone?.classList.remove("drag-over");
      const dropEvent = event as DragEvent;
      const file = dropEvent.dataTransfer?.files?.[0];
      if (file) await uploadTexture(file);
    });

    this.addListener(textureFileUpload, "change", async () => {
      const file = textureFileUpload?.files?.[0];
      if (!file) return;
      await uploadTexture(file);
    });

    this.textureLibrary = this.initAssetLibrary({
      label: "texture",
      apiEndpoint: "/api/identity/texture",
      responseKey: "textures",
      gridEl: textureLibraryGrid,
      emptyEl: textureLibraryEmpty,
      statusEl: textureLibraryStatus,
      refreshBtn: textureLibraryRefresh,
      itemClass: "texture-library-item",
      thumbClass: "texture-library-thumb",
      nameClass: "texture-library-name",
      dataAttr: "data-texture-path",
      getCurrentPath: () => textureHiddenInput?.value || "",
      getItemUrl: (item) =>
        item.url ? item.url : this.resolveTexturePreviewUrl(item.path),
      getItemName: (item) => item.filename || item.path,
      onSelect: (path, url) => {
        if (textureHiddenInput) textureHiddenInput.value = path;
        updateTexturePreview(url);
        if (clearTextureBtn) clearTextureBtn.style.display = "block";
        this.tempTexturePath = null;
        this.changeDetector.checkForChanges();
      },
    });

    this.textureLibrary?.load();

    this.addListener(clearTextureBtn, "click", () => {
      const currentTexturePath = textureHiddenInput?.value;

      if (!currentTexturePath) return;

      const texturePathInput = document.getElementById(
        "delete-texture-path",
      ) as HTMLInputElement;
      if (texturePathInput) texturePathInput.value = currentTexturePath;

      if (deleteTextureModal && (deleteTextureModal as any).open) {
        (deleteTextureModal as any).open();
      }
    });

    this.addListener(deleteTextureModal, "confirm", async () => {
      try {
        await this.deleteAsset({
          apiEndpoint: "/api/identity/texture",
          hiddenInput: textureHiddenInput,
          modalId: "delete-texture-modal",
          pathInputId: "delete-texture-path",
          onSuccess: () => {
            if (clearTextureBtn) clearTextureBtn.style.display = "none";

            const buttonText = document.getElementById("texture-button-text");
            if (buttonText) buttonText.textContent = "Upload Image";

            if (texturePreviewContainer) {
              const previewImg = texturePreviewContainer.querySelector(
                "#texture-preview",
              ) as HTMLImageElement | null;
              if (previewImg) {
                previewImg.src = "";
                previewImg.style.display = "none";
              }
            }
            if (texturePreviewPlaceholder)
              texturePreviewPlaceholder.style.display = "flex";

            this.tempTexturePath = null;

            this.textureLibrary?.load();
          },
        });

        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: { title: "Image deleted successfully", variant: "success" },
          }),
        );
      } catch (e: any) {
        window.dispatchEvent(
          new CustomEvent("artsitemaker:toast", {
            detail: {
              title: `Failed to delete image: ${e.message}`,
              variant: "destructive",
            },
          }),
        );
      }
    });
  }

  private resolveTexturePreviewUrl(texturePath: string): string {
    if (
      texturePath.startsWith("http://") ||
      texturePath.startsWith("https://") ||
      texturePath.startsWith("/")
    ) {
      return texturePath;
    }
    return `/content-assets/${texturePath}`;
  }

  private initAssetLibrary(config: AssetLibraryConfig) {
    const {
      label,
      apiEndpoint,
      responseKey,
      gridEl,
      emptyEl,
      statusEl,
      refreshBtn,
      itemClass,
      thumbClass,
      nameClass,
      dataAttr,
      getCurrentPath,
      getItemUrl,
      getItemName,
      onSelect,
    } = config;

    const itemSelector = `.${itemClass}`;

    const setStatus = (
      message: string,
      type: "info" | "success" | "error",
    ) => {
      if (!statusEl) return;

      statusEl.textContent = message;
      statusEl.classList.remove(
        "hidden",
        "text-admin-muted",
        "text-green-400",
        "text-red-400",
      );

      switch (type) {
        case "success":
          statusEl.classList.add("text-green-400");
          break;
        case "error":
          statusEl.classList.add("text-red-400");
          break;
        default:
          statusEl.classList.add("text-admin-muted");
      }
    };

    const clearStatus = () => {
      if (!statusEl) return;
      statusEl.textContent = "";
      statusEl.classList.add("hidden");
    };

    const setSelected = (path: string) => {
      if (!gridEl) return;
      gridEl
        .querySelectorAll(itemSelector)
        .forEach((item) => item.classList.remove("is-selected"));
      const selected = gridEl.querySelector(`[${dataAttr}="${path}"]`);
      if (selected) selected.classList.add("is-selected");
    };

    const handleSelect = (path: string, url: string) => {
      setSelected(path);
      onSelect(path, url);
    };

    const load = async () => {
      if (!gridEl || !emptyEl) return;

      gridEl.innerHTML = "";
      emptyEl.classList.add("hidden");
      setStatus(`Loading ${label} library...`, "info");

      try {
        const res = await fetch(apiEndpoint);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Failed to load ${label}s`);
        }

        const items = Array.isArray(data[responseKey]) ? data[responseKey] : [];
        if (items.length === 0) {
          emptyEl.classList.remove("hidden");
          clearStatus();
          return;
        }

        const currentPath = getCurrentPath();

        for (const item of items as AssetLibraryItem[]) {
          const itemPath = item.path;
          const itemUrl = getItemUrl(item);

          const button = document.createElement("button");
          button.type = "button";
          button.className = itemClass;
          button.setAttribute(dataAttr, itemPath);
          if (itemPath === currentPath) button.classList.add("is-selected");

          const thumb = document.createElement("div");
          thumb.className = thumbClass;
          const img = document.createElement("img");
          img.src = itemUrl;
          img.alt = getItemName(item) || label;
          thumb.appendChild(img);

          const name = document.createElement("span");
          name.className = nameClass;
          name.textContent = getItemName(item);

          button.appendChild(thumb);
          button.appendChild(name);
          button.addEventListener("click", () =>
            handleSelect(itemPath, itemUrl),
          );

          gridEl.appendChild(button);
        }

        clearStatus();
      } catch (e: any) {
        setStatus(`Failed to load ${label} library: ${e.message}`, "error");
      }
    };

    this.addListener(refreshBtn, "click", () => {
      load();
    });

    return { load };
  }

  private async deleteAsset(config: AssetDeletionConfig): Promise<void> {
    const {
      apiEndpoint,
      hiddenInput,
      modalId,
      pathInputId,
      onSuccess,
      updateSettings,
    } = config;

    const pathInput = document.getElementById(pathInputId) as HTMLInputElement;
    const assetPath = pathInput?.value;

    if (!assetPath) return;

    const modal = document.getElementById(modalId);

    if (modal && (modal as any).close) {
      (modal as any).close();
    }

    const res = await fetch(apiEndpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: assetPath }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (hiddenInput) hiddenInput.value = "";

      if (updateSettings) {
        await updateSettings();
      }

      if (onSuccess) {
        onSuccess();
      }

      this.changeDetector.checkForChanges();
      return;
    }

    throw new Error(data.error || "Failed to delete asset");
  }
}
