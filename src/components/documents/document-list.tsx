"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Trash2, Download } from "lucide-react";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { DOCUMENT_TYPES } from "@/lib/validations/payment";

interface DocumentData {
  id: string;
  name: string;
  type: string;
  filePath: string;
  fileSize: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

interface DocumentListProps {
  documents: DocumentData[];
  clientId: string;
  onRefresh: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  ENGAGEMENT_AGREEMENT: "Engagement Agreement",
  HARDSHIP_LETTER: "Hardship Letter",
  AUTHORIZATION: "Authorization",
  SETTLEMENT_OFFER: "Settlement Offer",
  BANK_STATEMENT: "Bank Statement",
  TAX_RETURN: "Tax Return",
  OTHER: "Other",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  ENGAGEMENT_AGREEMENT: "bg-purple-100 text-purple-800",
  HARDSHIP_LETTER: "bg-blue-100 text-blue-800",
  AUTHORIZATION: "bg-green-100 text-green-800",
  SETTLEMENT_OFFER: "bg-yellow-100 text-yellow-800",
  BANK_STATEMENT: "bg-indigo-100 text-indigo-800",
  TAX_RETURN: "bg-orange-100 text-orange-800",
  OTHER: "bg-gray-100 text-gray-800",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ documents, clientId, onRefresh }: DocumentListProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = filterType === "ALL"
    ? documents
    : documents.filter((d) => d.type === filterType);

  const handleDelete = async (docId: string) => {
    setDeleting(docId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Documents ({documents.length})
        </h3>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOC_TYPE_LABELS[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="size-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border py-12 text-center">
          <FileText className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No documents found.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setUploadOpen(true)}
          >
            Upload First Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${DOC_TYPE_COLORS[doc.type] || ""}`}
                    >
                      {DOC_TYPE_LABELS[doc.type] || doc.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      by {doc.uploadedBy.name}
                    </span>
                    {doc.fileSize && (
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" title="Download (placeholder)">
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete"
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleting === doc.id}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        clientId={clientId}
        onSuccess={onRefresh}
      />
    </div>
  );
}
