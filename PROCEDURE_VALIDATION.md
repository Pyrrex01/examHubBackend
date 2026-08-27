# Exam Hub — Procédure de validation manuelle du Backend

Document de recette à dérouler **dans l'ordre exact**. L'ordre n'est pas
indifférent : la règle RG-08 gèle définitivement le sujet d'un examen dès la
première tentative, et RG-09 en interdit alors la suppression. Toutes les
vérifications d'édition doivent donc précéder la soumission étudiante.

Durée indicative : 45 à 60 minutes.

**Convention** : chaque test porte un identifiant `T-xx`. Notez le résultat
obtenu en face de chaque attendu. Un seul écart doit interrompre la recette.

---

## 0. Prérequis

| Élément | Version attendue | Commande de vérification |
| --- | --- | --- |
| Node.js | ≥ 20 | `node -v` |
| npm | ≥ 10 | `npm -v` |
| Docker | récent | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| curl | quelconque | `curl --version` |
| jq | recommandé | `jq --version` |

`jq` n'est pas obligatoire : chaque extraction de jeton est accompagnée d'une
variante sans `jq`.

Placez-vous à la racine du backend :

```bash
cd examHub/examHubBackend
```

---

## 1. Commandes Docker — PostgreSQL

### T-01 · Préparer la configuration

```bash
npm install
cp .env.example .env
```

Éditez `.env` et renseignez au minimum :

```
DB_PASSWORD=exam_hub_local_2026
SEED_ADMIN_PASSWORD=Admin123!
JWT_SECRET=<chaîne aléatoire de 32 caractères au moins>
```

Génération du secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Attendu** : `npm install` se termine sans erreur ; le fichier `.env` existe.

### T-02 · Partir d'une base vierge

```bash
docker compose down -v
```

**Attendu** : suppression du volume, ou message indiquant qu'il n'existe pas.
Cette étape garantit que la recette part d'un état connu.

### T-03 · Démarrer le conteneur PostgreSQL

```bash
docker compose up -d
```

**Attendu** : `Container examhub-postgres  Started`.

### T-04 · Vérifier la santé du conteneur

```bash
docker compose ps
```

**Attendu** : colonne `STATUS` affichant `Up ... (healthy)`.
Si l'état reste `starting`, patientez 10 secondes et relancez la commande.

### T-05 · Vérifier l'isolation réseau

```bash
docker compose ps --format '{{.Ports}}'
```

**Attendu** : `127.0.0.1:5432->5432/tcp`.
La base ne doit **pas** être exposée sur `0.0.0.0`.

### T-06 · Journaux du conteneur

```bash
docker compose logs postgres | tail -5
```

**Attendu** : `database system is ready to accept connections`.

---

## 2. Schéma et données de test

### T-07 · Appliquer les migrations

```bash
npm run db:migrate
```

**Attendu** :
```
[migrate] ✔ 001_init.sql — appliquée.
[migrate] 1 migration(s) appliquée(s).
```

### T-08 · Idempotence des migrations

```bash
npm run db:migrate
```

**Attendu** :
```
[migrate] ⇢ 001_init.sql — déjà appliquée, ignorée.
[migrate] Schéma déjà à jour.
```

### T-09 · Créer l'administrateur initial (RG-01)

```bash
npm run db:seed
```

**Attendu** : `[seed] Administrateur créé : admin@examhub.local`

### T-10 · Idempotence du seed

```bash
npm run db:seed
```

**Attendu** : `[seed] Administrateur « admin@examhub.local » déjà présent — inchangé.`

### T-11 · Charger le jeu de démonstration

```bash
npm run db:seed:demo
```

**Attendu** :
```
[seed] Jeu de démonstration créé : 1 cours, 2 examens, 3 questions.
[seed] Mot de passe des étudiants de démonstration : Etudiant123!
```

### T-12 · Vérifier le schéma en base

```bash
docker compose exec postgres psql -U examhub -d examhub -c "\dt"
```

**Attendu** : 8 tables — `answers`, `attempts`, `choices`, `courses`, `exams`,
`questions`, `schema_migrations`, `users`.

### T-13 · Vérifier les contraintes critiques

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT conname FROM pg_constraint
  WHERE conname IN ('attempts_one_per_student_and_exam','exams_course_fk',
                    'attempts_exam_fk','attempts_student_is_student_fk',
                    'users_email_unique','exams_window_ordered',
                    'users_password_is_hashed') ORDER BY conname;"
```

**Attendu** : les 7 contraintes présentes.

### T-14 · Vérifier les déclencheurs et l'index RG-04

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname;"

docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT indexname FROM pg_indexes WHERE indexname='choices_one_correct_per_question_idx';"
```

**Attendu** : 8 déclencheurs dont `questions_locked_after_first_attempt`,
`choices_locked_after_first_attempt`, `choices_validate_question` ;
et l'index unique partiel présent.

### T-15 · Vérifier qu'aucun mot de passe n'est en clair

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT email, left(password_hash, 7) AS debut_hash FROM users ORDER BY id;"
```

**Attendu** : 5 comptes, tous avec un hachage commençant par `$2b$10`.

---

## 3. Démarrage du Backend

### T-16 · Compilation

```bash
npm run typecheck
npm run build
```

**Attendu** : aucune erreur ; le dossier `dist/` est créé.

### T-17 · Démarrage

Dans un **premier terminal**, laissé ouvert pour toute la recette :

```bash
npm start
```

**Attendu** :
```
[exam-hub] API démarrée sur http://localhost:3000/api (env: development)
[exam-hub] PostgreSQL joignable (examhub@localhost:5432/examhub)
```

### T-18 · Contrôle de santé

Dans un **second terminal**, qui servira à tous les tests suivants :

| | |
| --- | --- |
| Méthode | `GET` |
| URL | `http://localhost:3000/api/health` |
| Headers | aucun |
| Body | aucun |
| **Attendu** | **`200`** |

```bash
curl -i http://localhost:3000/api/health
```

Corps attendu : `{"status":"ok","service":"exam-hub-backend","database":{"reachable":true,...}}`

### T-19 · Dégradation si la base tombe

```bash
docker compose stop postgres
curl -i http://localhost:3000/api/health
docker compose start postgres
sleep 5
curl -i http://localhost:3000/api/health
```

**Attendu** : `503` avec `"database":{"reachable":false,...}` pendant l'arrêt,
puis `200` après redémarrage. **Le serveur Node ne doit pas s'être arrêté** :
vérifiez le premier terminal.

---

## 4. Variables de session

Préparez l'environnement du second terminal :

```bash
API=http://localhost:3000/api
JSON='Content-Type: application/json'
```

Références du jeu de démonstration, valables sur une base fraîche :

| Objet | Identifiant |
| --- | --- |
| Administrateur | `1` — `admin@examhub.local` |
| Étudiants actifs | `2` Amina · `3` Bruno · `4` Chloé |
| Étudiant désactivé | `5` David |
| Cours | `1` — `PROG2` |
| Examen **ouvert** | `1` — Contrôle continu n°1, barème **6** |
| Examen **fermé** | `2` — Contrôle blanc |
| Questions de l'examen 1 | `1` (2 pts) · `2` (1 pt) · `3` (3 pts) |
| Bonnes réponses | question 1 → choix `2` · question 2 → choix `6` · question 3 → choix `10` |

---

## 5. Authentification

### T-20 · Connexion administrateur

| | |
| --- | --- |
| Méthode | `POST` |
| URL | `http://localhost:3000/api/auth/login` |
| Headers | `Content-Type: application/json` |
| Body | `{"email":"admin@examhub.local","password":"Admin123!"}` |
| **Attendu** | **`200`** |

```bash
curl -i -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"admin@examhub.local","password":"Admin123!"}'
```

**Vérifications** : la réponse contient `token` et `user` ; `user.role` vaut
`ADMIN` ; **aucun champ `password`, `passwordHash` ou `password_hash`** ;
aucune chaîne commençant par `$2b$`.

Capture du jeton :

```bash
T=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"admin@examhub.local","password":"Admin123!"}' | jq -r .token)
echo "${T:0:25}..."
```

Sans `jq` :

```bash
T=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"admin@examhub.local","password":"Admin123!"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')
```

### T-21 · Connexion étudiante

```bash
A=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"amina@examhub.local","password":"Etudiant123!"}' | jq -r .token)
B=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"bruno@examhub.local","password":"Etudiant123!"}' | jq -r .token)
C=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"chloe@examhub.local","password":"Etudiant123!"}' | jq -r .token)
```

**Attendu** : trois jetons non vides, `user.role` valant `STUDENT`.

### T-22 · Mauvais mot de passe

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/auth/login` · Header `Content-Type: application/json` |
| Body | `{"email":"admin@examhub.local","password":"MauvaisMotDePasse"}` |
| **Attendu** | **`401`** — `{"message":"Email ou mot de passe incorrect."}` |

### T-23 · Email inconnu — même message (anti-énumération)

| | |
| --- | --- |
| Body | `{"email":"nexistepas@examhub.local","password":"MauvaisMotDePasse"}` |
| **Attendu** | **`401`** — message **strictement identique** à T-22 |

C'est un point de sécurité : un message différent transformerait la page de
connexion en annuaire de comptes.

### T-24 · Compte désactivé — RG-11

| | |
| --- | --- |
| Body | `{"email":"david@examhub.local","password":"Etudiant123!"}` |
| **Attendu** | **`403`** — message **distinct** de T-22, mentionnant explicitement la désactivation, et **aucun jeton** dans la réponse |

### T-25 · Validation de l'entrée

| Body | Attendu |
| --- | --- |
| `{}` | `400`, message listant `email` et `password` |
| `{"email":"pas-un-email","password":"x"}` | `400` |
| `{"email":"' OR 1=1 --@x.fr","password":"x"}` | `400` ou `401`, **jamais `500`** |

---

## 6. Contrôle d'accès — jetons et rôles

### T-26 · Jeton absent

| | |
| --- | --- |
| Méthode | `GET` · URL `$API/students` · Headers : **aucun** |
| **Attendu** | **`401`** |

### T-27 · Jeton invalide

```bash
curl -i $API/students -H "Authorization: Bearer ceci-nest-pas-un-jwt"
```

**Attendu** : `401`.

### T-28 · Préfixe `Bearer` manquant

```bash
curl -i $API/students -H "Authorization: $T"
```

**Attendu** : `401`.

### T-29 · Jeton forgé avec un autre secret

```bash
FAUX=$(node -e "console.log(require('jsonwebtoken').sign({sub:1,role:'ADMIN'},'secret-attaquant',{algorithm:'HS256',issuer:'exam-hub',expiresIn:'1h'}))")
curl -i $API/students -H "Authorization: Bearer $FAUX"
```

**Attendu** : `401`.

### T-30 · Étudiant sur une route administrateur

| Requête | Attendu |
| --- | --- |
| `GET $API/students` avec `Authorization: Bearer $A` | `403` |
| `GET $API/courses` avec `Bearer $A` | `403` |
| `GET $API/exams` avec `Bearer $A` | `403` |
| `GET $API/exams/1/questions` avec `Bearer $A` | `403` |
| `GET $API/exams/1/results` avec `Bearer $A` | `403` |

```bash
for r in students courses exams exams/1/questions exams/1/results; do
  printf "%-22s " "$r"
  curl -s -o /dev/null -w "%{http_code}\n" $API/$r -H "Authorization: Bearer $A"
done
```

**Attendu** : cinq fois `403`.

### T-31 · Administrateur sur une route étudiante

```bash
for r in my/exams my/exams/1 my/results; do
  printf "%-14s " "$r"
  curl -s -o /dev/null -w "%{http_code}\n" $API/$r -H "Authorization: Bearer $T"
done
```

**Attendu** : trois fois `403`.

---

## 7. Gestion des étudiants

### T-32 · Lister

| | |
| --- | --- |
| Méthode | `GET` · URL `$API/students` · Header `Authorization: Bearer $T` |
| **Attendu** | **`200`**, 4 étudiants, aucun `ADMIN`, aucun hachage |

### T-33 · Filtres

| URL | Attendu |
| --- | --- |
| `$API/students?active=true` | `200`, uniquement `isActive: true` |
| `$API/students?active=false` | `200`, uniquement David |
| `$API/students?active=peutetre` | `400` |

### T-34 · Créer

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/students` |
| Headers | `Authorization: Bearer $T` · `Content-Type: application/json` |
| Body | `{"fullName":"Fatou Sow","email":"fatou@examhub.local","password":"MotDePasse1!"}` |
| **Attendu** | **`201`**, `role: "STUDENT"`, `isActive: true`, aucun mot de passe dans la réponse |

Notez l'identifiant renvoyé : `NEW=6` (probable sur base fraîche).

```bash
NEW=$(curl -s -X POST $API/students -H "Authorization: Bearer $T" -H "$JSON" \
  -d '{"fullName":"Fatou Sow","email":"fatou@examhub.local","password":"MotDePasse1!"}' | jq -r .id)
echo "NEW=$NEW"
```

### T-35 · Le rôle n'est pas paramétrable

| Body | Attendu |
| --- | --- |
| `{"fullName":"Faux Admin","email":"faux@examhub.local","password":"MotDePasse1!","role":"ADMIN","isActive":false}` | `201` avec `role: "STUDENT"` et `isActive: true` — les champs parasites sont **ignorés** |

### T-36 · Le nouveau compte peut se connecter

| Body sur `POST $API/auth/login` | Attendu |
| --- | --- |
| `{"email":"fatou@examhub.local","password":"MotDePasse1!"}` | `200` |

### T-37 · Doublon d'email

| Body sur `POST $API/students` | Attendu |
| --- | --- |
| `{"fullName":"Doublon","email":"fatou@examhub.local","password":"MotDePasse1!"}` | `409` |
| `{"fullName":"Casse","email":"FATOU@ExamHub.Local","password":"MotDePasse1!"}` | `409` — insensible à la casse |
| `{"fullName":"Vol","email":"admin@examhub.local","password":"MotDePasse1!"}` | `409` |

### T-38 · Validation

| Body | Attendu |
| --- | --- |
| `{}` | `400` |
| `{"fullName":"T","email":"t@x.fr","password":"court"}` | `400` — mot de passe trop court |

### T-39 · Modifier

| | |
| --- | --- |
| Méthode | `PUT` · URL `$API/students/$NEW` |
| Headers | `Authorization: Bearer $T` · `Content-Type: application/json` |
| Body | `{"fullName":"Fatou Sow-Diop"}` |
| **Attendu** | **`200`**, nom modifié, email inchangé |

### T-40 · Cas d'erreur sur la modification

| Requête | Attendu |
| --- | --- |
| `PUT $API/students/$NEW` body `{}` | `400` — aucun champ à modifier |
| `PUT $API/students/$NEW` body `{"email":"bruno@examhub.local"}` | `409` |
| `PUT $API/students/999999` body `{"fullName":"Fantôme"}` | `404` |
| `PUT $API/students/1` body `{"fullName":"Admin renommé"}` | **`404`** — un administrateur n'est pas joignable par cette route |
| `PUT $API/students/abc` body `{"fullName":"Test"}` | `400` |

### T-41 · Réinitialiser le mot de passe

| | |
| --- | --- |
| Méthode | `PUT` · URL `$API/students/$NEW` |
| Body | `{"password":"NouveauMotDePasse2!"}` |
| **Attendu** | **`200`**, aucun mot de passe dans la réponse |

Vérifications enchaînées :

| Requête | Attendu |
| --- | --- |
| Connexion avec `MotDePasse1!` | `401` — ancien mot de passe rejeté |
| Connexion avec `NouveauMotDePasse2!` | `200` |

Contrôle en base — le hachage doit avoir changé et rester au format bcrypt :

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT email, left(password_hash,7) FROM users WHERE id=$NEW;"
```

---

## 8. Gestion des cours

### T-42 · Lister

| | |
| --- | --- |
| `GET $API/courses` · `Authorization: Bearer $T` | **`200`**, `PROG2` avec `examCount: 2` |

### T-43 · Créer

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/courses` |
| Body | `{"code":"ALGO1","name":"Algorithmique","description":"Complexité et structures."}` |
| **Attendu** | **`201`**, `examCount: 0` |

```bash
COURSE=$(curl -s -X POST $API/courses -H "Authorization: Bearer $T" -H "$JSON" \
  -d '{"code":"ALGO1","name":"Algorithmique","description":"Complexité et structures."}' | jq -r .id)
```

### T-44 · Code unique

| Body | Attendu |
| --- | --- |
| `{"code":"ALGO1","name":"Autre"}` | `409` |
| `{"code":"algo1","name":"Casse"}` | `409` — insensible à la casse |

### T-45 · Validation du code

| Body | Attendu |
| --- | --- |
| `{"code":"A","name":"Trop court"}` | `400` |
| `{"code":"ALGO 1","name":"Espace"}` | `400` |
| `{"code":"ALGO@1","name":"Caractère interdit"}` | `400` |
| `{"code":"VALIDE"}` | `400` — nom manquant |

### T-46 · Modifier

| | |
| --- | --- |
| `PUT $API/courses/$COURSE` body `{"name":"Algorithmique avancée"}` | **`200`**, `updatedAt` modifié |
| `PUT $API/courses/$COURSE` body `{}` | `400` |
| `PUT $API/courses/999999` body `{"name":"Cours fantôme"}` | `404` |

### T-47 · Supprimer un cours vide

| | |
| --- | --- |
| `DELETE $API/courses/$COURSE` · `Authorization: Bearer $T` | **`200`** |
| Rejouer la même requête | `404` |

### T-48 · Suppression d'un cours avec examens — RG-09

| | |
| --- | --- |
| `DELETE $API/courses/1` · `Authorization: Bearer $T` | **`409`**, message indiquant **2 examens** |

---

## 9. Gestion des examens

### T-49 · Lister et consulter

| Requête | Attendu |
| --- | --- |
| `GET $API/exams` | `200`, examen 1 en `status: "OPEN"`, examen 2 en `"CLOSED"` |
| `GET $API/exams/1` | `200`, `questionCount: 3`, `totalPoints: 6`, `attemptCount: 0` |
| `GET $API/exams?courseId=1` | `200` |
| `GET $API/exams?courseId=999999` | `404` |
| `GET $API/exams/999999` | `404` |
| `GET $API/exams/abc` | `400` |

### T-50 · Créer

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/exams` |
| Headers | `Authorization: Bearer $T` · `Content-Type: application/json` |
| Body | `{"courseId":1,"title":"Examen de recette","description":"Créé pendant la recette.","availableFrom":"2026-09-01T08:00:00Z","availableTo":"2026-09-01T10:00:00Z"}` |
| **Attendu** | **`201`**, `status: "UPCOMING"`, `questionCount: 0` |

```bash
EXAM=$(curl -s -X POST $API/exams -H "Authorization: Bearer $T" -H "$JSON" \
  -d '{"courseId":1,"title":"Examen de recette","availableFrom":"2026-09-01T08:00:00Z","availableTo":"2026-09-01T10:00:00Z"}' | jq -r .id)
echo "EXAM=$EXAM"
```

### T-51 · Fenêtre incohérente

| Body | Attendu |
| --- | --- |
| `{"courseId":1,"title":"Inversée","availableFrom":"2026-09-01T10:00:00Z","availableTo":"2026-09-01T08:00:00Z"}` | `400` |
| `{"courseId":1,"title":"Nulle","availableFrom":"2026-09-01T08:00:00Z","availableTo":"2026-09-01T08:00:00Z"}` | `400` — fin = début |

### T-52 · Cohérence sur modification partielle

| Requête sur `PUT $API/exams/$EXAM` | Attendu |
| --- | --- |
| `{"availableTo":"2020-01-01T00:00:00Z"}` | **`400`** — la fin précéderait le début **existant** |
| `{"availableFrom":"2030-01-01T00:00:00Z"}` | `400` |
| `{"title":"Examen de recette — v2"}` | `200` |

### T-53 · Autres erreurs

| Requête | Attendu |
| --- | --- |
| `POST $API/exams` body `{}` | `400` |
| `POST $API/exams` body `{"courseId":999999,"title":"Fantôme","availableFrom":"2026-09-01T08:00:00Z","availableTo":"2026-09-01T10:00:00Z"}` | `404` — cours inexistant |
| `POST $API/exams` body `{"courseId":1,"title":"Date","availableFrom":"32 février","availableTo":"2026-09-01T10:00:00Z"}` | `400` |
| `PUT $API/exams/$EXAM` body `{}` | `400` |

---

## 10. Questions et RG-04

Ces tests portent sur `$EXAM`, qui n'a **aucune tentative** : le sujet est donc
modifiable.

### T-54 · Ajouter une question valide

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/exams/$EXAM/questions` |
| Headers | `Authorization: Bearer $T` · `Content-Type: application/json` |
| Body | `{"statement":"Quel port utilise HTTPS par défaut ?","points":2,"choices":[{"label":"80"},{"label":"443","isCorrect":true},{"label":"8080"}]}` |
| **Attendu** | **`201`**, `position: 1`, choix en positions 1 à 3, un seul `isCorrect: true` |

### T-55 · Bornes de RG-04 acceptées

| Body | Attendu |
| --- | --- |
| `{"statement":"Deux choix seulement","choices":[{"label":"Vrai","isCorrect":true},{"label":"Faux"}]}` | `201` — minimum |
| `{"statement":"Six choix","choices":[{"label":"1","isCorrect":true},{"label":"2"},{"label":"3"},{"label":"4"},{"label":"5"},{"label":"6"}]}` | `201` — maximum |

### T-56 · Violations de RG-04 — toutes attendues en `400`

| Body | Attendu |
| --- | --- |
| `{"statement":"Un seul choix","choices":[{"label":"Seul","isCorrect":true}]}` | `400` |
| `{"statement":"Sans choix","choices":[]}` | `400` |
| `{"statement":"Sans tableau"}` | `400` |
| `{"statement":"Sept choix","choices":[{"label":"1","isCorrect":true},{"label":"2"},{"label":"3"},{"label":"4"},{"label":"5"},{"label":"6"},{"label":"7"}]}` | `400` |
| `{"statement":"Aucune bonne réponse","choices":[{"label":"A"},{"label":"B"}]}` | `400` |
| `{"statement":"Deux bonnes réponses","choices":[{"label":"A","isCorrect":true},{"label":"B","isCorrect":true}]}` | `400` |
| `{"statement":"Doublon","choices":[{"label":"Paris","isCorrect":true},{"label":"paris"}]}` | `400` |
| `{"statement":"Intitulé vide","choices":[{"label":"   ","isCorrect":true},{"label":"B"}]}` | `400` |
| `{"statement":"Points nuls","points":0,"choices":[{"label":"A","isCorrect":true},{"label":"B"}]}` | `400` |

Contrôle : le nombre de questions de `$EXAM` doit être resté à **3**.

```bash
curl -s $API/exams/$EXAM/questions -H "Authorization: Bearer $T" | jq '.questions | length'
```

### T-57 · RG-04 garantie par la base — contournement du serveur

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"BEGIN;
 INSERT INTO questions (exam_id, statement, points, position)
 VALUES ($EXAM,'Insérée en SQL direct',1,50) RETURNING id \gset
 INSERT INTO choices (question_id,label,is_correct,position) VALUES (:id,'Seul',TRUE,1);
 COMMIT;"
```

**Attendu** : `ERROR: La question ... doit comporter entre 2 et 6 choix (actuellement 1).`

Variante plus simple, deux bonnes réponses :

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"INSERT INTO choices (question_id,label,is_correct,position)
 SELECT id,'Deuxième bonne',TRUE,6 FROM questions WHERE exam_id=$EXAM LIMIT 1;"
```

**Attendu** : `ERROR: duplicate key value violates unique constraint "choices_one_correct_per_question_idx"`.

### T-58 · Modifier une question

| | |
| --- | --- |
| Méthode | `PUT` · URL `$API/questions/<id de la question créée en T-54>` |
| Body | `{"statement":"Quel port utilise HTTP par défaut ?","points":4,"choices":[{"label":"80","isCorrect":true},{"label":"443"}]}` |
| **Attendu** | **`200`**, remplacement **complet** : 3 choix → 2 choix, nouveau barème |

### T-59 · Supprimer une question et renumérotation

| Requête | Attendu |
| --- | --- |
| `GET $API/exams/$EXAM/questions` | noter les positions : `1, 2, 3` |
| `DELETE $API/questions/<question en position 2>` | `200` |
| `GET $API/exams/$EXAM/questions` | positions redevenues `1, 2` — **sans trou** |
| Rejouer le `DELETE` | `404` |

### T-60 · Vue administrateur : `isCorrect` présent

```bash
curl -s $API/exams/1/questions -H "Authorization: Bearer $T" | jq '.questions[0].choices'
```

**Attendu** : chaque choix porte `isCorrect`. C'est normal et nécessaire :
l'administrateur doit voir la bonne réponse pour vérifier son sujet.

---

## 11. Espace étudiant — RG-07 et RG-03

### T-61 · Liste des examens disponibles

| | |
| --- | --- |
| Méthode | `GET` · URL `$API/my/exams` · Header `Authorization: Bearer $A` |
| **Attendu** | **`200`**, contient l'examen `1` ; **ne contient ni** l'examen `2` (fenêtre close) **ni** `$EXAM` (fenêtre future) |

### T-62 · Le sujet ne révèle jamais la bonne réponse — RG-07

```bash
curl -s $API/my/exams/1 -H "Authorization: Bearer $A"
```

**Attendu** : `200`. Puis, contrôle décisif :

```bash
curl -s $API/my/exams/1 -H "Authorization: Bearer $A" | grep -c "isCorrect"
curl -s $API/my/exams/1 -H "Authorization: Bearer $A" | grep -ci "correct"
```

**Attendu** : **`0` dans les deux cas**. Chaque choix ne porte que
`id`, `label`, `position`.

### T-63 · Examen hors fenêtre à l'affichage — RG-03

| Requête | Attendu |
| --- | --- |
| `GET $API/my/exams/2` avec `Bearer $A` | `404` — fenêtre close |
| `GET $API/my/exams/$EXAM` avec `Bearer $A` | `404` — fenêtre future |
| `GET $API/my/exams/999999` avec `Bearer $A` | `404` — **message identique** aux deux précédents |

Le message unique est volontaire : le distinguer permettrait d'énumérer les
examens des autres promotions en essayant des identifiants.

### T-64 · Soumission hors fenêtre — RG-03

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/my/exams/2/submit` |
| Headers | `Authorization: Bearer $A` · `Content-Type: application/json` |
| Body | `{"answers":[]}` |
| **Attendu** | **`403`** |

Contrôle : aucune tentative ne doit exister sur l'examen 2.

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT count(*) FROM attempts WHERE exam_id=2;"
```

**Attendu** : `0`.

---

## 12. Soumission, notation — RG-05, RG-06

**Point de non-retour** : à partir d'ici, l'examen 1 sera verrouillé par RG-08.
Assurez-vous d'avoir terminé les sections 10 et 11.

### T-65 · Soumission complète, toutes réponses justes

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/my/exams/1/submit` |
| Headers | `Authorization: Bearer $A` · `Content-Type: application/json` |
| Body | `{"answers":[{"questionId":1,"choiceId":2},{"questionId":2,"choiceId":6},{"questionId":3,"choiceId":10}]}` |
| **Attendu** | **`201`**, `score: 6`, `maxScore: 6`, `unansweredCount: 0` |

La réponse contient la correction complète (RG-12) : chaque choix porte
`isCorrect` et `selected`, chaque question porte `pointsEarned`.

### T-66 · Soumission partielle — RG-05

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/my/exams/1/submit` |
| Headers | `Authorization: Bearer $B` · `Content-Type: application/json` |
| Body | `{"answers":[{"questionId":3,"choiceId":10}]}` |
| **Attendu** | **`201`**, `score: 3`, `maxScore: 6`, `unansweredCount: 2` |

Les deux questions omises valent 0 point, et `maxScore` couvre bien
**l'intégralité** du barème. Vérifiez qu'une seule ligne a été écrite :

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT count(*) FROM answers WHERE attempt_id=(SELECT id FROM attempts WHERE exam_id=1 AND student_id=3);"
```

**Attendu** : `1`.

### T-67 · Copie blanche

| | |
| --- | --- |
| `POST $API/my/exams/1/submit` · `Bearer $C` · Body `{"answers":[]}` | **`201`**, `score: 0`, `maxScore: 6` |

### T-68 · La note n'est jamais calculée par le client — RG-06

Créez d'abord un examen ouvert dédié :

```bash
FROM=$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)
TO=$(date -u -d '+3 hours' +%Y-%m-%dT%H:%M:%SZ)
CHEAT=$(curl -s -X POST $API/exams -H "Authorization: Bearer $T" -H "$JSON" \
  -d "{\"courseId\":1,\"title\":\"Examen falsification\",\"availableFrom\":\"$FROM\",\"availableTo\":\"$TO\"}" | jq -r .id)
curl -s -X POST $API/exams/$CHEAT/questions -H "Authorization: Bearer $T" -H "$JSON" \
  -d '{"statement":"Question de contrôle","points":9,"choices":[{"label":"Juste","isCorrect":true},{"label":"Faux"}]}' > /dev/null
curl -s $API/exams/$CHEAT/questions -H "Authorization: Bearer $T" | jq '.questions[0] | {id, choices}'
```

Relevez l'identifiant de la question (`QID`) et celui du choix **faux**
(`WRONG`). Puis :

| | |
| --- | --- |
| Méthode | `POST` · URL `$API/my/exams/$CHEAT/submit` |
| Headers | `Authorization: Bearer $A` · `Content-Type: application/json` |
| Body | `{"answers":[{"questionId":QID,"choiceId":WRONG,"isCorrect":true,"pointsEarned":999}],"score":100,"maxScore":100}` |
| **Attendu** | **`201`** avec **`score: 0`, `maxScore: 9`** |

Les champs `score`, `maxScore`, `isCorrect` et `pointsEarned` envoyés par le
client sont purement ignorés. Contrôle en base :

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT score, max_score FROM attempts WHERE exam_id=$CHEAT;"
```

**Attendu** : `0 | 9`.

### T-69 · Réponses incohérentes

| Body sur `POST $API/my/exams/1/submit` (avec un jeton n'ayant pas encore composé) | Attendu |
| --- | --- |
| `{"answers":[{"questionId":1,"choiceId":6}]}` | `400` — le choix 6 appartient à la question 2 |
| `{"answers":[{"questionId":1,"choiceId":999999}]}` | `400` |
| `{"answers":[{"questionId":999999,"choiceId":2}]}` | `400` |
| `{"answers":[{"questionId":1,"choiceId":1},{"questionId":1,"choiceId":2}]}` | `400` — deux réponses pour une même question |
| `{"answers":"tout juste"}` | `400` |
| `{}` | `400` |

Utilisez un compte n'ayant pas composé, par exemple le jeton de Fatou.
**Contrôle essentiel** : après ces requêtes, aucune tentative supplémentaire ne
doit exister — la transaction est annulée intégralement.

---

## 13. Une seule tentative — RG-02

### T-70 · Double soumission

| | |
| --- | --- |
| `POST $API/my/exams/1/submit` · `Bearer $A` · Body `{"answers":[]}` | **`409`** |

### T-71 · L'examen passé disparaît

| Requête | Attendu |
| --- | --- |
| `GET $API/my/exams` avec `Bearer $A` | l'examen `1` **n'y figure plus** |
| `GET $API/my/exams/1` avec `Bearer $A` | `409` |

### T-72 · Soumissions simultanées

```bash
FROM=$(date -u -d '-1 hour' +%Y-%m-%dT%H:%M:%SZ)
TO=$(date -u -d '+3 hours' +%Y-%m-%dT%H:%M:%SZ)
RACE=$(curl -s -X POST $API/exams -H "Authorization: Bearer $T" -H "$JSON" \
  -d "{\"courseId\":1,\"title\":\"Examen concurrence\",\"availableFrom\":\"$FROM\",\"availableTo\":\"$TO\"}" | jq -r .id)
curl -s -X POST $API/exams/$RACE/questions -H "Authorization: Bearer $T" -H "$JSON" \
  -d '{"statement":"Question de concurrence","points":5,"choices":[{"label":"A","isCorrect":true},{"label":"B"}]}' > /dev/null

for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/my/exams/$RACE/submit \
    -H "Authorization: Bearer $B" -H "$JSON" -d '{"answers":[]}' &
done
wait
```

**Attendu** : exactement un `201` et quatre `409`.

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT count(*) FROM attempts WHERE exam_id=$RACE;"
```

**Attendu** : `1`.

### T-73 · RG-02 garantie par la base

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"INSERT INTO attempts (exam_id, student_id, score, max_score) VALUES (1, 2, 6, 6);"
```

**Attendu** : `ERROR: duplicate key value violates unique constraint "attempts_one_per_student_and_exam"`.

---

## 14. Verrouillage du sujet — RG-08

L'examen 1 possède désormais des tentatives.

### T-74 · Indicateur de verrouillage

```bash
curl -s $API/exams/1/questions -H "Authorization: Bearer $T" | jq '{locked, attemptCount}'
```

**Attendu** : `{"locked": true, "attemptCount": 3}`.

### T-75 · Écritures refusées

| Requête | Attendu |
| --- | --- |
| `POST $API/exams/1/questions` body `{"statement":"Ajoutée après coup","choices":[{"label":"A","isCorrect":true},{"label":"B"}]}` | **`409`** |
| `PUT $API/questions/1` body `{"statement":"Modifiée après coup","choices":[{"label":"A","isCorrect":true},{"label":"B"}]}` | **`409`** |
| `DELETE $API/questions/1` | **`409`** |
| `GET $API/exams/1/questions` | `200` — la **lecture** reste possible |

### T-76 · RG-08 garantie par la base

```bash
docker compose exec postgres psql -U examhub -d examhub -c "UPDATE questions SET points=99 WHERE id=1;"
docker compose exec postgres psql -U examhub -d examhub -c "DELETE FROM questions WHERE id=1;"
docker compose exec postgres psql -U examhub -d examhub -c "UPDATE choices SET label='Falsifié' WHERE question_id=1;"
docker compose exec postgres psql -U examhub -d examhub -c \
"INSERT INTO choices (question_id,label,is_correct,position) VALUES (1,'Ajouté',FALSE,6);"
```

**Attendu** : les quatre commandes échouent avec
`ERROR: L'examen 1 a déjà des tentatives : ses questions et ses choix ne sont plus modifiables.`

### T-77 · Les métadonnées restent modifiables

| | |
| --- | --- |
| `PUT $API/exams/1` body `{"title":"Contrôle continu n°1 — corrigé"}` | **`200`** |

RG-08 gèle le contenu du sujet, pas son intitulé ni sa fenêtre.

---

## 15. Suppressions protégées — RG-09

### T-78 · Examen avec tentatives

| | |
| --- | --- |
| `DELETE $API/exams/1` · `Bearer $T` | **`409`**, message indiquant **3 tentatives** |

### T-79 · Garantie en base

```bash
docker compose exec postgres psql -U examhub -d examhub -c "DELETE FROM exams WHERE id=1;"
docker compose exec postgres psql -U examhub -d examhub -c "DELETE FROM courses WHERE id=1;"
```

**Attendu** : deux `ERROR ... violates foreign key constraint`
(`attempts_exam_fk` puis `exams_course_fk`).

### T-80 · Examen sans tentative

| | |
| --- | --- |
| `DELETE $API/exams/$EXAM` · `Bearer $T` | **`200`**, message mentionnant les questions supprimées en cascade |

```bash
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT count(*) FROM questions WHERE exam_id=$EXAM;"
```

**Attendu** : `0` — cascade effective.

---

## 16. Résultats

### T-81 · Vue administrateur

| | |
| --- | --- |
| Méthode | `GET` · URL `$API/exams/1/results` · Header `Authorization: Bearer $T` |
| **Attendu** | **`200`** |

Vérifications :

| Élément | Attendu |
| --- | --- |
| `stats.attemptCount` | `3` |
| `stats.maxScore` | `6` |
| `stats.average` | `3` — moyenne de 6, 3 et 0 |
| `stats.lowest` / `stats.highest` | `0` / `6` |
| Ligne d'Amina | `score: 6`, `percentage: 100` |
| Ligne de Fatou | `hasAttempted: false`, `score: null` |

**Point clé** : les absents figurent dans la liste mais **n'entrent pas** dans
la moyenne. `score: null`, jamais `0`.

### T-82 · Examen sans copie

| | |
| --- | --- |
| `GET $API/exams/2/results` · `Bearer $T` | `200` avec `attemptCount: 0` et `average: null` — **jamais `0`** |

### T-83 · Erreurs

| Requête | Attendu |
| --- | --- |
| `GET $API/exams/999999/results` avec `Bearer $T` | `404` |
| `GET $API/exams/abc/results` avec `Bearer $T` | `400` |
| `GET $API/exams/1/results` avec `Bearer $A` | `403` |

### T-84 · Historique personnel

| | |
| --- | --- |
| `GET $API/my/results` · `Bearer $A` | **`200`**, un résultat `6/6` |
| `GET $API/my/results` · `Bearer $B` | `200`, un résultat `3/6` |

**Cloisonnement** : l'historique d'Amina ne doit contenir **aucun** email ni
nom d'un autre étudiant.

```bash
curl -s $API/my/results -H "Authorization: Bearer $A" | grep -c "bruno"
```

**Attendu** : `0`.

### T-85 · Étudiant sans résultat

```bash
F=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"fatou@examhub.local","password":"NouveauMotDePasse2!"}' | jq -r .token)
curl -i $API/my/results -H "Authorization: Bearer $F"
```

**Attendu** : **`200`** avec `[]`. **Pas de `404`** : n'avoir rien passé est un
état normal.

### T-86 · Recharger une correction

| | |
| --- | --- |
| `GET $API/my/results?examId=1` · `Bearer $B` | **`200`**, un élément **avec** le champ `questions` contenant la correction complète |
| `GET $API/my/results?examId=1` · `Bearer $F` | `200` avec `[]` — Fatou n'a pas composé |
| `GET $API/my/results?examId=abc` · `Bearer $B` | `400` |

**Contrôle de fuite** : Fatou ne doit récupérer aucune bonne réponse.

```bash
curl -s "$API/my/results?examId=1" -H "Authorization: Bearer $F" | grep -c "isCorrect"
```

**Attendu** : `0`.

---

## 17. Désactivation — RG-10 et RG-11

### T-87 · Compter les lignes avant

```bash
docker compose exec postgres psql -U examhub -d examhub -c "SELECT count(*) FROM users;"
```

Notez la valeur, appelée `N`.

### T-88 · Désactiver un étudiant ayant composé

| | |
| --- | --- |
| Méthode | `DELETE` · URL `$API/students/2` · Header `Authorization: Bearer $T` |
| **Attendu** | **`200`**, `student.isActive: false`, message mentionnant que les résultats restent consultables |

### T-89 · Aucune suppression physique — RG-10

```bash
docker compose exec postgres psql -U examhub -d examhub -c "SELECT count(*) FROM users;"
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT id, email, is_active FROM users WHERE id=2;"
docker compose exec postgres psql -U examhub -d examhub -c \
"SELECT count(*) FROM attempts WHERE student_id=2;"
```

**Attendu** : compte toujours à `N` ; la ligne existe avec `is_active = f` ;
ses tentatives sont intactes.

### T-90 · Résultats toujours consultables

```bash
curl -s $API/exams/1/results -H "Authorization: Bearer $T" \
  | jq '.results[] | select(.studentId==2) | {fullName, isActive, score}'
```

**Attendu** : Amina listée avec `isActive: false` et `score: 6`.

### T-91 · La base refuse la suppression physique

```bash
docker compose exec postgres psql -U examhub -d examhub -c "DELETE FROM users WHERE id=2;"
```

**Attendu** : `ERROR ... violates foreign key constraint "attempts_student_is_student_fk"`.

### T-92 · Connexion refusée — RG-11

| | |
| --- | --- |
| `POST $API/auth/login` body `{"email":"amina@examhub.local","password":"Etudiant123!"}` | **`403`**, message explicite de désactivation, **aucun jeton** |

### T-93 · Le jeton antérieur cesse de fonctionner

```bash
curl -i $API/my/results -H "Authorization: Bearer $A"
```

**Attendu** : `403`. Un jeton reste valide cryptographiquement, mais le compte
est relu en base à chaque requête.

### T-94 · Réactivation

| | |
| --- | --- |
| `PUT $API/students/2` body `{"isActive":true}` | `200` |
| Reconnexion d'Amina | `200` |

---

## 18. Format des erreurs — RG-13

### T-95 · Tous les codes au format `{ "message": "..." }`

| Requête | Code attendu |
| --- | --- |
| `POST $API/courses` · `Bearer $T` · body `{}` | `400` |
| `GET $API/courses` sans header | `401` |
| `GET $API/courses` · `Bearer $B` | `403` |
| `GET $API/courses/999999` · `Bearer $T` | `404` |
| `DELETE $API/courses/1` · `Bearer $T` | `409` |

Contrôle automatisé du format :

```bash
for c in "400:-X POST $API/courses -H \"Authorization: Bearer $T\" -H \"$JSON\" -d {}"; do :; done

check() { echo -n "$1 → "; curl -s "$@" 2>/dev/null | jq -r 'keys | join(",")'; }
curl -s -X POST $API/courses -H "Authorization: Bearer $T" -H "$JSON" -d '{}' | jq 'keys'
curl -s $API/courses | jq 'keys'
curl -s $API/courses -H "Authorization: Bearer $B" | jq 'keys'
curl -s $API/courses/999999 -H "Authorization: Bearer $T" | jq 'keys'
curl -s -X DELETE $API/courses/1 -H "Authorization: Bearer $T" | jq 'keys'
```

**Attendu** : cinq fois `["message"]`, et **rien d'autre**.

### T-96 · Route inconnue

| | |
| --- | --- |
| `GET $API/route/inexistante` | `404` au format `{ "message": ... }` |

### T-97 · JSON malformé

```bash
curl -i -X POST $API/auth/login -H "$JSON" -d '{casse'
```

**Attendu** : `400` — `{"message":"Le corps de la requête n'est pas un JSON valide."}`

### T-98 · Aucune fuite technique

Parcourez les réponses d'erreur obtenues : aucune ne doit contenir de requête
SQL, de nom de table, de pile d'appel ni de nom de contrainte.

---

## 19. Contrôles transverses

### T-99 · Aucun secret dans les journaux

Dans le premier terminal, examinez la sortie complète du serveur :

**Attendu** : aucun mot de passe en clair (`Admin123!`, `Etudiant123!`,
`MotDePasse1!`), aucune chaîne `$2b$`. Seules les lignes
`[http] MÉTHODE /chemin → code (durée)` doivent apparaître.

### T-100 · Aucun ORM, `pg` uniquement

```bash
grep -riE "prisma|sequelize|typeorm|knex|drizzle|mikro-orm" package.json src/ ; echo "code retour : $?"
node -e "const d=require('./package.json'); console.log(Object.keys(d.dependencies).join(', '))"
```

**Attendu** : aucune correspondance ; dépendances limitées à
`bcrypt, cors, dotenv, express, jsonwebtoken, pg`.

### T-101 · Aucun `.env` versionné

```bash
grep -x "\.env" .gitignore && echo "OK"
```

**Attendu** : `.env` listé dans `.gitignore`, et `.env.example` présent.

### T-102 · Arrêt propre

Dans le premier terminal, `Ctrl+C`.

**Attendu** :
```
[exam-hub] Signal SIGINT reçu, arrêt en cours…
[exam-hub] Serveur arrêté, pool PostgreSQL fermé.
```

### T-103 · Persistance des données

```bash
docker compose down
docker compose up -d
sleep 10
npm start
```

Dans le second terminal :

```bash
curl -s $API/health
```

Reconnectez-vous et vérifiez que les résultats existent toujours :

```bash
T=$(curl -s -X POST $API/auth/login -H "$JSON" \
  -d '{"email":"admin@examhub.local","password":"Admin123!"}' | jq -r .token)
curl -s $API/exams/1/results -H "Authorization: Bearer $T" | jq '.stats'
```

**Attendu** : les données ont survécu à l'arrêt du conteneur — le volume nommé
`examhub_pgdata` a fait son office.

---

## 20. Remise à zéro

Pour repartir d'un état propre après la recette :

```bash
docker compose down -v
docker compose up -d
sleep 10
npm run db:migrate && npm run db:seed && npm run db:seed:demo
```

---

## Feuille de synthèse

| Section | Tests | Règles couvertes |
| --- | --- | --- |
| 1–2 · Docker et base | T-01 → T-15 | Conteneur dédié, schéma, contraintes, RG-01 |
| 3 · Démarrage | T-16 → T-19 | Résilience à la perte de base |
| 5 · Authentification | T-20 → T-25 | RG-11, anti-énumération, bcrypt |
| 6 · Accès | T-26 → T-31 | JWT, rôles |
| 7 · Étudiants | T-32 → T-41 | RG-01, unicité email |
| 8 · Cours | T-42 → T-48 | RG-09 |
| 9 · Examens | T-49 → T-53 | Fenêtre, intégrité |
| 10 · Questions | T-54 → T-60 | **RG-04** |
| 11 · Espace étudiant | T-61 → T-64 | **RG-03**, **RG-07** |
| 12 · Soumission | T-65 → T-69 | **RG-05**, **RG-06**, RG-12 |
| 13 · Tentative unique | T-70 → T-73 | **RG-02** |
| 14 · Verrouillage | T-74 → T-77 | **RG-08** |
| 15 · Suppressions | T-78 → T-80 | **RG-09** |
| 16 · Résultats | T-81 → T-86 | RG-12 |
| 17 · Désactivation | T-87 → T-94 | **RG-10**, **RG-11** |
| 18 · Erreurs | T-95 → T-98 | **RG-13** |
| 19 · Transverse | T-99 → T-103 | Secrets, ORM, persistance |

**Critère de validation** : les 103 tests doivent passer. Un seul écart
interrompt la recette et doit être signalé avec son numéro, la commande exacte,
le code obtenu et le corps de la réponse.
