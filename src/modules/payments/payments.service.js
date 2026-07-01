// ============================================================
// LAUNCHPAD � payments/payments.service.js
// Logique m�tier compl�te des paiements (MTN � Orange � Stripe � Escrow)
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import Stripe from "stripe";

// -- Configuration Stripe ------------------------------------
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// ------------------------------------------------------------
// MTN MOBILE MONEY
// ------------------------------------------------------------

export async function initMtnPayment(userId, { projectId, amount, phoneNumber }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, authorId: true, goalAmount: true, raisedAmount: true },
  });
  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  const fee = Math.round(amount * 0.015);
  const totalAmount = amount + fee;

  const investment = await prisma.investment.create({
    data: {
      userId,
      investorId: userId,
      projectId,
      amount,
      currency: "XAF",
      paymentMethod: "mtn_money",
      platformFee: fee,
      status: "pending",
    },
  });

  const transaction = await prisma.paymentTransaction.create({
    data: {
      investmentId: investment.id,
      provider: "mtn",
      amount: totalAmount,
      currency: "XAF",
      status: "initiated",
      phoneNumber,
      referenceId: `MTN-${Date.now()}-${investment.id.substring(0, 8)}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return {
    investmentId: investment.id,
    transactionId: transaction.id,
    referenceId: transaction.referenceId,
    amount,
    fee,
    totalAmount,
    phoneNumber,
    expiresAt: transaction.expiresAt,
  };
}

export async function handleMtnWebhook(body, headers) {
  const { referenceId, status } = body;

  const transaction = await prisma.paymentTransaction.findFirst({
    where: { referenceId },
    include: { investment: true },
  });

  if (!transaction) throw new AppError("Transaction introuvable.", 404, "NOT_FOUND");

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { status: status === "SUCCESS" ? "success" : "failed" },
  });

  if (status === "SUCCESS") {
    await prisma.investment.update({
      where: { id: transaction.investmentId },
      data: { status: "in_escrow" },
    });

    await prisma.project.update({
      where: { id: transaction.investment.projectId },
      data: { raisedAmount: { increment: transaction.investment.amount } },
    });
  } else {
    await prisma.investment.update({
      where: { id: transaction.investmentId },
      data: { status: "failed" },
    });
  }

  return { received: true, investmentId: transaction.investmentId };
}

// ------------------------------------------------------------
// ORANGE MONEY
// ------------------------------------------------------------

export async function initOrangePayment(userId, { projectId, amount, phoneNumber }) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, authorId: true },
  });
  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  const fee = Math.round(amount * 0.015);
  const totalAmount = amount + fee;

  const investment = await prisma.investment.create({
    data: {
      userId,
      investorId: userId,
      projectId,
      amount,
      currency: "XAF",
      paymentMethod: "orange_money",
      platformFee: fee,
      status: "pending",
    },
  });

  const transaction = await prisma.paymentTransaction.create({
    data: {
      investmentId: investment.id,
      provider: "orange",
      amount: totalAmount,
      currency: "XAF",
      status: "initiated",
      phoneNumber,
      orderId: `OM-${Date.now()}-${investment.id.substring(0, 8)}`,
      payToken: `TOKEN-${Date.now()}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return {
    investmentId: investment.id,
    transactionId: transaction.id,
    orderId: transaction.orderId,
    payToken: transaction.payToken,
    amount,
    fee,
    totalAmount,
    expiresAt: transaction.expiresAt,
  };
}

export async function handleOrangeWebhook(body) {
  const { orderId, status } = body;

  const transaction = await prisma.paymentTransaction.findFirst({
    where: { orderId },
    include: { investment: true },
  });

  if (!transaction) throw new AppError("Transaction introuvable.", 404, "NOT_FOUND");

  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: { status: status === "SUCCESS" ? "success" : "failed" },
  });

  if (status === "SUCCESS") {
    await prisma.investment.update({
      where: { id: transaction.investmentId },
      data: { status: "in_escrow" },
    });

    await prisma.project.update({
      where: { id: transaction.investment.projectId },
      data: { raisedAmount: { increment: transaction.investment.amount } },
    });
  } else {
    await prisma.investment.update({
      where: { id: transaction.investmentId },
      data: { status: "failed" },
    });
  }

  return { received: true, investmentId: transaction.investmentId };
}

// ------------------------------------------------------------
// STRIPE
// ------------------------------------------------------------

export async function initStripePayment(userId, { projectId, amount, currency = "XAF" }) {
  if (!stripe) throw new AppError("Stripe non configur�.", 500, "STRIPE_NOT_CONFIGURED");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, authorId: true },
  });
  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  const fee = Math.round(amount * 0.029) + 150;
  const totalAmount = amount + fee;

  const investment = await prisma.investment.create({
    data: {
      userId,
      investorId: userId,
      projectId,
      amount,
      currency,
      paymentMethod: "stripe",
      platformFee: fee,
      status: "pending",
    },
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: currency.toLowerCase(),
    metadata: {
      investmentId: investment.id,
      projectId,
      userId,
    },
  });

  const transaction = await prisma.paymentTransaction.create({
    data: {
      investmentId: investment.id,
      provider: "stripe",
      amount: totalAmount,
      currency,
      status: "initiated",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return {
    investmentId: investment.id,
    transactionId: transaction.id,
    clientSecret: paymentIntent.client_secret,
    amount,
    fee,
    currency,
  };
}

export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe) throw new AppError("Stripe non configur�.", 500, "STRIPE_NOT_CONFIGURED");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new AppError("Webhook secret non configur�.", 500, "WEBHOOK_SECRET_MISSING");

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new AppError("Signature webhook invalide.", 400, "INVALID_SIGNATURE");
  }

  const transaction = await prisma.paymentTransaction.findFirst({
    where: { stripePaymentIntentId: event.data.object.id },
    include: { investment: true },
  });

  if (!transaction) return { received: true, skipped: true };

  switch (event.type) {
    case "payment_intent.succeeded":
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "success" },
      });

      await prisma.investment.update({
        where: { id: transaction.investmentId },
        data: { status: "in_escrow" },
      });

      await prisma.project.update({
        where: { id: transaction.investment.projectId },
        data: { raisedAmount: { increment: transaction.investment.amount } },
      });
      break;

    case "payment_intent.payment_failed":
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });

      await prisma.investment.update({
        where: { id: transaction.investmentId },
        data: { status: "failed" },
      });
      break;
  }

  return { received: true, investmentId: transaction.investmentId };
}

// ------------------------------------------------------------
// STATUT PAIEMENT
// ------------------------------------------------------------

export async function getPaymentStatus(investmentId, userId) {
  const investment = await prisma.investment.findFirst({
    where: { id: investmentId, investorId: userId },
    include: {
      project: {
        select: { id: true, title: true, goalAmount: true, raisedAmount: true },
      },
      transactions: {
        select: { status: true, provider: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!investment) throw new AppError("Investissement introuvable.", 404, "NOT_FOUND");

  const fundingPct = Math.round((Number(investment.project.raisedAmount) / Number(investment.project.goalAmount)) * 100);

  return {
    id: investment.id,
    status: investment.status,
    amount: Number(investment.amount),
    paymentMethod: investment.paymentMethod,
    project: {
      ...investment.project,
      raisedAmount: Number(investment.project.raisedAmount),
      goalAmount: Number(investment.project.goalAmount),
      fundingPct,
    },
    transaction: investment.transactions[0],
  };
}

// ------------------------------------------------------------
// LISTE INVESTISSEMENTS
// ------------------------------------------------------------

export async function listInvestments(userId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [investments, total] = await Promise.all([
    prisma.investment.findMany({
      where: { investorId: userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: { id: true, title: true, category: true, coverImageUrl: true },
        },
        transactions: {
          select: { status: true, provider: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.investment.count({ where: { investorId: userId } }),
  ]);

  return {
    investments: investments.map(inv => ({
      ...inv,
      amount: Number(inv.amount),
      platformFee: Number(inv.platformFee || 0),
    })),
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

// ------------------------------------------------------------
// ESCROW � MILESTONES
// ------------------------------------------------------------

export async function getInvestment(userId, investmentId) {
  const investment = await prisma.investment.findFirst({
    where: { id: investmentId, investorId: userId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          category: true,
          goalAmount: true,
          raisedAmount: true,
          coverImageUrl: true,
        },
      },
      transactions: {
        select: {
          status: true,
          provider: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      milestones: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!investment) {
    throw new AppError("Investissement introuvable.", 404, "NOT_FOUND");
  }

  return {
    ...investment,
    amount: Number(investment.amount),
    platformFee: Number(investment.platformFee || 0),
    project: investment.project ? {
      ...investment.project,
      raisedAmount: Number(investment.project.raisedAmount),
      goalAmount: Number(investment.project.goalAmount),
    } : null,
    transactions: investment.transactions.map(tx => ({
      ...tx,
      amount: Number(tx.amount),
    })),
  };
}

export async function createMilestone(investmentId, data, adminId) {
  const investment = await prisma.investment.findUnique({
    where: { id: investmentId },
    include: { project: true },
  });

  if (!investment) throw new AppError("Investissement introuvable.", 404, "NOT_FOUND");
  if (investment.status !== "in_escrow") {
    throw new AppError("L'investissement doit �tre en escrow.", 400, "INVALID_STATUS");
  }

  const milestone = await prisma.escrowMilestone.create({
    data: {
      investmentId,
      title: data.title,
      description: data.description,
      amountToRelease: data.amountToRelease,
      dueDate: new Date(data.dueDate),
      createdBy: adminId,
    },
  });

  return milestone;
}

export async function validateMilestone(milestoneId, adminId, notes) {
  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: { investment: true },
  });

  if (!milestone) throw new AppError("Milestone introuvable.", 404, "NOT_FOUND");
  if (milestone.status !== "pending") {
    throw new AppError("Le milestone doit �tre en attente.", 400, "INVALID_STATUS");
  }

  await prisma.$transaction([
    prisma.escrowMilestone.update({
      where: { id: milestoneId },
      data: { status: "released", validatedAt: new Date(), notes },
    }),
    prisma.investment.update({
      where: { id: milestone.investmentId },
      data: { status: "released" },
    }),
  ]);

  return { released: true, amount: milestone.amountToRelease };
}

export async function refundInvestment(investmentId, adminId, reason) {
  const investment = await prisma.investment.findUnique({
    where: { id: investmentId },
  });

  if (!investment) throw new AppError("Investissement introuvable.", 404, "NOT_FOUND");

  await prisma.investment.update({
    where: { id: investmentId },
    data: { status: "refunded", refundReason: reason },
  });

  return { refunded: true, amount: investment.amount };
}

// ------------------------------------------------------------
// CRON � ANNULER LES PAIEMENTS EXPIR�S
// ------------------------------------------------------------

export async function cancelExpiredPayments() {
  const now = new Date();

  const expiredTransactions = await prisma.paymentTransaction.findMany({
    where: {
      status: "initiated",
      expiresAt: { lt: now },
    },
    include: { investment: true },
  });

  let cancelledCount = 0;

  for (const transaction of expiredTransactions) {
    await prisma.$transaction([
      prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: "failed", errorMessage: "Expired" },
      }),
      prisma.investment.update({
        where: { id: transaction.investmentId },
        data: { status: "failed" },
      }),
    ]);
    cancelledCount++;
  }

  return { cancelledCount };
}

// ------------------------------------------------------------
// ADMIN � Lister tous les investissements
// ------------------------------------------------------------

export async function adminListInvestments({ page = 1, limit = 20, status }) {
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};

  const [investments, total] = await Promise.all([
    prisma.investment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        status: true,
        platformFee: true,
        createdAt: true,
        investor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        transactions: {
          select: { status: true, provider: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.investment.count({ where }),
  ]);

  const stats = await prisma.investment.groupBy({
    by: ["status"],
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    investments: investments.map(inv => ({
      ...inv,
      amount: Number(inv.amount),
      platformFee: Number(inv.platformFee || 0),
    })),
    total,
    totalPages: Math.ceil(total / limit),
    page,
    stats: stats.map(s => ({
      status: s.status,
      count: s._count.id,
      total: Number(s._sum.amount || 0),
    })),
  };
}
