# Pressero — PDF recto/verso auto (dupliquer la page 1 si PDF 1 face)


Ce service transforme un PDF **1 page** en PDF **2 pages identiques** lorsque le client choisit une option **Recto Verso** dans Pressero. S’il reçoit un PDF de 2 pages ou plus, il renvoie le fichier tel quel.


## ✨ Fonctionnement
- **Front (Pressero)** : un snippet JS intercepte l’upload, vérifie l’option *Recto Verso*, envoie le PDF à l’API, puis remplace le fichier par la version 2 pages.
- **Backend (Render/Node)** : endpoint `/pdf/duplicate-if-single-page` qui duplique la page 1 si le PDF ne contient qu’une seule page.


## 📦 Installation locale
1. Node 18+ requis
2. `npm ci`
3. (optionnel) créer un fichier `.env` avec `CORS_ORIGIN=https://votre-domaine-pressero`
4. `npm run dev` ou `npm start`


Tester avec cURL :
```bash
curl -s -X POST \
-F "file=@tests/mono-page.pdf" \
http://localhost:3000/pdf/duplicate-if-single-page \
-o out.pdf -D -