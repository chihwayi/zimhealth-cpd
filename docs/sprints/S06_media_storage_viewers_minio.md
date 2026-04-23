## Sprint S06 — Media support hardening (docs + PPT/DOCX) + MinIO local storage

### Context
Courses contain **videos, documents, and quizzes**. We must support storing/retrieving these assets reliably, and provide learner-friendly viewing.

---

## 1) Current capability assessment (before this sprint)

### Backend storage/retrieval
- **Images**: supported (`/api/media/image`)
- **Videos (MP4)**: supported (`/api/media/video`) + queued processing pipeline
- **Documents**: currently supports **PDF** + audio via `/api/media/document`
- **DOCX/PPTX**: not allowed by upload filter; no dedicated workflow
- **Quizzes**: stored in DB; fully supported

### Frontend viewing
- **Images**: supported
- **Video**: supported via native `<video>` playback
- **PDF**: currently download/open in new tab (no embedded viewer)
- **DOCX/PPTX**: no viewer

### Storage backend choice
- Code already uses AWS SDK S3 client, so **MinIO (S3-compatible)** is a strong fit for self-hosted/local storage.

---

## 2) Sprint goals

### A) Storage capability
- Allow creators/admins to upload **DOCX** and **PPTX** into media storage.
- Ensure assets can be retrieved via stable URLs (MinIO/S3).

### B) Viewer capability (web)
- Add **embedded PDF viewing** for document sections.
- Provide a **clean fallback** for DOCX/PPTX (download/open in new tab), with clear microcopy.

### C) MinIO (self-hosted) wiring
- Add MinIO to local `docker-compose.yml`
- Make backend S3 client configurable via `S3_ENDPOINT` so MinIO can be used without code changes per environment.
- Document configuration and bucket initialization.

---

## 3) Deliverables checklist

### Backend
- [ ] Extend upload allow-list to include:
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
  - `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX)
- [ ] Ensure `/api/media/document` stores these under a document folder (e.g. `documents/`)
- [ ] Convert DOCX/PPTX to **PDF** asynchronously (LibreOffice) and persist `processedCdnUrl`
- [ ] Add `S3_ENDPOINT` support to S3 client config (MinIO/R2)
- [ ] Add MinIO service to `docker-compose.yml`

### Frontend
- [ ] Add PDF viewer experience inside course player (document section)
- [ ] Add DOCX/PPTX fallback UI: “Open/Download” CTA + size/mime display

### DevOps/Docs
- [ ] Update `.env.example` with MinIO + `S3_ENDPOINT` variables
- [ ] Add helper script to init MinIO bucket (requires `mc`)
- [ ] Provide “local MinIO config” snippet for `.env`

---

## 4) Acceptance criteria
- Creator can upload a DOCX/PPTX successfully and receive a URL.
- Learner can open a PDF **inline** (not only download).
- DOCX/PPTX shows a professional fallback (open/download) without breaking the player.
- Switching storage from AWS S3 to MinIO is done by environment variables (`S3_ENDPOINT`, creds, bucket).

---

## 5) Open questions / next iteration (optional)
- Generate thumbnails for office documents (first page slide preview).
- HLS video streaming + adaptive bitrate for large-scale production usage.

