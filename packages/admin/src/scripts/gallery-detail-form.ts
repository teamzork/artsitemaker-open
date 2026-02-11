// packages/admin/src/scripts/gallery-detail-form.ts
import { createFormChangeDetector } from '../lib/form-change-detector';
import { createFormSaveHandler } from '../lib/form-save-handler';

declare global {
  interface Window {
    __ARTIS_GALLERY_DETAIL__?: {
      slug?: string;
      artworkTitle?: string;
      additionalImages?: unknown[];
    };
  }
}

const vars = window.__ARTIS_GALLERY_DETAIL__ || {};
const slug = vars.slug;

const form = document.getElementById('artwork-form') as HTMLFormElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const statusEl = document.getElementById('save-status');

if (!slug || !form || !saveBtn) {
  // Page not ready or missing expected elements; do nothing.
} else {
  const changeDetector = createFormChangeDetector({
    form,
    saveButton: saveBtn,
    // Exclude 'published' from change detection since it auto-saves independently
    excludeFields: ['published'],
  });

  const saveHandler = createFormSaveHandler({
    form,
    saveButton: saveBtn,
    statusElement: statusEl,
    successToast: {
      title: 'Artwork saved',
      description: 'Metadata has been successfully updated.',
      variant: 'success',
    },
    errorToast: (err) => ({
      title: 'Save failed',
      description: err.message,
      variant: 'destructive',
    }),
    saveFn: async (formData) => {
      const data = {
        slug: formData.get('slug'),
        title: formData.get('title'),
        year: formData.get('year') ? Number(formData.get('year')) : null,
        medium: formData.get('medium') || null,
        dimensions: formData.get('dimensions') || null,
        description: formData.get('description') || null,
        collection: formData.get('collection') || null,
        sortOrder: Number(formData.get('sortOrder')) || 0,
        tags: formData.get('tags')
          ? String(formData.get('tags'))
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        published: formData.get('published') === 'on',
        sold: formData.get('sold') === 'on',
        price: formData.get('price') ? Number(formData.get('price')) : null,
        inquireOnly: formData.get('inquireOnly') === 'on',
      };

      return fetch(`/api/artwork/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    onAfterSave: () => {
      changeDetector.reset();
    },
  });

  function waitForToggles(callback: () => void, maxAttempts = 50) {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      const hasToggles =
        form?.querySelector('input[type="hidden"][name="published"]') !== null;
      if (hasToggles || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        callback();
      }
    }, 50);
  }

  waitForToggles(() => {
    changeDetector.initialize();
    saveHandler.attach();
    // Expose a deterministic marker for E2E tests that change detection is active.
    // (Avoids races where the test edits fields before we capture initialState.)
    form.dataset.changeDetectorReady = 'true';
  });
}

