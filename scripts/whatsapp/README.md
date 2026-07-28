# Scripts WhatsApp — Le Toit des Anges

## Prérequis

- Node.js 18+ (pour `fetch` natif)
- Token système Meta avec permissions `whatsapp_business_messaging` + `whatsapp_business_management`

## Configuration

```bash
export WA_TOKEN="votre_token_systeme_meta"
```

Le token ne doit **jamais** être commité. Il est dans le `.env` du VPS sous ce même nom.

## Usage

### Créer les templates

```bash
node scripts/whatsapp/create-templates.mjs
```

Comportement idempotent : ne crée que les templates manquants, ignore ceux qui existent déjà.

### Vérifier le statut

```bash
node scripts/whatsapp/create-templates.mjs --status
```

Affiche un tableau avec le statut de chaque template (PENDING, APPROVED, REJECTED).

## Templates créés

| Nom | Type | Variables |
|-----|------|-----------|
| `relance_redevance` | Texte seul | parent, enfant, période, montant |
| `notification_ecole` | Texte seul | parent, enfant, message |
| `facture_mensuelle` | PDF en-tête | parent, enfant, période, montant |
| `recu_paiement` | PDF en-tête | parent, montant, enfant, référence |

## Délai d'approbation

- Templates **Utility** : généralement 1 à 24 heures
- Rarement plus de 48h

## En cas de rejet

1. Consulter le motif dans **WhatsApp Manager** → Modèles de message
2. Un template rejeté ne peut PAS être modifié — il faut le **supprimer** puis le recréer
3. Causes fréquentes :
   - Variable en début/fin de texte
   - Deux variables consécutives
   - Contenu considéré comme marketing (utiliser UTILITY, pas MARKETING)
   - Exemple manquant ou incorrect

## PDF d'exemple

Le fichier `exemple-facture.pdf` est utilisé lors de la création des templates avec en-tête DOCUMENT. Si absent, un PDF minimal est généré automatiquement par le script. Pour un meilleur rendu lors de la review Meta, remplacez-le par un vrai PDF de facture exemple.
