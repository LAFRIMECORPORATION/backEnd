import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string({required_error:"conversationId requis."}).uuid("Format UUID invalide."),
  content: z.string().max(5000,"Message trop long.").optional(),
  messageType: z.enum(["text","file","project_share"]).default("text"),
  fileUrl: z.string().url().optional().nullable(),
});

export const createDirectConvSchema = z.object({
  targetUserId: z.string({required_error:"targetUserId requis."}).uuid("Format UUID invalide."),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e=>({field:e.path.join("."),message:e.message}));
      return res.status(400).json({success:false,error:"VALIDATION_ERROR",
        message:errors[0]?.message||"Données invalides.",errors});
    }
    req.body = result.data;
    next();
  };
}