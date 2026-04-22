import { useRef, useState, useCallback } from "react";
import { post, uploadFileWithProgress, ApiError } from "@/lib/api/client";
import type { ToastType } from "@/types";

const SUPPORTED_EXTS = [
  ".pdf",".png",".jpg",".jpeg",".webp",".tif",".tiff",
  ".bmp",".doc",".docx",".xls",".xlsx",".csv",".txt",
];

function getExt(f: string) {
  const i = f.lastIndexOf(".");
  return i >= 0 ? f.slice(i).toLowerCase() : "";
}

function inferMime(f: File) {
  const map: Record<string, string> = {
    ".pdf": "application/pdf", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".tif": "image/tiff",
    ".tiff": "image/tiff", ".bmp": "image/bmp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv", ".txt": "text/plain",
  };
  return f.type || map[getExt(f.name)] || "application/octet-stream";
}

export function useUpload(
  onComplete: (docId: number, status: string) => void,
  toast: (type: ToastType, msg: string) => void
) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const upload = useCallback(async (file: File) => {
    if (!SUPPORTED_EXTS.includes(getExt(file.name))) {
      toast("error", `Unsupported file. Use: ${SUPPORTED_EXTS.join(", ")}`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast("error", "File too large. Maximum 50 MB.");
      return;
    }

    abortRef.current = new AbortController();
    setIsUploading(true);
    setProgress(0);
    setFileName(file.name);
    toast("info", `Preparing ${file.name}…`);

    try {
      const presigned = await post<{ upload_url: string; document_id: number }>(
        "/documents/presigned-upload",
        { filename: file.name, mime_type: inferMime(file) }
      );
      await uploadFileWithProgress(
        presigned.upload_url, file, inferMime(file),
        setProgress, abortRef.current.signal
      );
      const completion = await post<{ status: string; document_id: number }>(
        "/documents/complete-upload",
        { document_id: presigned.document_id }
      );
      onComplete(presigned.document_id, completion.status ?? "processing");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        toast("error", err.message);
      else if ((err as Error).message === "Upload cancelled")
        toast("info", "Upload cancelled.");
      else
        toast("error", (err as Error).message || "Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(0);
      setFileName("");
      abortRef.current = null;
    }
  }, [onComplete, toast]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { upload, cancel, isUploading, progress, fileName, SUPPORTED_EXTS };
}
