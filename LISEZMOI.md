# Le Carnet de Fred — mode d'emploi

## Mise à jour 1.6.0 — « Ciel d'observatoire » (thème clair et frais)

**Nouveauté 1.6.0 :** un seul habillage pour tous les écrans, clair et frais : blanc bleuté,
bleu ciel, filets de laiton, titres en Lora (police à empattements incluse, fonctionne hors connexion).
L'illustration de Léonard et Galilée devient un cyanotype bleu et blanc, en en-tête et en fond d'accueil.
La barre de navigation redevient une barre flottante en bas de l'écran (plus de rail latéral),
ce qui libère toute la largeur du téléphone. Le bouton rouge d'enregistrement ne change pas.

Les fonctions, les notes, les tâches et les sauvegardes sont strictement inchangées.
Fichiers nouveaux : `fraicheur.css`, `ciel.jpg`, `ciel-bas.jpg`, `lora.woff`, `lora-italic.woff`.
Fichiers retirés : `atelier.css`, `atelier-leonard.jpg` (tu peux les supprimer dans GitHub).
Mise à jour : mêmes étapes que ci-dessous (déposer **le contenu du dossier** dans le dépôt `Doc-Fred`).
Sauvegarde d'abord : **Dossiers → Sauvegarde → Enregistrer**.

---

## Mise à jour 1.5.1 — Cabinet Léonard & Galilée (GitHub Pages)

**Nouveauté 1.5.1 :** nouvelle icône de l'application, bleu nuit et laiton :
vitrail d'observatoire, lune, baguettes de batterie et carnet ouvert.
Le dessin principal du carnet, ses commandes et les données personnelles ne changent pas.

**Icône du POCO :** une fois les nouveaux fichiers déposés dans GitHub, la
nouvelle icône est disponible pour l'installation. Sur une application déjà
installée, Android/Chrome peut conserver l'ancienne icône un certain temps.
N'efface pas les données du navigateur et ne désinstalle pas l'ancienne
application sans avoir exporté une sauvegarde de tes notes dans **Dossiers**.

Cette version reprend exactement la même application et les mêmes données locales.
Elle change la présentation de l'accueil : image Léonard/Galilée, rail de navigation
en cuir bleu nuit sur téléphone, trois dossiers et calendrier. Les anciens boutons
« Cours du jour » et « Tâche rapide » ont disparu de l'accueil, mais les fonctions
de note, dictée, tâches, agenda et dossiers sont toujours présentes.

Pour mettre à jour **l'installation existante** sur
`https://fredhermelin-web.github.io/Doc-Fred/` :

1. Sur le téléphone, si tu as commencé à écrire, effectue d'abord une sauvegarde
   dans **Dossiers → Sauvegarde → Enregistrer**.
2. Sur le PC, décompresse ce ZIP et ouvre le dossier **Carnet de Fred**.
3. Sur GitHub, ouvre le dépôt **Doc-Fred** (branche `main`) → **Add file → Upload files**.
4. Dépose **le contenu du dossier** (`index.html`, `app.js`, `atelier.css`,
   `atelier-leonard.jpg`, `icons/`, etc.), pas le ZIP ni le dossier parent.
5. Valide **Commit changes** et attends quelques instants. Sur le POCO, rouvre
   le carnet et accepte « Actualiser » si le bandeau de mise à jour apparaît.

**Important :** les notes et tâches existantes restent sur chaque appareil.
Une éventuelle tâche d'essai déjà présente peut être supprimée manuellement
dans l'onglet **Tâches** ; aucune donnée existante n'est effacée automatiquement.

---

Le carnet est une application web installable. On la met en ligne une fois sur un hébergeur gratuit, puis on l'installe sur le téléphone et sur le PC. Aucun compte dans l'appli, aucune publicité. Les notes restent dans chaque appareil.

## 1. Mettre le carnet en ligne (une seule fois, environ 5 minutes)

Le téléphone exige une adresse en `https://` pour installer l'appli et utiliser le micro. Netlify fournit cette adresse gratuitement.

1. Va sur **https://app.netlify.com/drop**.
2. Crée un compte gratuit (avec ton adresse mail ou ton compte Google). Sans compte, le site est effacé au bout d'une heure.
3. Fais glisser **le dossier `Carnet de Fred` entier** sur la zone « Drag and drop your site output folder here ».
4. Netlify affiche une adresse du type `https://nom-au-hasard-123.netlify.app`. C'est l'adresse de ton carnet.
5. Facultatif : dans *Site configuration → Change site name*, choisis un nom plus simple (par exemple `carnet-fred-batterie`).

> Autre solution, aussi gratuite : GitHub Pages (créer un dépôt, y déposer les fichiers, puis *Settings → Pages → Deploy from branch*). Netlify reste le plus simple.

Personne ne peut lire tes notes en allant sur cette adresse : le site ne contient que l'application vide. Tes notes sont enregistrées dans ton téléphone et ton PC.

## 2. Installer sur le téléphone Android (POCO F7)

1. Ouvre l'adresse dans **Chrome**.
2. Touche **Installer** dans le bandeau de l'écran d'accueil du carnet, s'il apparaît, ou menu **⋮ → Installer l'application** (parfois « Ajouter à l'écran d'accueil »).
3. L'icône bleu-vert du carnet apparaît sur l'écran d'accueil. L'appli s'ouvre en plein écran, sans barre d'adresse.
4. Au premier appui sur le bouton rouge, autorise le micro.

Astuces Android :
- **Appui long sur l'icône** : raccourcis « Dicter », « Cours », « Tâche », « Chercher ».
- Dans WhatsApp ou Gmail, **Partager → Carnet** crée une note avec le texte partagé.
- Sur les POCO (MIUI / HyperOS), si l'icône n'apparaît pas : Réglages → Applications → Chrome → Autorisations → autoriser « Raccourcis sur l'écran d'accueil ».

## 3. Installer sur le PC Windows 11

1. Ouvre l'adresse dans **Edge** ou **Chrome**.
2. Clique sur l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche), ou menu **⋯ → Applications → Installer**.
3. Le carnet s'ouvre dans sa propre fenêtre et apparaît dans le menu Démarrer. Tu peux l'épingler à la barre des tâches.

Raccourcis clavier : `Alt + D` dicter une note, `Alt + N` écrire une note, `Alt + T` nouvelle tâche, `Ctrl + K` chercher, `Échap` revenir.

## 4. La dictée

- Bouton rouge = nouvelle note + dictée. Dans une note, le bouton rouge reprend la dictée à l'endroit du curseur.
- Commandes : « virgule », « point », « point d'interrogation », « deux points », « à la ligne », « nouveau paragraphe », « tiret », « ligne suivante » (passe au champ suivant d'un modèle).
- La dictée de Chrome et d'Edge passe par le service de reconnaissance vocale de Google ou de Microsoft : **il faut une connexion internet**. Tout le reste fonctionne hors connexion.
- Solution de secours, qui marche toujours : le micro du clavier Gboard sur le téléphone, ou `Windows + H` sur le PC.

## 5. Synchroniser le téléphone et le PC avec Google Drive

Le carnet range une copie de tes notes dans un **espace caché de ton Google Drive**, que seul le carnet peut lire (il n'apparaît pas dans tes fichiers et ne touche à rien d'autre). Le téléphone et le PC s'échangent leurs nouveautés à travers lui.

### A. Créer ton « ID client » Google (une seule fois, environ 10 minutes, sur le PC)

Google exige que chaque appli qui accède à Drive soit déclarée. C'est gratuit.

1. Va sur **https://console.cloud.google.com** et connecte-toi avec ton compte Google. Accepte les conditions si on te les demande.
2. En haut à gauche, clique sur le sélecteur de projet → **Nouveau projet** → nom : `Carnet` → **Créer**. Vérifie que le projet « Carnet » est bien sélectionné en haut.
3. Menu ☰ → **API et services → Bibliothèque** → cherche **Google Drive API** → **Activer**.
4. Menu ☰ → **API et services → Écran de consentement OAuth** (ou « Google Auth Platform ») → **Commencer** :
   - Nom de l'application : `Le Carnet de Fred`, e-mail d'assistance : ton adresse Gmail ;
   - Audience : **Externe** ;
   - Coordonnées : ton adresse Gmail → accepte → **Créer**.
5. Dans **Audience** : clique sur **Publier l'application** (passage « En production »). Sinon Google te redemandera ton accord chaque semaine. Comme le carnet n'accède qu'à son propre espace caché, Google ne demande pas de validation pour cela.
   *(Autre solution : laisser « En test » et t'ajouter dans « Utilisateurs test ».)*
6. Dans **Accès aux données** → **Ajouter ou supprimer des champs d'application** → coche `.../auth/drive.appdata` (« voir, créer et supprimer ses propres données de configuration dans Google Drive ») → **Mettre à jour** → **Enregistrer**.
7. Dans **Clients** → **Créer un client** :
   - Type : **Application Web** ; nom : `Carnet` ;
   - **Origines JavaScript autorisées** → **Ajouter un URI** → l'adresse de ton carnet, exactement, sans barre à la fin, par exemple `https://carnet-fred-batterie.netlify.app` ;
   - **Créer**. Copie l'**ID client** (il se termine par `.apps.googleusercontent.com`).

### B. Donner l'ID au carnet (au choix)

- **Le plus pratique** : ouvre `config.js` avec le Bloc-notes, colle l'ID entre les guillemets (`googleClientId: 'ton-id.apps.googleusercontent.com'`), enregistre, change la `VERSION` (section 7) et remets le dossier en ligne. Les deux appareils le reçoivent.
- **Sans remettre en ligne** : dans le carnet, **Dossiers → Synchronisation → Configurer**, colle l'ID. À faire sur chaque appareil (envoie-toi l'ID par mail pour le copier sur le téléphone).

### C. Connecter

Sur chaque appareil : **Dossiers → Synchronisation → Connecter mon compte Google**, choisis ton compte, accepte. C'est fait.

### Au quotidien

- Les modifications partent toutes seules vers Drive quelques secondes après la saisie, et le carnet récupère les nouveautés à chaque ouverture.
- Un **petit nuage** apparaît en haut de l'écran Notes et Agenda : point vert = à jour ; point rouge = touche-le pour te reconnecter. Google ne laisse l'accès ouvert qu'une heure à la fois : après une pause, il suffit d'un appui sur le nuage (une fenêtre Google s'ouvre et se ferme toute seule).
- Si la même note a été modifiée sur les deux appareils entre deux synchros, c'est la version modifiée **en dernier** qui est gardée.
- La dictée et la synchro ont besoin d'internet. Sans réseau, tu écris normalement : tout part à la prochaine synchro.

### Sauvegarde de secours (sans Google)

**Dossiers → Sauvegarde → Enregistrer / Envoyer** crée un fichier de toutes tes notes. **Importer** le fusionne avec le carnet : il ajoute ce qui manque et garde la version la plus récente, sans rien effacer. L'appli affiche en rouge la date de la dernière copie quand elle a plus de 14 jours.

## 6. L'agenda

L'onglet **Agenda** montre le mois en cours. Chaque note y apparaît comme une petite tête de note, de la couleur de son dossier, le jour où tu l'as créée. Un petit carré rouge signale une échéance de tâche.

- Touche un jour pour voir ses notes ; touche-le à nouveau pour voir tout le mois.
- Touche une ou plusieurs **lettres** (M, V…) pour voir **tous les mercredis et vendredis** du mois d'un coup.
- Change de mois avec les flèches, ou en glissant le doigt sur le calendrier. Touche le nom du mois pour revenir à aujourd'hui.
- Les pastilles de dossier en haut filtrent l'agenda, comme dans l'écran Notes.

## 7. Publier une nouvelle version

Pour cette édition « Côte d'Irlande » (version 1.4.1), les numéros sont déjà mis à jour. Il suffit de décompresser l'archive, puis de déposer le **dossier `Carnet de Fred` entier** dans **Deploys** de ton site Netlify existant. Ne crée pas un second site : l'adresse du carnet restera la même. Les notes enregistrées sur chaque appareil sont conservées.

1. Dans `app.js` **et** dans `sw.js`, change le numéro `VERSION` (par exemple `1.1.0` → `1.1.1`), le même dans les deux fichiers.
2. Sur Netlify : ouvre ton site → **Deploys** → fais glisser à nouveau le dossier entier.
3. À la prochaine ouverture, le carnet affiche « Nouvelle version disponible — Actualiser ». Tes notes ne sont pas touchées.

## 8. Si quelque chose ne marche pas

| Problème | Solution |
| --- | --- |
| Le bouton micro affiche « Micro refusé » | Chrome Android : cadenas à gauche de l'adresse → Autorisations → Micro. Pour l'appli installée : Réglages Android → Applications → Chrome → Autorisations → Micro. |
| Pas de proposition « Installer » | Vérifie que l'adresse commence par `https://` et que tu es dans Chrome (pas dans le navigateur de MIUI). Sinon menu ⋮ → Ajouter à l'écran d'accueil. |
| La nouvelle version n'apparaît pas | Ferme complètement l'appli et rouvre-la deux fois. As-tu bien changé `VERSION` dans les deux fichiers ? |
| La dictée s'arrête toute seule | Normal après 20 secondes de silence. Touche à nouveau le bouton rouge. |
| Google affiche « Erreur 400 : origin_mismatch » | L'adresse dans « Origines JavaScript autorisées » doit être exactement celle du carnet (avec `https://`, sans `/` à la fin). |
| Google affiche « Accès bloqué » ou « application non validée » | Publie l'application (section 5-A, étape 5), ou ajoute ton adresse dans « Utilisateurs test ». Si un écran « Google n'a pas validé cette application » apparaît : *Paramètres avancés → Accéder à Le Carnet de Fred*. |
| Le nuage reste rouge | Touche-le : la fenêtre Google doit s'ouvrir. Si rien ne s'ouvre, vérifie la connexion internet. |

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page de l'application |
| `app.css` | L'apparence (thème clair et sombre) |
| `app.js` | Le fonctionnement : notes, dossiers, tâches, agenda, dictée, recherche, sauvegarde, synchro |
| `config.js` | L'ID client Google pour la synchronisation (facultatif) |
| `sw.js` | Garde l'appli dans le téléphone pour qu'elle s'ouvre sans réseau |
| `manifest.webmanifest` | Nom, icône, couleurs et raccourcis de l'appli installée |
| `icons/` | Les icônes |
