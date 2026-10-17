/**
 * Document boundary for a future private, per-user document store.
 * Future records: {id, subject, name, mimeType, status, uploadedAt}.
 * Search results must include documentId, page/section and excerpt.
 * Do not add public filesystem paths, credentials or unverified citations.
 * Upload/extraction/indexing are deliberately unavailable in v1.
 */
export function documentContext() {
 return {
  documents: [],
  documentStatus: 'Ingen pensumfiler er lastet opp eller lest.',
  documentCapabilities: {upload:false,search:false}
 };
}
