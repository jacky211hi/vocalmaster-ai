/** Marker stored in ai_feedback_md while Gemini analysis is pending */
export const ANALYZING_MARKER = "<!--status:analyzing-->";

export function isAnalyzingFeedback(feedback: string | null | undefined): boolean {
  return (feedback ?? "").startsWith(ANALYZING_MARKER);
}
