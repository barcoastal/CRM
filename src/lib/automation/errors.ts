import { NextResponse } from "next/server";

export class AutomationValidationError extends Error {}

export function withAutomationErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try { return await handler(...args); }
    catch (error) {
      if (error instanceof AutomationValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  };
}
