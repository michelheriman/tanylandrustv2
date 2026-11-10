# Frontend PythonAnywhere

Cette copie utilise le backend `https://mtk.pythonanywhere.com`. Elle conserve les routes `/api` et `/export`, le stockage de session et l’envoi des Bearer headers du frontend existant. Aucun identifiant Supabase ou secret n’est embarqué.

## Développement local

Depuis ce dossier :

```powershell
npm ci
npm run dev
```

Vite écoute sur `http://localhost:5173`. `npm run dev:local` est également configuré vers le même backend par `.env.localdev`. Les fichiers `.env.development`, `.env.localdev` et `.env.production` ne contiennent que l’origine publique de l’API.

Le backend doit autoriser les origines navigateur exactes dans `FRONTEND_ORIGINS`, notamment `http://localhost:5173` pour le développement et l’URL Vercel déployée. Flask n’autorise pas automatiquement ces origines ; cette configuration backend est un prérequis séparé.

## Vercel

Créer un projet Vercel dont le **Root Directory** est `frontend-react-online`, framework **Vite**, commande d’installation `npm ci`, commande de build `npm run build` et dossier de sortie `dist`. `vercel.json` réécrit les routes SPA vers `index.html`, notamment les accès directs aux URLs `/admin/...`.

Les builds Vercel Production (et Preview si ceux-ci doivent être testés) doivent définir `VITE_API_BASE_URL` à `https://mtk.pythonanywhere.com`. Cette variable est publique et intégrée au bundle lors du build ; elle ne doit contenir aucune clé. La valeur du `.env.production` du dépôt fournit le même défaut. Toute origine de déploiement utilisée par un navigateur doit également être ajoutée à `FRONTEND_ORIGINS` côté backend.

L’API utilise l’en-tête `Authorization: Bearer …` géré par le service d’authentification existant. Aucun cookie cross-site ni `credentials: include` n’est ajouté. Le backend est configuré sans credentials CORS ; son contrat Bearer reste inchangé.
