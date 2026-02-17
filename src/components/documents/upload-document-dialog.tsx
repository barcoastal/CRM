"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPES } from "@/lib/validations/payment";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  opportunityId?: string;
  onSuccess: () => void;
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

export function UploadDocumentDialog({
  open,
  onOpenChange,
  clientId,
  opportunityId,
  onSuccess,
}: UploadDocumentDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      type: formData.get("type") as string,
      filePath: formData.get("filePath") as string,
      fileSize: formData.get("fileSize") ? Number(formData.get("fileSize")) : undefined,
    };

    try {
      const apiUrl = opportunityId
        ? `/api/opportunities/${opportunityId}/documents`
        : `/api/clients/${clientId}/documents`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to upload document");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a document record for this client. File upload is a placeholder for now.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-name">Document Name *</Label>
            <Input id="doc-name" name="name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-type">Document Type *</Label>
            <Select name="type" defaultValue="OTHER">
              <SelectTrigger id="doc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOC_TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-path">File Path *</Label>
            <Input
              id="doc-path"
              name="filePath"
              placeholder="/uploads/documents/..."
              required
            />
            <p className="text-xs text-muted-foreground">
              Actual file upload not yet implemented. Enter a file path reference.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-size">File Size (bytes)</Label>
            <Input id="doc-size" name="fileSize" type="number" min="0" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
