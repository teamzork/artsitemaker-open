/**
 * Form Save Handler Utility
 *
 * Handles form submission with save state management,
 * toast notifications, and integration with form change detector.
 */

export interface ToastConfig {
    title: string;
    description?: string;
    variant?: 'default' | 'success' | 'destructive' | 'warning';
}

export interface FormSaveHandlerOptions {
    /** The form element */
    form: HTMLFormElement;
    /** The save button element */
    saveButton: HTMLButtonElement;
    /** Optional status element for text updates */
    statusElement?: HTMLElement | null;
    /** Function to call for saving data */
    saveFn: (formData: FormData, serializedState: string) => Promise<Response>;
    /** Toast config for success */
    successToast?: ToastConfig;
    /** Toast config for error (or function that returns config) */
    errorToast?: ToastConfig | ((error: Error) => ToastConfig);
    /** Optional callback before save */
    onBeforeSave?: () => Promise<void> | void;
    /** Optional callback after successful save */
    onAfterSave?: () => void;
    /** Optional callback to build request body from form data */
    buildRequestBody?: (formData: FormData) => unknown;
}

export interface FormSaveHandler {
    /** Attach submit handler to form */
    attach: () => void;
    /** Detach submit handler */
    detach: () => void;
    /** Programmatically trigger save */
    save: () => Promise<boolean>;
    /** Get current saving state */
    isSaving: () => boolean;
}

export interface UnsavedChangesGuardOptions {
    /** Enable or disable the guard */
    enabled?: boolean;
    /** Function to check if there are unsaved changes */
    hasChanges: () => boolean;
    /** Optional modal id to use for confirmation */
    modalId?: string;
}

export interface UnsavedChangesGuard {
    /** Attach event listeners */
    attach: () => void;
    /** Detach event listeners */
    detach: () => void;
}

/**
 * Dispatches a toast notification event.
 */
function showToast(config: ToastConfig): void {
    window.dispatchEvent(new CustomEvent('artsitemaker:toast', {
        detail: config,
    }));
}

/**
 * Creates a navigation guard that confirms before leaving with unsaved changes.
 */
export function createUnsavedChangesGuard(options: UnsavedChangesGuardOptions): UnsavedChangesGuard {
    const {
        enabled = true,
        hasChanges,
        modalId = 'unsaved-changes-modal',
    } = options;

    type ModalElement = HTMLElement & { open?: () => void; close?: () => void };
    const modal = typeof document !== 'undefined'
        ? (document.getElementById(modalId) as ModalElement | null)
        : null;

    let allowNavigation = false;
    let pendingNavigationUrl: string | null = null;

    function shouldBlock(): boolean {
        if (!enabled) return false;
        if (allowNavigation) return false;
        return hasChanges();
    }

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
        if (!shouldBlock()) return;
        event.preventDefault();
        event.returnValue = '';
    }

    function handleDocumentClick(event: MouseEvent): void {
        if (!shouldBlock()) return;
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const target = event.target as HTMLElement | null;
        const link = target?.closest('a') as HTMLAnchorElement | null;
        if (!link) return;
        if (link.hasAttribute('download')) return;
        if (link.target && link.target !== '_self') return;

        const rawHref = link.getAttribute('href');
        if (!rawHref) return;

        const href = rawHref.trim();
        const normalized = href.toLowerCase();
        if (!href) return;
        if (normalized === '#') return;
        if (normalized === 'null' || normalized === 'undefined') return;
        if (normalized === '/null' || normalized === '/undefined') return;
        if (normalized.startsWith('#')) return;
        if (normalized.startsWith('javascript:')) return;

        console.log('[ArtSiteMaker Debug] Intercepted navigation to:', link.href, 'Raw href:', rawHref);
        pendingNavigationUrl = link.href;
        event.preventDefault();

        if (modal?.open) {
            modal.open();
        } else if (pendingNavigationUrl) {
            allowNavigation = true;
            window.location.href = pendingNavigationUrl;
        }
    }

    function handleModalConfirm(): void {
        if (!pendingNavigationUrl) return;

        // Capture the URL before closing modal (which might clear pendingNavigationUrl via handleModalClose)
        const targetUrl = pendingNavigationUrl;
        const normalizedUrl = targetUrl.toLowerCase();

        if (
            normalizedUrl === 'null' ||
            normalizedUrl === 'undefined' ||
            normalizedUrl.endsWith('/null') ||
            normalizedUrl.endsWith('/undefined') ||
            normalizedUrl.includes('/null?') ||
            normalizedUrl.includes('/undefined?') ||
            normalizedUrl.includes('/null#') ||
            normalizedUrl.includes('/undefined#')
        ) {
            pendingNavigationUrl = null;
            modal?.close?.();
            return;
        }

        allowNavigation = true;
        modal?.close?.();
        window.location.href = targetUrl;
    }

    function handleModalClose(): void {
        pendingNavigationUrl = null;
    }

    function attach(): void {
        if (!enabled) return;
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('click', handleDocumentClick);
        modal?.addEventListener('confirm', handleModalConfirm);
        modal?.addEventListener('close', handleModalClose);
    }

    function detach(): void {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('click', handleDocumentClick);
        modal?.removeEventListener('confirm', handleModalConfirm);
        modal?.removeEventListener('close', handleModalClose);
    }

    return {
        attach,
        detach,
    };
}

/**
 * Creates a form save handler that manages submission state,
 * shows toast notifications, and integrates with change detection.
 */
export function createFormSaveHandler(options: FormSaveHandlerOptions): FormSaveHandler {
    const {
        form,
        saveButton,
        statusElement,
        saveFn,
        successToast,
        errorToast,
        onBeforeSave,
        onAfterSave,
    } = options;

    let isSaving = false;

    /**
     * Updates status element text if provided.
     */
    function updateStatus(text: string): void {
        if (statusElement) {
            statusElement.textContent = text;
        }
    }

    /**
     * Performs the save operation.
     */
    async function save(): Promise<boolean> {
        if (isSaving) return false;
        if (saveButton?.disabled) return false;

        isSaving = true;

        try {
            // Call before save hook
            if (onBeforeSave) {
                updateStatus('Preparing...');
                await onBeforeSave();
            }

            const formData = new FormData(form);
            const serializedState = JSON.stringify(
                Array.from(formData.entries()).map(([k, v]) => [
                    k,
                    v instanceof File ? v.name : String(v),
                ])
            );

            updateStatus('Saving...');

            const res = await saveFn(formData, serializedState);

            if (res.ok) {
                updateStatus('✓ Saved!');

                if (successToast) {
                    showToast(successToast);
                }

                if (onAfterSave) {
                    onAfterSave();
                }

                setTimeout(() => {
                    updateStatus('');
                }, 3000);

                return true;
            } else {
                const errorData = await res.json().catch(() => ({ error: 'Save failed' }));
                throw new Error(errorData.error || 'Save failed');
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            updateStatus('✗ Save failed');

            if (errorToast) {
                const toastConfig = typeof errorToast === 'function'
                    ? errorToast(err)
                    : errorToast;
                showToast(toastConfig);
            }

            return false;
        } finally {
            isSaving = false;
        }
    }

    /**
     * Handles form submit event.
     */
    async function handleSubmit(e: Event): Promise<void> {
        e.preventDefault();
        await save();
    }

    /**
     * Attaches submit handler to form.
     */
    function attach(): void {
        form?.addEventListener('submit', handleSubmit);
    }

    /**
     * Detaches submit handler from form.
     */
    function detach(): void {
        form?.removeEventListener('submit', handleSubmit);
    }

    /**
     * Gets current saving state.
     */
    function getIsSaving(): boolean {
        return isSaving;
    }

    return {
        attach,
        detach,
        save,
        isSaving: getIsSaving,
    };
}

/**
 * Combines form change detector and save handler for common use case.
 * Returns a unified controller with initialization and cleanup.
 */
export interface FormControllerOptions extends FormSaveHandlerOptions {
    /** Optional callback when change state changes */
    onStateChange?: (hasChanges: boolean) => void;
    /** Enable navigation confirmation when there are unsaved changes */
    confirmOnNavigate?: boolean;
    /** Optional modal id to use for unsaved changes confirmation */
    unsavedChangesModalId?: string;
}

export interface FormController {
    /** Initialize form tracking and handlers */
    initialize: () => void;
    /** Destroy all event listeners */
    destroy: () => void;
    /** Programmatically trigger save */
    save: () => Promise<boolean>;
    /** Reset change tracking (call after external saves) */
    reset: () => void;
}

/**
 * Creates a combined form controller with change detection and save handling.
 */
export function createFormController(options: FormControllerOptions): FormController {
    const {
        form,
        saveButton,
        onStateChange,
        confirmOnNavigate = true,
        unsavedChangesModalId = 'unsaved-changes-modal',
        ...saveOptions
    } = options;

    // Import dynamically to avoid circular dependencies
    let changeDetector: {
        initialize: () => void;
        destroy: () => void;
        reset: () => void;
        updateSaveButton: (hasChanges: boolean, isSaving?: boolean) => void;
        hasChanges: () => boolean;
    } | null = null;

    let saveHandler: {
        attach: () => void;
        detach: () => void;
        save: () => Promise<boolean>;
        isSaving: () => boolean;
    } | null = null;

    let hasUnsavedChanges = false;
    const navigationGuard = createUnsavedChangesGuard({
        enabled: confirmOnNavigate,
        modalId: unsavedChangesModalId,
        hasChanges: () => {
            if (changeDetector) {
                return changeDetector.hasChanges();
            }
            return hasUnsavedChanges;
        },
    });

    function initialize(): void {
        // Initialize change detector
        import('./form-change-detector').then(({ createFormChangeDetector }) => {
            changeDetector = createFormChangeDetector({
                form,
                saveButton,
                onStateChange: (hasChanges) => {
                    hasUnsavedChanges = hasChanges;
                    if (saveHandler) {
                        changeDetector?.updateSaveButton(hasChanges, saveHandler.isSaving());
                    }
                    if (onStateChange) {
                        onStateChange(hasChanges);
                    }
                },
            });
            changeDetector.initialize();
        });

        // Initialize save handler
        saveHandler = createFormSaveHandler({
            form,
            saveButton,
            ...saveOptions,
            onAfterSave: () => {
                changeDetector?.reset();
                hasUnsavedChanges = false;
                if (saveOptions.onAfterSave) {
                    saveOptions.onAfterSave();
                }
            },
        });
        saveHandler.attach();

        navigationGuard.attach();
    }

    function destroy(): void {
        changeDetector?.destroy();
        saveHandler?.detach();
        navigationGuard.detach();
    }

    async function save(): Promise<boolean> {
        return saveHandler?.save() ?? Promise.resolve(false);
    }

    function reset(): void {
        changeDetector?.reset();
        hasUnsavedChanges = false;
    }

    return {
        initialize,
        destroy,
        save,
        reset,
    };
}
