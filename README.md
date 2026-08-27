# Exam Hub — Backend

API REST de gestion d'examens QCM.
Node.js + Express + TypeScript, PostgreSQL en SQL brut via `pg`, sans ORM.

> **État : backend complet et audité (phase B11).**
> Les 23 routes imposées et les règles RG-01 à RG-13 sont implémentées et
> vérifiées par 605 tests automatisés.

## Prérequis

- Node.js 20 ou supérieur
- npm 10 ou supérieur
- Docker et Docker Compose (à partir de la phase B2)

## Installation

```bash
cd examHub/examHubBackend
npm install
cp .env.example .env
```

Ouvrir `.env` et renseigner au minimum `DB_PASSWORD` et `SEED_ADMIN_PASSWORD`.
Le fichier `.env` n'est jamais versionné ; `.env.example` documente chaque
variable attendue. Ce même fichier alimente `docker compose` et le backend :
il n'y a rien à recopier ailleurs.

Puis démarrer la base et l'initialiser :

```bash
npm run db:up          # démarre le conteneur PostgreSQL
docker compose ps      # attendre l'état « healthy »
npm run db:migrate     # crée le schéma
npm run db:seed        # crée le premier administrateur (RG-01)
npm run db:seed:demo   # optionnel : jeu de démonstration
```

## Lancement

```bash
npm run dev        # développement, rechargement à chaud (tsx)
npm run build      # compilation TypeScript vers dist/
npm start          # exécution du code compilé
npm run typecheck  # vérification des types sans émettre de fichiers
```

L'API écoute par défaut sur `http://localhost:3000`, toutes les routes étant
préfixées par `/api`.

## Architecture

L'application respecte une structure en couches stricte. Chaque couche ne
communique qu'avec la suivante :

```
Controller/  →  Service/  →  Repositorie/  →  PostgreSQL
                   ↕
              Security/        Model/
```

| Dossier        | Responsabilité                                                        |
| -------------- | --------------------------------------------------------------------- |
| `Controller/`  | Routage Express, lecture de la requête, écriture de la réponse         |
| `Service/`     | Règles de gestion et orchestration ; ignore Express et SQL             |
| `Repositorie/` | Accès PostgreSQL en SQL brut, requêtes systématiquement paramétrées    |
| `Model/`       | Types et entités du domaine                                            |
| `Security/`    | bcrypt, JWT, middlewares d'authentification et d'autorisation          |
| `Config/`      | Chargement et validation de la configuration                           |
| `Database/`    | Pool `pg`, exécuteur de migrations, données initiales                  |
| `Middleware/`  | Erreurs centralisées, validation des entrées, journalisation           |

Règle stricte : **aucune requête SQL en dehors de `Repositorie/`**. Un
Controller ne connaît ni `pg` ni la forme des tables ; un Service ne connaît ni
`req` ni `res`. La chaîne du contrôle de santé illustre le découpage :
`HealthController` → `HealthService` → `HealthRepositorie` → PostgreSQL.

## Format des erreurs

Conformément à RG-13, toute erreur est renvoyée sous la forme
`{ "message": "..." }` avec le code HTTP correspondant : 400 données
invalides, 401 non authentifié, 403 non autorisé, 404 introuvable,
409 conflit.

Aucun contrôleur n'écrit lui-même une réponse d'erreur : il lève une
`HttpError` et le gestionnaire centralisé s'occupe du reste. Trois familles
d'erreurs sont traitées :

| Origine                          | Traitement                                        |
| -------------------------------- | ------------------------------------------------- |
| `HttpError` levée par un Service | Code et message transmis tels quels                |
| Violation de contrainte `pg`     | Traduite en message métier (`postgresErrors.ts`)   |
| Corps JSON malformé              | 400, message explicite                             |
| Tout le reste                    | 500 générique ; le détail reste dans les journaux  |

En production, aucun détail interne (SQL, pile d'appel, nom de contrainte) ne
sort vers le client.

## Validation des entrées

Aucune donnée du client n'atteint la couche Service sans passer par
`Middleware/validation.ts`. Les erreurs sont accumulées puis levées ensemble,
si bien que le client reçoit la liste complète des problèmes d'un coup :

```json
{ "message": "Données invalides : email est requis ; points doit être un nombre entier." }
```

Les identifiants d'URL passent par `parseResourceId`, ce qui garantit qu'une
valeur non numérique produit un 400 plutôt qu'une erreur PostgreSQL. Les mots
de passe ne figurent jamais dans un message d'erreur ni dans les journaux.

## Routes disponibles à ce stade

| Méthode  | Route                 | Accès  | Description                              |
| -------- | --------------------- | ------ | ---------------------------------------- |
| `GET`    | `/api/health`         | public | Disponibilité de l'API et de PostgreSQL  |
| `POST`   | `/api/auth/login`     | public | Connexion, émission d'un JWT             |
| `GET`    | `/api/students`       | admin  | Liste des étudiants                      |
| `POST`   | `/api/students`       | admin  | Création d'un compte étudiant            |
| `PUT`    | `/api/students/:id`   | admin  | Modification, réinitialisation, réactivation |
| `DELETE` | `/api/students/:id`   | admin  | **Désactivation** (jamais suppression)   |
| `GET`    | `/api/courses`        | admin  | Liste des cours                          |
| `POST`   | `/api/courses`        | admin  | Création d'un cours                      |
| `PUT`    | `/api/courses/:id`    | admin  | Modification                             |
| `DELETE` | `/api/courses/:id`    | admin  | Suppression — refusée si examens rattachés |
| `GET`    | `/api/exams`          | admin  | Liste des examens, filtrable par cours   |
| `POST`   | `/api/exams`          | admin  | Création d'un examen                     |
| `GET`    | `/api/exams/:id`      | admin  | Détail d'un examen                       |
| `PUT`    | `/api/exams/:id`      | admin  | Modification                             |
| `DELETE` | `/api/exams/:id`      | admin  | Suppression — refusée si tentatives      |
| `GET`    | `/api/exams/:id/questions` | admin | Sujet complet, avec `isCorrect`      |
| `POST`   | `/api/exams/:id/questions` | admin | Ajout d'une question et de ses choix |
| `PUT`    | `/api/questions/:id`  | admin  | Remplacement complet de la question      |
| `DELETE` | `/api/questions/:id`  | admin  | Suppression de la question et des choix  |
| `GET`    | `/api/my/exams`       | étudiant | Examens disponibles maintenant         |
| `GET`    | `/api/my/exams/:id`   | étudiant | Sujet à composer, **sans** `isCorrect` |
| `POST`   | `/api/my/exams/:id/submit` | étudiant | Soumission, note et correction    |
| `GET`    | `/api/exams/:id/results` | admin | Notes, moyenne, nombre de tentatives |
| `GET`    | `/api/my/results`     | étudiant | Historique personnel                  |

`/api/health` renvoie `200` si la base répond, `503` sinon.

## Authentification

Connexion par email et mot de passe, jeton JWT signé en HS256 transmis ensuite
dans l'en-tête `Authorization: Bearer <token>`.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@examhub.local","password":"..."}'
```

Réponse :

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 1, "fullName": "Administrateur",
            "email": "admin@examhub.local", "role": "ADMIN", "isActive": true }
}
```

Le mot de passe et son hachage ne figurent dans aucune réponse. La séparation
est portée par le typage : `UserWithPassword` ne sort jamais de la couche
Service, seul `PublicUser` atteint un Controller.

### Codes de réponse

| Situation                                | Code | Message                              |
| ---------------------------------------- | ---- | ------------------------------------ |
| Identifiants corrects                    | 200  | jeton et profil                      |
| Email inconnu **ou** mot de passe erroné | 401  | *Email ou mot de passe incorrect.*   |
| Compte désactivé (RG-11)                 | 403  | message distinct et explicite        |
| Champ manquant ou email malformé         | 400  | détail des champs en cause           |
| Jeton absent                             | 401  | *Authentification requise…*          |
| Jeton invalide, forgé ou expiré          | 401  | message adapté au cas                |
| Rôle insuffisant                         | 403  | *Vous n'avez pas les droits…*        |

Deux points de conception méritent attention :

- **Email inconnu et mot de passe erroné renvoient le même message.** Les
  distinguer transformerait la page de connexion en annuaire de comptes. Le
  temps de réponse est également égalisé, faute de quoi la différence de durée
  suffirait à énumérer les comptes existants.
- **Le mot de passe est vérifié avant l'état du compte.** Annoncer « compte
  désactivé » à qui n'a pas prouvé son identité révélerait l'existence du
  compte à un tiers. RG-11 est ainsi respectée sans créer d'oracle : seul le
  titulaire légitime apprend que son compte est désactivé.

### Protection des routes

```ts
router.get('/students', requireAuth, requireAdmin, asyncHandler(...));
```

`requireAuth` vérifie le jeton **puis relit le compte en base**. Un jeton reste
cryptographiquement valide jusqu'à son expiration, mais une désactivation prend
effet immédiatement (RG-10, RG-11), sans attendre. La base fait foi, jamais le
jeton : un rôle modifié après émission invalide la session.

L'algorithme de vérification est imposé explicitement (`HS256`), ce qui écarte
les jetons présentés avec `alg: none` ou un algorithme substitué.

## Base de données

PostgreSQL 16 dans un conteneur dédié (`docker-compose.yml`). Le port n'est
exposé que sur `127.0.0.1`, et les données persistent dans le volume nommé
`examhub_pgdata`.

| Commande               | Effet                                              |
| ---------------------- | -------------------------------------------------- |
| `npm run db:up`        | Démarre le conteneur                               |
| `npm run db:down`      | Arrête le conteneur, conserve les données          |
| `npm run db:reset`     | Détruit le volume et repart d'une base vierge      |
| `npm run db:migrate`   | Applique les migrations non encore appliquées      |
| `npm run db:seed`      | Crée l'administrateur initial                      |
| `npm run db:seed:demo` | Ajoute un jeu de démonstration                     |
| `npm run db:psql`      | Ouvre un shell `psql` dans le conteneur            |

Migrations et données initiales sont idempotentes : les relancer sur une base
à jour ne produit aucun effet et n'écrase aucun mot de passe.

### Modèle de données

```
courses ──< exams ──< questions ──< choices
                │          │            │
                └──< attempts ──< answers
                          │            │
users (STUDENT) ──────────┘            │
                                       │
                    (attempt, question, choice) : cohérence
                    garantie par clés étrangères composites
```

Les règles de gestion sont portées par le schéma lui-même :

| Règle | Garantie en base                                                        |
| ----- | ----------------------------------------------------------------------- |
| RG-02 | `UNIQUE (exam_id, student_id)` sur `attempts`                            |
| RG-04 | Index unique partiel + trigger de contrainte différé sur `choices`       |
| RG-05 | Une question sans réponse n'a pas de ligne dans `answers`                |
| RG-08 | Triggers bloquant toute écriture sur un examen ayant des tentatives      |
| RG-09 | `ON DELETE RESTRICT` sur `exams.course_id` et `attempts.exam_id`         |
| RG-10 | `ON DELETE RESTRICT` sur `attempts.student_id`, colonne `is_active`      |
| Rôle unique | Colonne `role` non nullable de type ENUM ; un admin ne peut pas être auteur d'une tentative (clé étrangère composite) |

Le serveur applique les mêmes règles en amont pour produire des messages
d'erreur exploitables (RG-13) ; la base reste le dernier rempart.

## Comptes de test

Après `npm run db:seed` puis `npm run db:seed:demo`, avec les valeurs par
défaut de `.env.example` :

| Rôle      | Email                 | Mot de passe            | État       |
| --------- | --------------------- | ----------------------- | ---------- |
| Admin     | `admin@examhub.local` | `SEED_ADMIN_PASSWORD`   | actif      |
| Étudiant  | `amina@examhub.local` | `SEED_STUDENT_PASSWORD` | actif      |
| Étudiant  | `bruno@examhub.local` | `SEED_STUDENT_PASSWORD` | actif      |
| Étudiant  | `chloe@examhub.local` | `SEED_STUDENT_PASSWORD` | actif      |
| Étudiant  | `david@examhub.local` | `SEED_STUDENT_PASSWORD` | désactivé  |

Le compte désactivé permet d'éprouver RG-11. Le jeu de démonstration contient
aussi un examen à fenêtre fermée, pour éprouver RG-03.

## Gestion des étudiants

Toutes ces routes exigent un jeton d'administrateur. Un étudiant qui les
appelle directement reçoit un `403`, quelle que soit l'interface utilisée.

### Lister

```bash
curl $API/students -H "Authorization: Bearer $TOKEN"
curl "$API/students?active=true"  -H "Authorization: Bearer $TOKEN"
curl "$API/students?active=false" -H "Authorization: Bearer $TOKEN"
```

Sans filtre, la liste contient les comptes actifs **et** désactivés :
l'administrateur doit pouvoir consulter les résultats de ces derniers (RG-10).

### Créer

```bash
curl -X POST $API/students -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Fatou Sow","email":"fatou@examhub.local","password":"MotDePasse1!"}'
```

Le rôle n'est pas paramétrable : un champ `role` envoyé par le client est
ignoré, cette route ne crée que des étudiants. Mot de passe d'au moins
8 caractères, haché avec bcrypt avant d'atteindre la base.

### Modifier et réinitialiser

`PUT` accepte une modification partielle. Les champs absents restent
inchangés ; il faut au moins un champ, sans quoi la requête est refusée.

| Champ      | Effet                                            |
| ---------- | ------------------------------------------------ |
| `fullName` | Renomme l'étudiant                               |
| `email`    | Change l'adresse — refusée si déjà prise (`409`)  |
| `password` | **Réinitialise** le mot de passe (nouveau hachage) |
| `isActive` | Réactive un compte désactivé                     |

L'ancien mot de passe n'est pas demandé : c'est l'administrateur qui agit,
précisément parce que l'étudiant l'a perdu.

### Désactiver (RG-10)

```bash
curl -X DELETE $API/students/8 -H "Authorization: Bearer $TOKEN"
```

```json
{
  "message": "Étudiant désactivé. Ses résultats restent consultables.",
  "student": { "id": 8, "isActive": false, ... }
}
```

`DELETE` **ne supprime rien**. Il n'existe aucune instruction `DELETE FROM
users` dans le projet : la ligne est conservée, les tentatives et les réponses
de l'étudiant restent intactes, et il n'apparaît plus qu'en lecture pour
l'administrateur. L'étudiant désactivé ne peut plus se connecter (RG-11), et
un jeton émis avant la désactivation cesse immédiatement de fonctionner.

L'opération est idempotente : désactiver un compte déjà désactivé renvoie
`200`, l'état visé étant atteint dans les deux cas.

### Codes de réponse

| Situation                                      | Code |
| ---------------------------------------------- | ---- |
| Succès (`GET`, `PUT`, `DELETE`)                | 200  |
| Création                                       | 201  |
| Champ manquant, invalide, ou identifiant non numérique | 400 |
| Jeton absent ou invalide                       | 401  |
| Jeton d'étudiant sur une route admin           | 403  |
| Étudiant inexistant — ou identifiant d'un administrateur | 404 |
| Email déjà utilisé                             | 409  |

Un identifiant d'administrateur présenté à `/api/students/:id` produit un
`404` : toutes les requêtes filtrent sur `role = 'STUDENT'`, si bien que cet
endpoint ne peut pas servir à modifier ou désactiver un administrateur.

## Gestion des cours

Routes réservées à l'administrateur.

### Lister

```bash
curl $API/courses -H "Authorization: Bearer $TOKEN"
```

```json
[{ "id": 1, "code": "PROG2", "name": "Programmation avancée",
   "description": "...", "examCount": 2,
   "createdAt": "...", "updatedAt": "..." }]
```

`examCount` est calculé à chaque lecture plutôt que stocké : une valeur
dénormalisée pourrait diverger de la réalité, alors que c'est précisément elle
qui indique à l'interface si un cours est supprimable. Le champ informe,
il ne protège pas — la règle reste appliquée côté serveur.

### Créer et modifier

```bash
curl -X POST $API/courses -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"code":"ALGO1","name":"Algorithmique","description":"Complexité et structures."}'
```

Le code doit comporter de 2 à 20 caractères, uniquement lettres, chiffres,
tirets ou soulignés — même règle que la contrainte `courses_code_format` en
base. La description est facultative.

L'unicité du code est **insensible à la casse** : `PROG2` et `prog2` sont le
même code, la colonne étant de type CITEXT. Un doublon renvoie `409`.

`PUT` accepte une modification partielle ; les champs absents restent
inchangés, et il faut au moins un champ.

### Supprimer (RG-09)

```bash
curl -X DELETE $API/courses/1 -H "Authorization: Bearer $TOKEN"
```

Contrairement aux étudiants, un cours est réellement supprimé : ce n'est pas
une personne, rien n'impose de le conserver. En revanche, **un cours portant
des examens ne peut pas l'être** :

```json
{ "message": "Ce cours ne peut pas être supprimé : 2 examen(s) y sont rattaché(s). Supprimez ou déplacez ces examens au préalable." }
```

Double garantie : le Service compte les examens et refuse avec un message
chiffré, et la clé étrangère `exams_course_fk` (`ON DELETE RESTRICT`) bloque
la suppression même par un `DELETE` SQL direct.

### Codes de réponse

| Situation                                   | Code |
| ------------------------------------------- | ---- |
| Succès (`GET`, `PUT`, `DELETE`)             | 200  |
| Création                                    | 201  |
| Code mal formé, nom manquant, aucun champ, identifiant non numérique | 400 |
| Jeton absent ou invalide                    | 401  |
| Jeton d'étudiant sur une route admin        | 403  |
| Cours inexistant                            | 404  |
| Code déjà utilisé, ou cours portant des examens | 409 |

## Gestion des examens

Routes réservées à l'administrateur. Les routes étudiantes
(`/api/my/exams`) sont indépendantes et arriveront en phase B9.

### Lister et consulter

```bash
curl $API/exams -H "Authorization: Bearer $TOKEN"
curl "$API/exams?courseId=1" -H "Authorization: Bearer $TOKEN"
curl $API/exams/1 -H "Authorization: Bearer $TOKEN"
```

```json
{
  "id": 1, "courseId": 1, "courseCode": "PROG2",
  "courseName": "Programmation avancée",
  "title": "Contrôle continu n°1",
  "availableFrom": "2026-08-25T05:25:58.374Z",
  "availableTo":   "2026-08-28T05:25:58.374Z",
  "status": "OPEN",
  "questionCount": 3, "totalPoints": 6, "attemptCount": 0
}
```

Le cours est joint à la lecture, ce qui évite un aller-retour supplémentaire
pour afficher un libellé.

`status` vaut `UPCOMING`, `OPEN` ou `CLOSED`, calculé par PostgreSQL avec son
propre `now()` : la valeur ne dépend ni de l'horloge du client, ni de celle du
processus Node. **Ce champ n'autorise rien** — il sert à l'affichage
administrateur. RG-03 sera appliquée à chaque affichage et à chaque soumission
côté serveur, en phases B9 et B10.

`attemptCount` signale le verrouillage : dès qu'il dépasse zéro, les questions
et les choix sont gelés (RG-08) et l'examen ne peut plus être supprimé (RG-09).

Le détail **n'inclut pas les questions** : elles ont leur propre route,
`/api/exams/:id/questions`, en phase B8.

### Créer et modifier

```bash
curl -X POST $API/exams -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"courseId":1,"title":"Partiel final","description":"2 heures.",
       "availableFrom":"2026-09-01T08:00:00Z","availableTo":"2026-09-01T10:00:00Z"}'
```

`courseId`, `title`, `availableFrom` et `availableTo` sont obligatoires ; la
description est facultative. Les dates sont attendues au format ISO 8601 et
stockées en `TIMESTAMPTZ`.

La fin doit être **strictement postérieure** au début. Sur une modification
partielle, la cohérence est vérifiée sur la fenêtre *résultante* : ne changer
que `availableTo` échoue si la nouvelle valeur précède le `availableFrom`
existant.

Un examen peut être déplacé vers un autre cours, corrigé ou reprogrammé même
après le début des passages : RG-08 gèle le **contenu du sujet**, pas ses
métadonnées.

### Supprimer (RG-09)

```bash
curl -X DELETE $API/exams/1 -H "Authorization: Bearer $TOKEN"
```

Un examen sans tentative est supprimé avec ses questions et ses choix, qui
n'ont aucune existence propre. En revanche :

```json
{ "message": "Cet examen ne peut pas être supprimé : 1 tentative(s) y sont enregistrée(s). Supprimer l'examen effacerait les résultats des étudiants concernés." }
```

Double garantie, comme pour les cours : le Service compte les tentatives et
refuse avec un message chiffré, et la clé étrangère `attempts_exam_fk`
(`ON DELETE RESTRICT`) bloque même un `DELETE` SQL direct.

### Codes de réponse

| Situation                                          | Code |
| -------------------------------------------------- | ---- |
| Succès (`GET`, `PUT`, `DELETE`)                    | 200  |
| Création                                           | 201  |
| Champ manquant ou invalide, date mal formée, fenêtre incohérente, identifiant non numérique | 400 |
| Jeton absent ou invalide                           | 401  |
| Jeton d'étudiant sur une route admin               | 403  |
| Examen inexistant, ou cours référencé inexistant   | 404  |
| Examen possédant des tentatives                    | 409  |

## Gestion des questions

Routes réservées à l'administrateur. Les choix n'ont pas de route propre :
ils sont imbriqués dans la question et remplacés en bloc.

### Lire le sujet

```bash
curl $API/exams/1/questions -H "Authorization: Bearer $TOKEN"
```

```json
{
  "examId": 1, "examTitle": "Contrôle continu n°1",
  "locked": false, "attemptCount": 0, "totalPoints": 6,
  "questions": [{
    "id": 1, "statement": "…", "points": 2, "position": 1,
    "choices": [
      { "id": 1, "label": "let",   "isCorrect": false, "position": 1 },
      { "id": 2, "label": "const", "isCorrect": true,  "position": 2 }
    ]
  }]
}
```

`locked` passe à `true` dès la première tentative : l'interface peut alors
griser l'éditeur. Le champ informe, il ne protège pas.

### Créer et modifier

```bash
curl -X POST $API/exams/1/questions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"statement":"Quel port utilise HTTPS ?","points":2,
       "choices":[{"label":"80"},{"label":"443","isCorrect":true},{"label":"8080"}]}'
```

`isCorrect` est facultatif et vaut faux par défaut : il suffit de marquer la
bonne réponse. `points` vaut 1 par défaut.

Les **positions ne sont jamais fournies par le client** : celle de la question
est calculée côté serveur (`max + 1`), celles des choix découlent de l'ordre du
tableau. Deux questions ne peuvent donc pas revendiquer la même place, et le
client n'a pas à gérer une numérotation dont il ignore l'état.

`PUT` est un **remplacement complet** : énoncé, barème et intégralité des choix.
Réconcilier l'ancien et le nouveau jeu choix par choix n'apporterait rien —
une question modifiable n'a par définition aucune réponse enregistrée (RG-08).

À la suppression, la numérotation des questions suivantes est resserrée pour
ne pas laisser de trou dans l'ordre d'affichage.

### RG-04 — de 2 à 6 choix, exactement un correct

Trois garanties superposées :

| Niveau       | Mécanisme                                                    |
| ------------ | ------------------------------------------------------------ |
| Controller   | Cardinalité du tableau, type de chaque champ                  |
| Service      | Exactement un correct, aucun doublon d'intitulé               |
| PostgreSQL   | Index unique partiel + déclencheur de contrainte différé      |

Le dernier niveau est le seul qui compte vraiment : un `INSERT` SQL direct
créant une question à un seul choix, ou à deux bonnes réponses, est refusé par
la base.

### RG-08 — verrouillage après la première tentative

Dès qu'un examen possède une tentative, ajout, modification et suppression de
questions et de choix renvoient `409` :

```json
{ "message": "Cet examen a déjà été passé (1 tentative(s)) : ses questions et ses choix ne sont plus modifiables ni supprimables, afin de ne pas fausser les notes déjà attribuées." }
```

La lecture reste possible. L'**ajout** est soumis à la même règle que la
modification : une question de plus fausserait le barème des étudiants ayant
déjà composé.

Là encore, les déclencheurs `questions_locked_after_first_attempt` et
`choices_locked_after_first_attempt` bloquent même un `UPDATE` ou un `DELETE`
SQL direct.

### RG-07 — `isCorrect` n'atteint jamais un étudiant

La règle est portée par le typage plutôt que par la vigilance :

- `Question` / `Choice` portent `isCorrect` — vue administrateur ;
- `QuestionForStudent` / `ChoiceForStudent` ne possèdent pas ce champ.

`toQuestionForStudent()` est l'**unique** passage entre les deux, ce qui donne
un seul point à auditer. Renvoyer une `Question` depuis une route étudiante ne
compilerait pas. Les routes étudiantes arrivent en phase B9.

### Codes de réponse

| Situation                                       | Code |
| ----------------------------------------------- | ---- |
| Succès (`GET`, `PUT`, `DELETE`)                 | 200  |
| Création                                        | 201  |
| Violation de RG-04, énoncé ou barème invalide, identifiant non numérique | 400 |
| Jeton absent ou invalide                        | 401  |
| Jeton d'étudiant                                | 403  |
| Examen ou question inexistant                   | 404  |
| Examen déjà passé (RG-08)                       | 409  |

## Passage d'examen (espace étudiant)

Routes réservées au rôle étudiant. **L'étudiant est toujours déduit du jeton**,
jamais du corps ni de l'URL : il n'existe aucun paramètre permettant de
composer à la place d'un autre.

### Examens disponibles

```bash
curl $API/my/exams -H "Authorization: Bearer $STUDENT_TOKEN"
```

Deux conditions, appliquées en SQL : la fenêtre est ouverte (RG-03) et aucune
tentative n'existe pour cet étudiant (RG-02). Un examen passé disparaît donc de
la liste sans traitement particulier.

### Le sujet — RG-07

```bash
curl $API/my/exams/1 -H "Authorization: Bearer $STUDENT_TOKEN"
```

```json
{ "exam": { … },
  "questions": [{
    "id": 1, "statement": "…", "points": 2, "position": 1,
    "choices": [{ "id": 1, "label": "let", "position": 1 }]
  }] }
```

Les choix portent exactement trois clés : `id`, `label`, `position`. Le mot
`correct` n'apparaît nulle part dans la réponse.

La garantie est structurelle : `QuestionForStudent` ne possède pas de champ
`isCorrect`, et `toQuestionForStudent()` est l'unique conversion depuis la vue
administrateur. Renvoyer une `Question` ici ne compilerait pas.

Trois situations produisent volontairement le **même** message `404` :
examen inexistant, fenêtre non ouverte, fenêtre close. Les distinguer
permettrait d'énumérer les examens des autres promotions en essayant des
identifiants. Le cas « déjà passé » est en revanche distingué (`409`),
l'étudiant ayant besoin de comprendre cette situation-là.

### Soumettre — RG-05, RG-06, RG-12

```bash
curl -X POST $API/my/exams/1/submit -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"answers":[{"questionId":1,"choiceId":2}]}'
```

Le corps ne contient **que des identifiants**. Aucun champ ne permet de
transmettre une note, un barème ou une indication de justesse : RG-06 n'est pas
seulement appliquée, elle est inexprimable autrement. Un client qui ajoute
`"score": 100` voit ce champ purement ignoré.

Les questions omises valent 0 point et ne produisent aucune ligne dans
`answers`, tandis que `max_score` couvre l'intégralité du barème (RG-05).
Rendre copie blanche est accepté.

La réponse `201` contient la note et la correction complète (RG-12) :
`score`, `maxScore`, `unansweredCount`, puis pour chaque question le choix
retenu, le choix correct et les points obtenus.

### La transaction

Tout se joue dans une seule transaction : contrôle de la fenêtre, validation
des couples question/choix, notation, création de la tentative, enregistrement
des réponses. Un échec à n'importe quelle étape annule l'ensemble — il ne peut
rester ni tentative sans réponses, ni note calculée sur des données partielles.

La notation est une somme calculée par PostgreSQL à partir de
`choices.is_correct` et `questions.points`. Les couples incohérents sont
détectés par une jointure : un choix qui n'appartient pas à sa question, ou une
question qui n'appartient pas à l'examen, ne ressort pas du résultat et fait
échouer la soumission.

Les décisions temporelles s'appuient sur le `now()` de PostgreSQL, jamais sur
l'horloge du processus Node : une seule source de temps fait autorité.

### RG-02 — une seule tentative

Vérifiée par le Service pour produire un bon message, **et** garantie par la
contrainte `UNIQUE (exam_id, student_id)`. Sur trois soumissions simultanées,
une seule aboutit et les deux autres reçoivent `409` — c'est la base qui
arbitre, pas une vérification applicative qu'une course pourrait doubler.

### Codes de réponse

| Situation                                          | Code |
| -------------------------------------------------- | ---- |
| Liste, sujet                                       | 200  |
| Soumission enregistrée                             | 201  |
| Copie mal formée, choix ou question incohérents    | 400  |
| Jeton absent ou invalide                           | 401  |
| Jeton d'administrateur, ou soumission hors fenêtre | 403  |
| Examen inexistant ou fenêtre non ouverte           | 404  |
| Examen déjà passé                                  | 409  |

## Résultats

Deux vues aux périmètres strictement disjoints : l'administrateur voit les
résultats de **tous les étudiants sur un examen**, l'étudiant voit **ses
résultats sur tous les examens**. Aucune vue ne permet à un étudiant
d'apercevoir la note d'un camarade.

### Vue administrateur

```bash
curl $API/exams/1/results -H "Authorization: Bearer $TOKEN"
```

```json
{
  "examId": 1, "examTitle": "Contrôle continu n°1", "courseCode": "PROG2",
  "stats": { "attemptCount": 2, "studentCount": 3, "average": 7,
             "averagePercentage": 70, "lowest": 4, "highest": 10, "maxScore": 10 },
  "results": [
    { "studentId": 2, "fullName": "Amina Diallo", "isActive": true,
      "hasAttempted": true, "score": 10, "maxScore": 10, "percentage": 100,
      "submittedAt": "…" },
    { "studentId": 4, "fullName": "Chloé Marchand", "isActive": true,
      "hasAttempted": false, "score": null, "percentage": null, "submittedAt": null }
  ]
}
```

Deux partis pris à connaître :

- **Les absents figurent dans la liste** avec `score: null`, car un tableau de
  résultats sert aussi à repérer qui n'a pas composé.
- **Ils n'entrent pas dans la moyenne.** Une absence n'est pas un zéro : la
  compter comme telle ferait chuter la moyenne de 7 à 4,7 et donnerait une
  image fausse du niveau réel. Sans copie rendue, `average` vaut `null`, jamais
  `0`.

Conformément à RG-10, un étudiant désactivé **ayant composé** reste listé avec
sa note et un `isActive: false`. Un étudiant désactivé n'ayant pas composé
disparaît de la liste : il ne peut plus passer l'examen, l'y afficher n'aurait
pas de sens.

### Vue étudiante

```bash
curl $API/my/results -H "Authorization: Bearer $STUDENT_TOKEN"
```

L'étudiant est déduit du jeton ; la route n'accepte aucun identifiant
d'étudiant. Le filtrage `WHERE a.student_id = $1` est dans la requête SQL
elle-même, si bien qu'un oubli côté service ne pourrait pas transformer un
historique personnel en palmarès de promotion.

Un étudiant sans résultat reçoit `[]` avec un `200` : n'avoir rien passé est un
état normal en début d'année, pas une erreur.

### Recharger une page de correction

```bash
curl "$API/my/results?examId=1" -H "Authorization: Bearer $STUDENT_TOKEN"
```

Le paramètre facultatif `examId` restreint la réponse à un examen et y ajoute
la correction détaillée. C'est ce qui permet à la page
`/student/exams/:id/result` de survivre à un rafraîchissement : `POST …/submit`
ne peut pas être rejoué (RG-02), et l'historique complet resterait léger sans
ce détail.

Le type de retour reste un tableau avec ou sans le paramètre : le client n'a
pas à traiter deux formes de réponse.

La correction part toujours de la tentative de l'étudiant. Demander le détail
d'un examen qu'il n'a pas passé renvoie `[]` — aucune bonne réponse ne peut
fuiter par ce chemin, y compris pour un examen encore ouvert.

### Codes de réponse

| Situation                                     | Code |
| --------------------------------------------- | ---- |
| Succès, y compris historique vide             | 200  |
| Identifiant non numérique                     | 400  |
| Jeton absent ou invalide                      | 401  |
| Étudiant sur la vue admin, admin sur la vue étudiante | 403 |
| Examen inexistant (vue admin)                 | 404  |

## Comptes de test

Après `npm run db:seed` puis `npm run db:seed:demo`, avec les valeurs par
défaut de `.env.example` :

| Rôle     | Email                 | Mot de passe            | État      |
| -------- | --------------------- | ----------------------- | --------- |
| Admin    | `admin@examhub.local` | `SEED_ADMIN_PASSWORD`   | actif     |
| Étudiant | `amina@examhub.local` | `SEED_STUDENT_PASSWORD` | actif     |
| Étudiant | `bruno@examhub.local` | `SEED_STUDENT_PASSWORD` | actif     |
| Étudiant | `chloe@examhub.local` | `SEED_STUDENT_PASSWORD` | actif     |
| Étudiant | `david@examhub.local` | `SEED_STUDENT_PASSWORD` | désactivé |

Le compte désactivé permet d'éprouver RG-11, et le jeu de démonstration
contient un examen à fenêtre close pour éprouver RG-03.

## Où chaque règle de gestion est appliquée

| Règle | Serveur | Base de données |
| ----- | ------- | --------------- |
| RG-01 | Aucune route d'inscription ; `StudentService.create` réservé à l'admin | — |
| RG-02 | `AttemptRepositorie.submit` — `SELECT` préalable | `UNIQUE (exam_id, student_id)` |
| RG-03 | `findAvailableFor`, `getPaper`, `submit` — via `now()` PostgreSQL | — |
| RG-04 | `QuestionController` (cardinalité) + `QuestionService` (unicité du correct) | Index unique partiel + trigger différé |
| RG-05 | Absence de ligne dans `answers` ; `max_score` sur tout le barème | — |
| RG-06 | Notation par `SUM` SQL dans la transaction | — |
| RG-07 | `toQuestionForStudent`, type `QuestionForStudent` sans `isCorrect` | — |
| RG-08 | `QuestionService.assertExamNotStarted` | Triggers `*_locked_after_first_attempt` |
| RG-09 | `CourseService.remove`, `ExamService.remove` | `ON DELETE RESTRICT` |
| RG-10 | `StudentRepositorie.deactivate` ; aucun `DELETE FROM users` | `ON DELETE RESTRICT` sur `attempts.student_id` |
| RG-11 | `AuthService.login` — 403 distinct du 401 | Colonne `is_active` |
| RG-12 | Réponse de `POST …/submit` ; `GET /my/results?examId=` | — |
| RG-13 | `Middleware/errorHandler.ts` + `postgresErrors.ts` | — |
