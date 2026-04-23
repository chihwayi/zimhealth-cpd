## Sprint S08 — DOCX/PPTX upload must save the processed PDF URL, not the original file URL

### Priority: CRITICAL
### Affects: Content creation — creators uploading Word/PowerPoint files get the wrong URL stored on the section.

---

### The Problem

When a creator uploads a `.docx` or `.pptx` file in the Course Builder section editor:

1. The backend (`POST /api/media/document`) correctly queues a `convert-office-to-pdf`
   job and returns `{ assetId, originalUrl, status: 'UPLOADED' }`.
2. The frontend (`CourseBuilder.tsx`) detects it is NOT a video, so it skips the
   polling loop and immediately saves `originalUrl` (the raw DOCX/PPTX CDN URL) to
   the section's `mediaUrl` field.
3. The learner then sees "Open Word document (DOCX)" download fallback — even though
   a converted PDF may be ready and embeddable inline.

The fix is: after a successful DOCX/PPTX upload, poll for the `processedCdnUrl`
(the converted PDF) the same way videos are polled, then save the PDF URL.

---

### Exact files to change

1. `apps/web/src/pages/creator/CourseBuilder.tsx`

No backend changes are needed — the backend already:
- Queues the conversion job.
- Updates `MediaAsset.processedCdnUrl` when done.
- Exposes `GET /api/media/status/:assetId` which returns `processedCdnUrl`.

---

### Step-by-step implementation

#### Step 1 — Identify the upload handler in `CourseBuilder.tsx`

Find the function `handleSectionMediaUpload` (around line 543).

Inside it, find the `else` branch that handles non-video uploads (around line 577):

```ts
} else {
  const url = json.url ?? json.originalUrl;
  if (!url) throw new Error('Upload response missing URL');
  setSectionDraft((current) => (current ? { ...current, mediaUrl: url } : current));
  toast.success('Uploaded. Save the section to persist the media URL.');
}
```

#### Step 2 — Split the else branch into two cases

Replace that entire `else` block with:

```ts
} else {
  // For DOCX/PPTX: the backend queues a PDF conversion. Poll for the
  // processed PDF URL so we store an embeddable PDF, not the raw office file.
  const isOfficeMime =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  if (isOfficeMime && json.assetId) {
    setMediaProcessingMessage('Document uploaded. Converting to PDF… this may take a moment.');
    toast.info('Converting document to PDF. Please wait.');
    const finalStatus = await pollForProcessedDocument(json.assetId);
    const readyUrl = finalStatus.processedCdnUrl ?? finalStatus.cdnUrl;
    if (!readyUrl) throw new Error('Converted PDF URL missing after processing');
    setSectionDraft((current) => (current ? { ...current, mediaUrl: readyUrl } : current));
    setMediaProcessingMessage('PDF ready. Save the section to persist it.');
    toast.success('Document converted to PDF. Save the section.');
  } else {
    // PDF / audio / plain files — URL is returned immediately.
    const url = json.url ?? json.originalUrl;
    if (!url) throw new Error('Upload response missing URL');
    setSectionDraft((current) => (current ? { ...current, mediaUrl: url } : current));
    toast.success('Uploaded. Save the section to persist the media URL.');
  }
}
```

#### Step 3 — Add the `pollForProcessedDocument` function

Directly below the existing `pollForProcessedVideo` function (around line 590), add:

```ts
async function pollForProcessedDocument(assetId: string): Promise<MediaStatusResponse> {
  const maxAttempts = 40; // 40 × 5s = ~3.3 min, sufficient for LibreOffice conversion

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await api.get<MediaStatusResponse>(`/api/media/status/${assetId}`);
    if (status.status === 'PROCESSED') return status;
    if (status.status === 'FAILED') {
      throw new Error(status.processingError ?? 'Document conversion failed');
    }
    await new Promise((resolve) => window.setTimeout(resolve, 5000));
  }

  throw new Error(
    'PDF conversion is taking longer than expected. Check the Media Library for status.',
  );
}
```

#### Step 4 — Clear `mediaProcessingMessage` in the finally block

The existing `finally` block already does `setMediaUploading(false)`. Confirm it also
calls `setMediaProcessingMessage(null)` on the error path. Find the catch block inside
`handleSectionMediaUpload`:

```ts
} catch (err: unknown) {
  setMediaProcessingMessage(null);   // already present — confirm it is there
  toast.error(err instanceof Error ? err.message : 'Upload failed');
}
```

If `setMediaProcessingMessage(null)` is missing from the catch, add it.

---

### Acceptance criteria

- Creator uploads a `.docx` or `.pptx` file via the section media upload button.
- UI shows "Converting document to PDF…" message while polling.
- Once processing completes, the section draft's `mediaUrl` is set to the `.pdf` CDN URL
  (not the original `.docx`/`.pptx` URL).
- Creator saves the section — the stored `mediaUrl` ends with `.pdf` or contains
  `documents/processed` in the path.
- Learner opens that section and sees the inline PDF `<iframe>` viewer (not the
  "Open Word document" fallback).
- If conversion fails, a clear error toast appears and no bad URL is saved.

---

### Do NOT change

- Do not change the backend media routes.
- Do not change the media worker / LibreOffice conversion logic.
- Do not change the `pollForProcessedVideo` function — only add the new
  `pollForProcessedDocument` alongside it.
