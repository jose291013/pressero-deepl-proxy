# pressero-deepl-proxy

Petit service Node/Express jouant le rôle de **proxy DeepL** pour un site Pressero (FR ⇄ NL).
- Proxy côté serveur → pas d’expo de la clé API dans le front
- CORS ouvert (`Access-Control-Allow-Origin: *`) pour appels depuis Pressero
- Endpoint: `POST /deepl-proxy` (body `x-www-form-urlencoded`: `text`, `target_lang`)

## Démarrer en local
```bash
npm install
DEEPL_API_KEY="xxx:fx" npm start
# ou sous PowerShell :
# $env:DEEPL_API_KEY="xxx:fx"; npm start
