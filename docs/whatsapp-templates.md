# Templates WhatsApp Meta à créer

Ces templates doivent être créés et approuvés dans le **Meta Business Manager** 
(catégorie UTILITY) pour que les messages atteignent les parents qui n'ont jamais 
contacté le numéro Business.

## Templates requis

| Nom du template | Usage | Variables |
|---|---|---|
| `candidature_recue` | Confirmation dépôt dossier d'admission | {{1}} parentName, {{2}} enfantNom, {{3}} référence, {{4}} URL suivi |
| `candidature_acceptee` | Validation inscription | {{1}} parentName, {{2}} enfantNom, {{3}} ecoleNom |
| `candidature_rejetee` | Rejet dossier | {{1}} parentName, {{2}} enfantNom, {{3}} motif |
| `recu_paiement` | Reçu paiement mensualité | {{1}} parentName, {{2}} montant, {{3}} enfantNom, {{4}} référence |
| `recu_inscription` | Reçu frais d'inscription | {{1}} parentName, {{2}} montant, {{3}} enfantNom, {{4}} référence |
| `facture_mensuelle` | Facture mensuelle | {{1}} parentName, {{2}} enfantNom, {{3}} période, {{4}} montant |
| `relance_paiement` | Rappel échéance impayée | {{1}} parentName, {{2}} montant, {{3}} enfantNom, {{4}} période, {{5}} date |
| `compte_parent_cree` | Création compte portail parent | {{1}} parentName, {{2}} email, {{3}} URL connexion |
| `notification_bulletin` | Bulletin disponible | {{1}} message complet |
| `annonce_generale` | Annonce/événement école | {{1}} message complet |

## Configuration n8n

Le workflow n8n doit router selon `inSession` :
- `inSession: true` → envoi texte libre (API messages)
- `inSession: false` → envoi via template Meta (API templates) en utilisant le champ `template` + `variables`

## Variables .env requises sur le VPS

```
WA_TOKEN=<token_permanent_meta_business>
WA_PHONE_NUMBER_ID=<id_numero_meta>
```
