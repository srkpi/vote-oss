export interface FileSummary {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  originalName: string | null;
  uploadedBy: string;
  createdAt: string;
}
