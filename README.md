# WATTS 1.6.0

Application web autonome pour comprendre et suivre les consommations domestiques d’électricité, de gaz et d’eau. Les données sont conservées localement dans le navigateur.

## Démarrer et construire

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Organisation

- **Vue d’ensemble** : indicateurs synthétiques et accès rapides.
- **Mes contrats** : fournisseurs, offres, tarifs, abonnements, puissance et paramètres Tempo.
- **Analyser ma consommation** : factures d’électricité et de gaz, bibliothèque PDF, bilans annuels et comparaisons.
- **Eau** : historique semestriel, import PDF et suivi des volumes et prix au m³.
- **Calculer, Mes appareils, Comparer, Économiser, Comprendre** : outils d’estimation et d’apprentissage.

## Sauvegardes et documents

Les paramètres et historiques sont conservés dans `localStorage`. Les PDF sont conservés dans `IndexedDB`.

La sauvegarde JSON de WATTS 1.6 inclut désormais les données et le contenu des PDF. La restauration de ce format rétablit les deux. Les anciennes sauvegardes JSON restent acceptées, mais elles ne peuvent pas restituer les PDF qui n'y étaient pas intégrés.

Conservez régulièrement une copie de la sauvegarde sur un autre support. Les données restent sur l'appareil et dans le navigateur utilisés : elles ne sont pas synchronisées entre appareils.

## Imports PDF

L'extraction est réalisée dans le navigateur avec PDF.js. Elle tente de préremplir les informations disponibles dans le texte du PDF. Les résultats doivent toujours être vérifiés et corrigés avant validation. Les PDF scannés (images) ne sont pas reconnus par OCR.

Un tarif d'eau non détecté n'est plus remplacé par une valeur supposée : il est laissé à 0 € pour attirer l'attention et doit être vérifié dans le tableau.

## Tarifs et estimations

Les coûts des appareils sont indicatifs. Pour les offres HP/HC et Tempo, la précision dépend de la répartition réelle de l'utilisation entre les plages horaires et les couleurs. Vérifiez les hypothèses affichées avant d'interpréter les résultats.

Les montants extraits des factures ne remplacent pas nécessairement le coût de la consommation : abonnements, taxes, assainissement, régularisations et reports peuvent s'y ajouter.

## Publication GitHub Pages

Remplacez les fichiers de l'application par ceux de cette archive, **mais conservez le dossier `.github/workflows` de votre dépôt** afin de ne pas supprimer le workflow de publication existant. Puis laissez GitHub Actions construire et publier le site.
