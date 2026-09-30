import { isFullNameField } from "./disclosure";
export type SigningBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  recipientId?: string;
  required?: boolean;
  value?: string;
  options?: string[];
  inputType?: "text" | "email" | "number" | "dropdown" | "radio";
};
export type FieldKind =
  "signature" | "initial" | "date" | "name" | "text" | "checkbox";
export type SigningField = SigningBox & {
  id: string;
  kind: FieldKind;
  index: number;
};
export type FieldGroups = {
  signatureBoxes: SigningBox[];
  initialBoxes: SigningBox[];
  dateBoxes: SigningBox[];
  textBoxes: SigningBox[];
  checkboxBoxes: SigningBox[];
};
export function orderedFields(groups: FieldGroups): SigningField[] {
  const result: SigningField[] = [];
  for (const [kind, boxes] of [
    ["signature", groups.signatureBoxes],
    ["initial", groups.initialBoxes],
    ["date", groups.dateBoxes],
    ["text", groups.textBoxes],
    ["checkbox", groups.checkboxBoxes],
  ] as const) {
    boxes.forEach((box, index) =>
      result.push({
        ...box,
        kind: kind === "text" && isFullNameField(box) ? "name" : kind,
        index,
        id: `${kind}-${index}`,
      }),
    );
  }
  return result.sort(
    (a, b) =>
      a.page - b.page || b.y - a.y || a.x - b.x || a.id.localeCompare(b.id),
  );
}
export function nextUnfinished(
  fields: SigningField[],
  completed: ReadonlySet<string>,
  after?: string,
) {
  const required = fields.filter(
    (f) =>
      f.required !== false &&
      f.kind !== "date" &&
      f.kind !== "name" &&
      f.kind !== "checkbox",
  );
  const start = after ? fields.findIndex((f) => f.id === after) : -1;
  return (
    required.find((f) => fields.indexOf(f) > start && !completed.has(f.id)) ??
    required.find((f) => !completed.has(f.id)) ??
    null
  );
}
export function fieldStyle(box: SigningBox, pageHeight: number) {
  return {
    left: box.x,
    top: pageHeight - box.y - box.height,
    width: box.width,
    height: box.height,
  };
}

export function textFieldError(
  box: Pick<SigningBox, "inputType" | "options">,
  value: string,
) {
  if (!value) return null;
  if (box.inputType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return "Enter a valid email address.";
  if (
    box.inputType === "number" &&
    (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))
  )
    return "Enter a valid number.";
  if (
    ["dropdown", "radio"].includes(box.inputType ?? "") &&
    !box.options?.includes(value)
  )
    return "Choose one of the listed options.";
  return null;
}
