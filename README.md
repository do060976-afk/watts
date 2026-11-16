# WATTS 1.0

Application web autonome pour comprendre et suivre les dépenses énergétiques domestiques (électricité et gaz).

## Démarrer en local

```bash
npm install
npm run dev
```

## Construire

```bash
npm run build
npm run preview
```

## Publier sur GitHub Pages

1. Créez un dépôt GitHub (par exemple `watts`).
2. Déposez le contenu de cette archive à la racine du dépôt.
3. Dans GitHub : **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Choisissez la branche `main`, dossier `/root`, puis enregistrez.
5. Attendez la publication. L'application utilise des chemins relatifs pour fonctionner dans un sous-répertoire GitHub Pages.

## Fonctionnalités

- Tableau de bord des dépenses.
- Contrats électricité et gaz, tarifs simples ou heures pleines/heures creuses.
- Import local de PDF avec extraction de texte et préremplissage indicatif.
- Calculateur de consommation.
- Bibliothèque d'appareils modifiable.
- Comparaison de deux appareils.
- Simulateur d'économies.
- Mini-parcours pédagogique.
- Sauvegarde locale dans le navigateur et export/import JSON.

## Confidentialité et limites

Les contrats, factures et réglages restent dans le stockage local du navigateur. Le PDF est lu dans le navigateur et n'est pas téléversé. L'extraction PDF est une aide : les factures varient selon les fournisseurs, les tableaux peuvent être difficiles à interpréter et les PDF scannés nécessitent de l'OCR. Vérifiez toujours les valeurs proposées avant de les enregistrer.

Les calculs sont des estimations. Pour une estimation de coût variable, WATTS applique le prix TTC du kWh saisi. L'abonnement est affiché séparément dans les vues de contrat et de budget. Les taxes et régularisations déjà incluses dans un prix TTC ne doivent pas être ajoutées une seconde fois.

La conversion du gaz utilise le coefficient figurant sur la facture. À défaut, la valeur indicative de 11,2 kWh/m³ est proposée ; elle ne remplace pas le coefficient réel du distributeur.

## Vérifications

Le build TypeScript/Vite constitue le contrôle technique principal. Vérifiez sur votre propre contrat les prix, plages horaires, abonnements et coefficients avant toute décision financière.

## Option Tempo
Saisie des six tarifs Tempo (bleu/blanc/rouge, heures pleines/creuses). La couleur du jour est récupérée via l’API publique Calendrier Tempo, qui relaie les données publiées par RTE. En cas d’indisponibilité, elle reste sélectionnable manuellement. Vérifiez les tarifs sur votre facture.


## WATTS 1.2 — améliorations factures
- Le champ d'abonnement accepte désormais les décimales avec une virgule.
- L'import PDF tente d'extraire localement le montant TTC, la consommation, la date et la période de facturation.
- Les données détectées sont reportées dans le formulaire pour vérification et correction avant validation.
- Le PDF est archivé localement dans IndexedDB et peut être rouvert depuis la bibliothèque.
- Les factures scannées (images) ne sont pas reconnues par OCR : les champs doivent alors être complétés manuellement.
