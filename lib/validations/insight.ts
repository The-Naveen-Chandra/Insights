import * as z from "zod";

export const InsightValidation = z.object({
  insight: z.string().nonempty().min(3, { message: "Minimum 3 characters" }),
  accountId: z.string(),
});

export const CommentValidation = z.object({
  insight: z.string().nonempty().min(3, { message: "Minimum 3 characters" }),
});
