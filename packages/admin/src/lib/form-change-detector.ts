/**
 * Form Change Detector Utility
 *
 * Tracks form changes and manages save button state.
 * Provides consistent change detection across admin pages.
 */

export interface FormChangeDetectorOptions {
    /** The form element to track */
    form: HTMLFormElement;
    /** The save button element to enable/disable */
    saveButton: HTMLButtonElement;
    /** Optional callback when change state changes */
    onStateChange?: (hasChanges: boolean) => void;
    /** Optional list of field names to exclude from change detection */
    excludeFields?: string[];
}

export interface FormChangeDetector {
    /** Initialize change tracking */
    initialize: () => void;
    /** Check if form has unsaved changes */
    hasChanges: () => boolean;
    /** Reset initial state (call after successful save) */
    reset: () => void;
    /** Update save button state based on changes */
    updateSaveButton: (hasChanges: boolean, isSaving?: boolean) => void;
    /** Serialize form state to comparable string */
    serializeFormState: (source?: FormData) => string;
    /** Destroy event listeners */
    destroy: () => void;
    /** Manually trigger change detection */
    checkForChanges: () => void;
}

/**
 * Creates a form change detector that tracks form modifications
 * and manages save button state.
 */
export function createFormChangeDetector(options: FormChangeDetectorOptions): FormChangeDetector {
    const { form, saveButton, onStateChange, excludeFields = [] } = options;
    let initialState = '';
    let isCurrentlySaving = false;

    /**
     * Serializes FormData to a sorted JSON string for comparison.
     * Handles File inputs by using their filename.
     * Excludes fields specified in excludeFields.
     */
    function serializeFormState(source?: FormData): string {
        const formData = source || (form ? new FormData(form) : null);
        if (!formData) return '';

        const entries = Array.from(formData.entries())
            .filter(([key]) => !excludeFields.includes(key))
            .map(([key, value]) => {
                if (value instanceof File) {
                    return [key, value.name];
                }
                return [key, String(value)];
            });

        // Sort entries for consistent comparison
        entries.sort((a, b) => {
            const keyCompare = a[0].localeCompare(b[0]);
            if (keyCompare !== 0) return keyCompare;
            return a[1].localeCompare(b[1]);
        });

        return JSON.stringify(entries);
    }

    /**
     * Updates save button state based on changes and saving state.
     */
    function updateSaveButton(hasChanges: boolean, isSaving: boolean = false): void {
        isCurrentlySaving = isSaving;

        if (!saveButton) return;

        const shouldEnable = hasChanges && !isSaving;
        saveButton.disabled = !shouldEnable;

        if (shouldEnable) {
            saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
            saveButton.setAttribute('data-tooltip', '');
        } else {
            saveButton.classList.add('opacity-50', 'cursor-not-allowed');
            // Only show "No changes" if disabled because of no changes (not while saving)
            if (!isSaving) {
                saveButton.setAttribute('data-tooltip', 'No changes to save');
            } else {
                saveButton.setAttribute('data-tooltip', '');
            }
        }
    }

    /**
     * Checks if form has unsaved changes.
     */
    function hasChanges(): boolean {
        const currentState = serializeFormState();
        return currentState !== initialState;
    }

    /**
     * Checks for changes and updates UI accordingly.
     */
    function checkForChanges(): void {
        const changes = hasChanges();
        updateSaveButton(changes, isCurrentlySaving);
        if (onStateChange) {
            onStateChange(changes);
        }
    }

    /**
     * Debounced change handler using requestAnimationFrame.
     */
    function handleFieldChange(): void {
        window.requestAnimationFrame(checkForChanges);
    }

    /**
     * Initializes form change tracking.
     */
    function initialize(): void {
        if (!form) return;

        initialState = serializeFormState();
        updateSaveButton(false, false);

        form.addEventListener('input', handleFieldChange);
        form.addEventListener('change', handleFieldChange);
    }

    /**
     * Resets initial state (call after successful save).
     */
    function reset(): void {
        initialState = serializeFormState();
        isCurrentlySaving = false;
        updateSaveButton(false, false);
    }

    /**
     * Destroys event listeners.
     */
    function destroy(): void {
        if (!form) return;
        form.removeEventListener('input', handleFieldChange);
        form.removeEventListener('change', handleFieldChange);
    }

    return {
        initialize,
        hasChanges,
        reset,
        updateSaveButton,
        serializeFormState,
        destroy,
        checkForChanges,
    };
}
