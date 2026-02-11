"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkipForward, Square } from "lucide-react";

const DISPOSITIONS = [
  { value: "INTERESTED", label: "Interested" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "CALLBACK", label: "Callback" },
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "WRONG_NUMBER", label: "Wrong Number" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "DNC", label: "Do Not Call" },
  { value: "ENROLLED", label: "Enrolled" },
];

interface DispositionFormProps {
  onSubmitAndNext: (disposition: string, notes: string, nextFollowUp?: string) => void;
  onSubmitAndStop: (disposition: string, notes: string, nextFollowUp?: string) => void;
  isSubmitting: boolean;
}

export function DispositionForm({
  onSubmitAndNext,
  onSubmitAndStop,
  isSubmitting,
}: DispositionFormProps) {
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  function handleSubmitAndNext() {
    if (!disposition) return;
    onSubmitAndNext(
      disposition,
      notes,
      disposition === "CALLBACK" ? nextFollowUp : undefined
    );
  }

  function handleSubmitAndStop() {
    if (!disposition) return;
    onSubmitAndStop(
      disposition,
      notes,
      disposition === "CALLBACK" ? nextFollowUp : undefined
    );
  }

  return (
    <Card className="border-yellow-500/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Call Disposition</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Outcome</Label>
          <Select value={disposition} onValueChange={setDisposition}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select disposition..." />
            </SelectTrigger>
            <SelectContent>
              {DISPOSITIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add call notes..."
            rows={3}
          />
        </div>

        {disposition === "CALLBACK" && (
          <div className="space-y-2">
            <Label>Follow-up Date & Time</Label>
            <Input
              type="datetime-local"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmitAndNext}
            disabled={!disposition || isSubmitting}
            className="flex-1"
          >
            <SkipForward className="size-4" />
            Submit & Next
          </Button>
          <Button
            onClick={handleSubmitAndStop}
            disabled={!disposition || isSubmitting}
            variant="outline"
            className="flex-1"
          >
            <Square className="size-4" />
            Submit & Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
