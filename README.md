# WATTS 1.5.0

Application web autonome pour comprendre et suivre les consommations domestiques d’électricité, de gaz et d’eau. Les données sont conservées localement dans le navigateur.

## Démarrer

```bash
npm install
npm run dev
```

## Construire

```bash
npm run build
npm run preview
```

## Organisation de l’application

- **Vue d’ensemble** : indicateurs synthétiques et accès rapides.
- **Mes contrats** : fournisseurs, offres, tarifs, abonnements, puissance et paramètres Tempo. Aucun import ni historique de factures dans cette rubrique.
- **Analyser ma consommation** : point d’entrée unique pour importer, vérifier, enregistrer et consulter les factures d’électricité et de gaz ; bibliothèque des PDF ; bilans annuels et comparaisons. Les index ne sont pas saisis séparément : ils sont lus sur les factures.
- **Eau** : historique semestriel Veolia, import des nouvelles factures et suivi des volumes.
- **Calculer, Mes appareils, Comparer, Économiser, Comprendre** : outils d’estimation et d’apprentissage.

## Factures et extraction PDF

L’extraction est réalisée dans le navigateur avec PDF.js. Elle tente de préremplir les informations disponibles dans le texte du PDF. Les résultats doivent toujours être vérifiés et corrigés avant validation. Les PDF scannés (images) ne sont pas reconnus par OCR. Les factures d’électricité/gaz et leurs PDF sont centralisés dans « Analyser ma consommation » ; les factures d’eau restent dans la rubrique « Eau ».

Les anciennes données `meterReadings` sont conservées lors du chargement et de la sauvegarde pour compatibilité, mais aucun écran de saisie ou d’affichage des index n’est proposé. Les anciennes sauvegardes restent compatibles.

## Confidentialité et sauvegardes

Les paramètres et historiques sont stockés dans localStorage ; les PDF sont conservés dans IndexedDB sur cet appareil. Exportez régulièrement la sauvegarde JSON depuis le menu de l’application. Les PDF eux-mêmes ne sont pas intégrés à cette sauvegarde JSON : ils restent dans la bibliothèque locale du navigateur.

## Publication GitHub Pages

Remplacez les fichiers de l’application par ceux de cette archive, **mais conservez le dossier `.github/workflows` de votre dépôt** afin de ne pas supprimer le workflow de publication existant. Puis laissez GitHub Actions construire et publier le site.

## Limites

Les montants et consommations extraits dépendent de la présentation des factures. Les calculs de coût sont des estimations et ne remplacent pas le montant total facturé, qui peut inclure abonnement, taxes, assainissement, régularisations ou reports. Vérifiez les tarifs et coefficients sur vos documents.
