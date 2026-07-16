// ============================================================
// LAUNCHPAD — due-diligence/due-diligence.service.js
// Analyse IA des projets via OpenAI GPT-4
// Cache Redis (ou cache en mémoire si Redis absent)
// ============================================================

import prisma  from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Cache en mémoire (fallback si pas de Redis) ───────────────
const _cache = new Map(); // { projectId -> { data, expiresAt } }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getCached(projectId) {
  const entry = _cache.get(projectId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(projectId); return null; }
  return entry.data;
}
function setCache(projectId, data) {
  _cache.set(projectId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ════════════════════════════════════════════════════════════
// ANALYSER UN PROJET
// POST /api/due-diligence/analyze
// ════════════════════════════════════════════════════════════
export async function analyzeProject(projectId, userId) {
  // 1. Récupérer le projet complet
  const project = await prisma.project.findFirst({
    where:  { id: projectId, status: { in: ["active", "funded"] } },
    select: {
      id:          true,
      title:       true,
      description: true,
      category:    true,
      tags:        true,
      goalAmount:  true,
      raisedAmount:true,
      equityPct:   true,
      equityType:  true,
      deadline:    true,
      teamSize:    true,
      stage:       true,
      author: {
        select: {
          firstName:      true,
          lastName:       true,
          reputationScore:true,
          kycValidated:   true,
          profile: { select: { university: true, bio: true } },
        },
      },
      _count: {
        select: { investments: true, comments: true, likes: true },
      },
    },
  });

  if (!project) throw new AppError("Projet introuvable ou non disponible.", 404, "NOT_FOUND");

  // 2. Vérifier le cache
  const cached = getCached(projectId);
  if (cached) return { ...cached, fromCache: true };

  // 3. Vérifier si une analyse récente existe en DB (< 24h)
  const existing = await prisma.dueDiligenceReport.findFirst({
    where: {
      projectId,
      createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    setCache(projectId, existing);
    return { ...existing, fromCache: true };
  }

  // 4. Générer l'analyse via OpenAI
  const report = await generateAIReport(project);

  // 5. Sauvegarder en DB
  const saved = await prisma.dueDiligenceReport.create({
    data: {
      projectId,
      requestedBy: userId,
      score:       report.score,
      risk:        report.risk,
      reportData:  report,
    },
  });

  // 6. Mettre en cache
  setCache(projectId, saved);

  // 7. Logger l'utilisation
  await prisma.auditLog.create({
    data: {
      actorId:    userId,
      action:     "DUE_DILIGENCE_REQUESTED",
      entityType: "project",
      entityId:   projectId,
      newValues:  { score: report.score, risk: report.risk },
    },
  }).catch(console.error);

  return saved;
}

// ════════════════════════════════════════════════════════════
// RÉCUPÉRER LE DERNIER RAPPORT D'UN PROJET
// GET /api/due-diligence/:projectId
// ════════════════════════════════════════════════════════════
export async function getReport(projectId) {
  const cached = getCached(projectId);
  if (cached) return { ...cached, fromCache: true };

  const report = await prisma.dueDiligenceReport.findFirst({
    where:   { projectId },
    orderBy: { createdAt: "desc" },
  });

  if (!report) throw new AppError("Aucune analyse disponible pour ce projet.", 404, "NOT_FOUND");

  setCache(projectId, report);
  return report;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR D'ANALYSE IA
// ════════════════════════════════════════════════════════════
async function generateAIReport(project) {
  const fundingPct = project.goalAmount > 0
    ? Math.round((Number(project.raisedAmount) / Number(project.goalAmount)) * 100)
    : 0;

  const daysLeft = project.deadline
    ? Math.max(0, Math.round((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const prompt = buildPrompt(project, fundingPct, daysLeft);

  if (env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:       "gpt-4o-mini", // Moins cher que GPT-4, suffisant pour l'analyse
          max_tokens:  1500,
          temperature: 0.3,           // Réponses plus déterministes
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: prompt },
          ],
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("❌ OpenAI error:", data.error.message);
        return generateFallbackReport(project, fundingPct);
      }

      const text = data.choices[0].message.content;

      // Parser le JSON retourné par GPT
      try {
        const clean = text.replace(/```json|```/g, "").trim();
        return JSON.parse(clean);
      } catch {
        console.error("❌ Parsing GPT response failed:", text);
        return generateFallbackReport(project, fundingPct);
      }

    } catch (err) {
      console.error("❌ OpenAI fetch error:", err.message);
      return generateFallbackReport(project, fundingPct);
    }
  }

  // Mode sandbox : rapport simulé réaliste
  console.log(`🤖 [SANDBOX IA] Rapport simulé pour le projet "${project.title}"`);
  return generateFallbackReport(project, fundingPct);
}

// ── Prompt système ────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un analyste senior en capital-risque spécialisé dans les startups d'Afrique subsaharienne, particulièrement au Cameroun et en Afrique centrale.

Tu analyses des projets soumis sur Launchpad, une plateforme de financement participatif camerounaise.

Retourne UNIQUEMENT un objet JSON valide (sans Markdown, sans backticks) avec cette structure exacte :
{
  "score": <nombre entre 0 et 100>,
  "risk": <"Faible" | "Modéré" | "Élevé">,
  "summary": <résumé de 2 phrases>,
  "market": { "score": <0-25>, "analysis": <2 phrases>, "opportunity": <1 phrase> },
  "team": { "score": <0-25>, "analysis": <2 phrases>, "strength": <1 phrase> },
  "finance": { "score": <0-25>, "analysis": <2 phrases>, "viability": <1 phrase> },
  "traction": { "score": <0-25>, "analysis": <2 phrases> },
  "redFlags": [<max 4 points négatifs concis>],
  "strengths": [<max 4 points positifs concis>],
  "questions": [<4 questions pertinentes à poser à l'équipe>],
  "recommendation": <"Investir" | "À surveiller" | "Risqué" | "Déconseillé">
}

Contexte africain à considérer :
- Marché camerounais : 28 millions d'habitants, taux de pénétration mobile > 80%
- Mobile Money dominant (MTN, Orange) — avantage pour les FinTech
- Secteurs porteurs : AgriTech, FinTech, HealthTech, EdTech, LogisTech
- Défis locaux : infrastructure, accès au financement, régulation
- Comparer aux standards de la région CEMAC, pas aux standards Silicon Valley`;

// ── Prompt utilisateur ────────────────────────────────────────
function buildPrompt(project, fundingPct, daysLeft) {
  return `Analyse ce projet de startup camerounaise :

PROJET : ${project.title}
CATÉGORIE : ${project.category}
STADE : ${project.stage || "Non précisé"}
TAGS : ${(project.tags || []).join(", ") || "Aucun"}

DESCRIPTION :
${project.description}

ÉQUIPE :
- Fondateur : ${project.author.firstName} ${project.author.lastName}
- Établissement : ${project.author.profile?.university || "Non précisé"}
- Bio : ${project.author.profile?.bio || "Non précisée"}
- Score réputation Launchpad : ${project.author.reputationScore || 0}/100
- KYC Vérifié : ${project.author.kycValidated ? "Oui ✅" : "Non ❌"}
- Taille équipe : ${project.teamSize || 1} personne(s)

DONNÉES FINANCIÈRES :
- Objectif de levée : ${Number(project.goalAmount).toLocaleString("fr-FR")} XAF
- Montant levé : ${Number(project.raisedAmount).toLocaleString("fr-FR")} XAF (${fundingPct}%)
- Équité proposée : ${project.equityPct || "Non précisée"}%
- Jours restants : ${daysLeft !== null ? daysLeft : "Pas de deadline"}

TRACTION :
- Investisseurs : ${project._count.investments}
- Likes : ${project._count.likes}
- Commentaires : ${project._count.comments}`;
}

// ── Rapport de fallback (sandbox ou erreur OpenAI) ────────────
function generateFallbackReport(project, fundingPct) {
  const score = Math.min(85, Math.max(30,
    40
    + (fundingPct > 50 ? 15 : fundingPct > 20 ? 8 : 0)
    + (project.author.kycValidated ? 10 : 0)
    + (project._count.investments > 0 ? 10 : 0)
    + (project.teamSize > 1 ? 5 : 0)
    + (project.author.reputationScore > 50 ? 5 : 0)
  ));

  const risk = score >= 65 ? "Faible" : score >= 45 ? "Modéré" : "Élevé";

  return {
    score,
    risk,
    summary:        `Projet ${project.category} dans le marché camerounais avec un potentiel ${score >= 65 ? "solide" : "à confirmer"}. Une analyse approfondie de l'équipe et du marché cible est recommandée.`,
    market:         { score: Math.round(score * 0.25), analysis: `Le marché ${project.category} en Afrique centrale présente des opportunités de croissance. La demande locale est en expansion avec la digitalisation progressive.`, opportunity: "Potentiel de scale régional CEMAC après validation locale." },
    team:           { score: Math.round(score * 0.25), analysis: `L'équipe de ${project.teamSize || 1} personne(s) ${project.author.kycValidated ? "avec profil vérifié" : "sans vérification KYC"}. L'expérience sectorielle reste à démontrer.`, strength: "Engagement entrepreneurial visible sur la plateforme." },
    finance:        { score: Math.round(score * 0.25), analysis: `Objectif de ${Number(project.goalAmount).toLocaleString("fr-FR")} XAF avec ${fundingPct}% atteint. Les projections financières méritent une validation indépendante.`, viability: "Modèle économique à confirmer avec des données de revenus réels." },
    traction:       { score: Math.round(score * 0.25), analysis: `${project._count.investments} investisseur(s) et ${project._count.likes} like(s) sur la plateforme. La traction reste précoce.` },
    redFlags:       ["Données financières prévisionnelles non auditées", "Équipe de petite taille pour l'ambition du projet", "Absence de revenus récurrents documentés", "Marché concurrentiel avec acteurs établis"],
    strengths:      ["Marché local avec fort potentiel de croissance", project.author.kycValidated ? "Fondateur KYC vérifié ✅" : "Projet innovant sur le marché local", `Secteur ${project.category} en expansion en Afrique centrale`, "Présence sur Launchpad avec engagement communautaire"],
    questions:      ["Quelle est votre stratégie d'acquisition des premiers 100 clients ?", "Comment gérez-vous la concurrence des acteurs informels locaux ?", "Quel est votre plan de rentabilité sur 18 mois ?", "Avez-vous des partenariats avec des structures locales établies ?"],
    recommendation: score >= 65 ? "À surveiller" : score >= 50 ? "À surveiller" : "Risqué",
    generatedAt:    new Date().toISOString(),
    isSandbox:      !env.OPENAI_API_KEY,
  };
}