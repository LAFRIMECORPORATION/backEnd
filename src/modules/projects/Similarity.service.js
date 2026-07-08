// ============================================================
// LAUNCHPAD — projects/similarity.service.js
// Similarité de projets : embeddings OpenAI + pgvector
// Fallback : similarité par catégorie + tags (sans IA)
// ============================================================

import prisma  from "../../config/database.js";
import { env } from "../../config/env.js";

// ════════════════════════════════════════════════════════════
// TROUVER LES PROJETS SIMILAIRES
// GET /api/projects/similar/:id
// ════════════════════════════════════════════════════════════
export async function findSimilarProjects(projectId, limit = 3) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: {
      id:          true,
      title:       true,
      description: true,
      category:    true,
      tags:        true,
      aiEmbedding: true,
    },
  });

  if (!project) return [];

  // Si on a un embedding ET OpenAI est dispo → similarité vectorielle
  if (project.aiEmbedding && env.OPENAI_API_KEY) {
    return findBySimilarityVector(project, limit);
  }

  // Sinon → fallback par catégorie + tags
  return findByTagsAndCategory(project, limit);
}

// ════════════════════════════════════════════════════════════
// GÉNÉRER ET STOCKER L'EMBEDDING D'UN PROJET
// Appelée après chaque publication de projet
// ════════════════════════════════════════════════════════════
export async function generateAndStoreEmbedding(projectId) {
  if (!env.OPENAI_API_KEY) {
    console.log(`🤖 [SANDBOX] Embedding simulé pour projet ${projectId}`);
    return null;
  }

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { title: true, description: true, category: true, tags: true },
  });

  if (!project) return null;

  try {
    // Construire le texte à embedder
    const text = [
      project.title,
      project.category,
      (project.tags || []).join(" "),
      project.description?.substring(0, 500) || "",
    ].join(" | ");

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small", // 1536 dimensions, peu coûteux
        input: text,
      }),
    });

    const data     = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding) throw new Error("Embedding vide retourné par OpenAI");

    // Stocker en DB (champ JSON — pgvector optionnel)
    await prisma.project.update({
      where: { id: projectId },
      data:  { aiEmbedding: embedding },
    });

    console.log(`✅ Embedding généré pour projet ${projectId} (${embedding.length} dims)`);
    return embedding;

  } catch (err) {
    console.error(`❌ Erreur embedding projet ${projectId}:`, err.message);
    return null;
  }
}

// ── Similarité vectorielle (cosinus) ─────────────────────────
async function findBySimilarityVector(project, limit) {
  // Récupérer tous les projets actifs avec embedding
  const allProjects = await prisma.project.findMany({
    where: {
      status:      "active",
      id:          { not: project.id },
      aiEmbedding: { not: null },
    },
    select: {
      id:           true,
      title:        true,
      category:     true,
      tags:         true,
      goalAmount:   true,
      raisedAmount: true,
      aiEmbedding:  true,
      coverImageUrl:true,
      author: { select: { firstName: true, lastName: true } },
    },
    take: 100, // Limiter pour éviter trop de calculs en mémoire
  });

  if (!allProjects.length) return findByTagsAndCategory(project, limit);

  // Calculer la similarité cosinus avec chaque projet
  const withScores = allProjects
    .map(p => ({
      ...p,
      similarity: cosineSimilarity(project.aiEmbedding, p.aiEmbedding),
    }))
    .filter(p => p.similarity > 0.5)   // Seuil minimum de similarité
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(p => {
      const { aiEmbedding, ...rest } = p; // Ne pas retourner l'embedding
      return { ...rest, similarityScore: Math.round(p.similarity * 100) };
    });

  return withScores.length > 0 ? withScores : findByTagsAndCategory(project, limit);
}

// ── Fallback : similarité par catégorie + tags ────────────────
async function findByTagsAndCategory(project, limit) {
  const tags = project.tags || [];

  const similar = await prisma.project.findMany({
    where: {
      status:   "active",
      id:       { not: project.id },
      OR: [
        { category: project.category },
        tags.length > 0 ? { tags: { hasSome: tags } } : {},
      ],
    },
    select: {
      id:           true,
      title:        true,
      category:     true,
      tags:         true,
      goalAmount:   true,
      raisedAmount: true,
      coverImageUrl:true,
      author: { select: { firstName: true, lastName: true } },
    },
    take:    limit * 3,
    orderBy: { raisedAmount: "desc" },
  });

  // Scorer manuellement selon les tags en commun
  return similar
    .map(p => {
      const commonTags = (p.tags || []).filter(t => tags.includes(t)).length;
      const score = (p.category === project.category ? 40 : 0) + (commonTags * 15);
      return { ...p, similarityScore: Math.min(99, score) };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

// ── Similarité cosinus ────────────────────────────────────────
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}