// ============================================================
// LAUNCHPAD — messages/messages.service.js
// Logique métier complète de la messagerie
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";

const MESSAGE_SELECT = {
  id: true,
  content: true,
  messageType: true,
  fileUrl: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  senderId: true,
  sender: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
};

// ── Vérifier l'accès à une conversation ──────────────────
async function checkConvAccess(convId, userId) {
  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    select: {
      id: true,
      user1Id: true,
      user2Id: true,
      unreadUser1: true,
      unreadUser2: true,
      user1: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      },
      user2: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      },
    },
  });
  if (!conv) throw new AppError("Conversation introuvable.", 404, "NOT_FOUND");
  if (conv.user1Id !== userId && conv.user2Id !== userId)
    throw new AppError("Accès refusé.", 403, "FORBIDDEN");
  return conv;
}

// ════════════════════════════════════════════════════════════
// CRÉER OU RÉCUPÉRER UNE CONVERSATION DIRECTE
// POST /api/conversations/direct
// ════════════════════════════════════════════════════════════
export async function getOrCreateDirectConversation(user1Id, user2Id) {
  if (user1Id === user2Id)
    throw new AppError(
      "Impossible de créer une conversation avec soi-même.",
      400,
      "INVALID_REQUEST",
    );

  const otherUser = await prisma.user.findUnique({
    where: { id: user2Id, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!otherUser)
    throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  const existing = await prisma.conversation.findFirst({
    where: {
      OR: [
        { user1Id, user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    },
    select: { id: true },
  });

  const convId =
    existing?.id ||
    (await prisma.conversation.create({ data: { user1Id, user2Id } })).id;

  return checkConvAccess(convId, user1Id);
}

// ════════════════════════════════════════════════════════════
// LISTE DES CONVERSATIONS
// GET /api/conversations
// ════════════════════════════════════════════════════════════
export async function listConversations(userId) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
      messages: { some: {} },
    },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      lastMessageAt: true,
      user1Id: true,
      user2Id: true,
      unreadUser1: true,
      unreadUser2: true,
      user1: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      },
      user2: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          messageType: true,
          senderId: true,
          createdAt: true,
        },
      },
    },
  });

  return conversations.map((conv) => {
    const isUser1 = conv.user1Id === userId;
    return {
      id: conv.id,
      lastMessageAt: conv.lastMessageAt,
      unread: isUser1 ? conv.unreadUser1 : conv.unreadUser2,
      other: isUser1 ? conv.user2 : conv.user1,
      lastMessage: conv.messages[0]
        ? {
            content: conv.messages[0].content,
            messageType: conv.messages[0].messageType,
            isFromMe: conv.messages[0].senderId === userId,
            createdAt: conv.messages[0].createdAt,
          }
        : null,
    };
  });
}

// ════════════════════════════════════════════════════════════
// MESSAGES D'UNE CONVERSATION
// GET /api/conversations/:id/messages
// ════════════════════════════════════════════════════════════
export async function getMessages(convId, userId, { page = 1, limit = 30 }) {
  await checkConvAccess(convId, userId);
  const skip = (page - 1) * limit;

  const messages = await prisma.message.findMany({
    where: { conversationId: convId },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: MESSAGE_SELECT,
  });

  markAsRead(convId, userId).catch(console.error);

  return { messages: messages.reverse(), total: messages.length };
}

// ════════════════════════════════════════════════════════════
// ENVOYER UN MESSAGE
// POST /api/messages
// ════════════════════════════════════════════════════════════
export async function sendMessage(
  senderId,
  { conversationId, content, messageType = "text", fileUrl = null },
  io = null,
) {
  const conv = await checkConvAccess(conversationId, senderId);

  if (!content && messageType === "text")
    throw new AppError("Le contenu est requis.", 400, "VALIDATION_ERROR");

  // 1. Créer le message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content: content || "",
      messageType,
      fileUrl: fileUrl || null,
    },
    select: MESSAGE_SELECT,
  });

  // 2. Mettre à jour la conversation
  const isUser1 = conv.user1Id === senderId;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(isUser1
        ? { unreadUser2: { increment: 1 } }
        : { unreadUser1: { increment: 1 } }),
    },
  });

  // 3. Notification in-app
  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { firstName: true, lastName: true },
  });
  const recipientId = isUser1 ? conv.user2Id : conv.user1Id;

  createNotification({
    userId: recipientId,
    type: "message",
    title: `💬 Message de ${sender.firstName} ${sender.lastName}`,
    body:
      messageType === "text"
        ? (content || "").substring(0, 80) +
          (content && content.length > 80 ? "…" : "")
        : "📎 Fichier partagé",
    actionUrl: `/messages?conversation=${conversationId}`,
  }).catch(console.error);

  // 4. Temps réel Socket.io
  if (io) {
    io.to(`conv_${conversationId}`).emit("new_message", {
      message,
      conversationId,
    });
    io.to(`user_${recipientId}`).emit("unread_update", {
      conversationId,
      increment: 1,
    });
  }

  return message;
}

// ════════════════════════════════════════════════════════════
// MARQUER COMME LUS
// ════════════════════════════════════════════════════════════
export async function markAsRead(convId, userId, io = null) {
  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    select: { id: true, user1Id: true, user2Id: true },
  });
  if (!conv) return { updatedCount: 0 };

  const isUser1 = conv.user1Id === userId;
  const readAt = new Date();

  const updateResult = await prisma.message.updateMany({
    where: { conversationId: convId, senderId: { not: userId }, isRead: false },
    data: { isRead: true, readAt },
  });

  await prisma.conversation.update({
    where: { id: convId },
    data: isUser1 ? { unreadUser1: 0 } : { unreadUser2: 0 },
  });

  if (io && updateResult.count > 0) {
    io.to(`conv_${convId}`).emit("messages_read", {
      conversationId: convId,
      userId,
      readAt: readAt.toISOString(),
    });

    const otherUserId = isUser1 ? conv.user2Id : conv.user1Id;
    io.to(`user_${otherUserId}`).emit("messages_read", {
      conversationId: convId,
      userId,
      readAt: readAt.toISOString(),
    });

    io.to(`user_${userId}`).emit("unread_update", {
      conversationId: convId,
      reset: true,
    });
  }

  return { updatedCount: updateResult.count, readAt };
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UN MESSAGE (soft delete)
// DELETE /api/messages/:id
// ════════════════════════════════════════════════════════════
export async function deleteMessage(messageId, userId) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, senderId: true },
  });
  if (!msg) throw new AppError("Message introuvable.", 404, "NOT_FOUND");
  if (msg.senderId !== userId)
    throw new AppError("Accès refusé.", 403, "FORBIDDEN");

  await prisma.message.update({
    where: { id: messageId },
    data: { content: "_Message supprimé_", fileUrl: null },
  });
  return { deleted: true };
}

// ════════════════════════════════════════════════════════════
// TOTAL NON-LUS (pour la Navbar)
// ════════════════════════════════════════════════════════════
export async function getTotalUnread(userId) {
  const convs = await prisma.conversation.findMany({
    where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    select: { user1Id: true, unreadUser1: true, unreadUser2: true },
  });
  return convs.reduce(
    (total, c) =>
      total + (c.user1Id === userId ? c.unreadUser1 : c.unreadUser2),
    0,
  );
}
