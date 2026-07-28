# Templates WhatsApp à soumettre dans Meta WhatsApp Manager

> Chemin : WhatsApp Manager → Modèles de message → Créer un modèle
> Catégorie : **Utility** (validation rapide, moins cher que Marketing)
> Langue : **Français (fr)**

---

## 1. `facture_mensuelle`

**Catégorie** : Utility  
**En-tête** : Type **Document** (permet d'envoyer le PDF en pièce jointe)  
**Corps** :

```
Bonjour {{1}}, voici la facture de {{2}} pour la période {{3}}. Montant à régler : {{4}}. Merci de votre confiance. — Le Toit des Anges
```

**Variables** :
- `{{1}}` = Prénom du parent (ex: "Seydou")
- `{{2}}` = Prénom + Nom de l'enfant (ex: "Safiatou Dianka")
- `{{3}}` = Période (ex: "Juillet 2027")
- `{{4}}` = Montant (ex: "45 000 F CFA")

**Exemple de preview** :
> Bonjour Seydou, voici la facture de Safiatou Dianka pour la période Juillet 2027. Montant à régler : 45 000 F CFA. Merci de votre confiance. — Le Toit des Anges

---

## 2. `recu_paiement`

**Catégorie** : Utility  
**En-tête** : Type **Document** (PDF du reçu en pièce jointe)  
**Corps** :

```
Merci {{1}}, nous confirmons la réception de votre paiement de {{2}} pour {{3}}. Référence : {{4}}. — Le Toit des Anges
```

**Variables** :
- `{{1}}` = Prénom du parent
- `{{2}}` = Montant payé (ex: "75 000 F CFA")
- `{{3}}` = Prénom + Nom de l'enfant
- `{{4}}` = Référence du reçu (ex: "VTE-2027-00142")

**Exemple de preview** :
> Merci Seydou, nous confirmons la réception de votre paiement de 75 000 F CFA pour Safiatou Dianka. Référence : VTE-2027-00142. — Le Toit des Anges

---

## 3. `relance_redevance`

**Catégorie** : Utility  
**En-tête** : Aucun  
**Corps** :

```
Bonjour {{1}}, la redevance de {{2}} pour {{3}} d'un montant de {{4}} reste à régler. Nous restons à votre disposition. — Le Toit des Anges
```

**Variables** :
- `{{1}}` = Prénom du parent
- `{{2}}` = Prénom + Nom de l'enfant
- `{{3}}` = Période/service (ex: "Scolarité - Octobre 2027")
- `{{4}}` = Montant dû (ex: "45 000 F CFA")

**Exemple de preview** :
> Bonjour Seydou, la redevance de Safiatou Dianka pour Scolarité - Octobre 2027 d'un montant de 45 000 F CFA reste à régler. Nous restons à votre disposition. — Le Toit des Anges

---

## 4. `notification_ecole`

**Catégorie** : Utility  
**En-tête** : Aucun  
**Corps** :

```
Bonjour {{1}}, information de Le Toit des Anges concernant {{2}} : {{3}}. Merci.
```

**Variables** :
- `{{1}}` = Prénom du parent
- `{{2}}` = Prénom + Nom de l'enfant
- `{{3}}` = Contenu du message (doit tenir sur une seule ligne, pas de saut de ligne)

**Exemple de preview** :
> Bonjour Seydou, information de Le Toit des Anges concernant Safiatou Dianka : La réunion parents-professeurs aura lieu le samedi 15 novembre à 9h. Merci.

---

## Notes importantes

1. **Ne pas mettre de variable en début ou fin de texte** — Meta refuse
2. **Pas deux variables consécutives** sans texte fixe entre elles — Meta refuse
3. **Pas de saut de ligne dans une variable** — le contenu de `{{3}}` dans `notification_ecole` doit être sur une seule ligne
4. **Délai d'approbation** : généralement 1-24h pour les templates Utility
5. **Coût** : environ 0,0085 USD par message template envoyé (marché Afrique)

## Configuration dans n8n

Une fois approuvés, renseigner les noms exacts dans le nœud "Configuration" du workflow n8n :

```
cfg.templateFacture = facture_mensuelle
cfg.templateRecu = recu_paiement
cfg.templateRelance = relance_redevance
cfg.templateGenerique = notification_ecole
cfg.templateLanguage = fr
```
