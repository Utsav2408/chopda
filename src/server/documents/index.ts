export type {
  DocumentsUploadInput,
  DocumentsUploadResult,
  DocumentsDownloadInput,
  DocumentsDownloadResult,
  DocumentsRoleAction,
} from "./types.js";
export { DOCUMENTS_FILE_ROUTE_PREFIX } from "./types.js";

export {
  upload,
  download,
  assertCanUploadDocuments,
  assertCanDownloadDocuments,
  DOWNLOAD_CACHE_CONTROL,
} from "./service.js";

export {
  handleUpload,
  handleDownload,
  uploadMetaSchema,
  mapErrorToHandlerResult,
  type HandlerResult,
} from "./handlers.js";
