# Analyse du backend

> **État révisé le 2026-10-07.** Les observations générales ci-dessous sont
> complétées par les contrats Academy actuels : le module prend en charge
> catalogue public, cours administrés, inscriptions/progression, likes et
> commentaires persistés. Les contrôles vérifiés pour le dernier correctif
> sont `node --check` sur les fichiers Academy concernés et `npx prisma validate`.
> Cela ne constitue pas une validation end-to-end contre une base active.

> **Cohérence de démarrage — 2026-10-07 :** `.env.example` contient les
> variables obligatoires et des valeurs locales d'exemple ; le port backend
> par défaut est aligné sur le frontend (`5000`). `npm test` exécute les tests
> Node natifs des contrats Academy, forum et validation admin. Aucun test
> end-to-end avec une base active n'est encore configuré.

## 1. Architecture backend

Le backend est structuré par composants métier :

- auth
- users
- projects
- kyc
- payments
- notifications
- feed
- messages / conversations
- forum
- due diligence
- investor requests
- admin

Cette organisation est un bon point de départ pour un système robuste et évolutif.

## 2. Points forts

- bon découpage fonctionnel par domaine
- Prisma bien exploité pour la persistance
- présence de validations et de middlewares de sécurité
- routes déjà présentes pour les modules liés au produit et aux opérations critiques

## 3. Points de vigilance

- certains dossiers et fichiers présentent des incohérences de nommage
- la maturité des modules n’est pas homogène
- certaines routes doivent être alignées avec le front pour éviter des défauts de contrat API
- les modules sensibles requièrent une validation plus strictes : paiements, admin, KYC, messages

## 4. Analyse par module

### Auth

- solide et centralisé
- gestion des tokens et de la session déjà bien préparée

### Users

- gestion des profils, rôles et access control déjà présente
- le point d’attention est la cohérence d’édition de profil entre les rôles

### Projects

- module central du produit
- assez avancé dans la logique de publication et de validation
- il faut sécuriser les validations et la cohérence des données

### Messages

- important pour le produit
- demande une stabilité sur la persistance, les états lus et les événements temps réel

### Payments / escrow

- modules critiques
- nécessitent vérification de sécurité, permissions et mécanismes de validation

### Admin

- nécessaire pour gouverner le produit
- contrôle, validation, supervision doivent être stricts et testés

### Academy

- Le catalogue public renvoie uniquement les formations publiées.
- Le détail d'une formation accepte l'authentification facultative : les
  visiteurs peuvent lire le cours et les commentaires ; un compte connecté
  reçoit aussi son état `likedByMe`.
- Likes et commentaires sont persistés par Prisma. La relation Academy d'un
  commentaire est `user` (pas `author`) ; la réponse conserve `user` et fournit
  un alias `author` avec le nom pour l'affichage frontend.
- Les mutations de likes et commentaires nécessitent une session ; la
  validation Zod borne le contenu et le corps de la requête.
- L'accès et les scénarios de base doivent encore être validés avec une API et
  une base de données réellement démarrées.

Les contrats frontend sont centralisés dans `LaunchPad/src/utils/api.js` et les
routes correspondantes dans `src/modules/academy/academy.router.js`.

## 5. Bugs et incohérences détectées

- nommage de modules parfois incohérent
- routes non homogénéisées entre front et back
- certains modules sont plus avancés que d’autres
- certaines validations métier peuvent manquer de couverture
- la documentation des API est insuffisante pour éviter les erreurs de contrat

## 6. Plan de refonte backend priorisé

1. Standardiser les dossiers, fichiers et routes
2. Normaliser les contrats API et les payloads
3. Séparer contrôleurs, services et validations plus clairement
4. Centraliser la gestion des erreurs métier
5. Ajouter les tests de contrat et de permissions
6. Vérifier les modules critiques en QA fonctionnelle avant production

## 7. Conclusion

Le backend est bien lancé et démontre une vraie intention de produit. L’étape suivante n’est pas d’ajouter de nouveaux modules, mais de rationaliser les conventions et sécuriser les flux critiques.
