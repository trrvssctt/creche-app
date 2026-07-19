# Le Toit des Anges — Guide : modifier les tarifs de scolarité

*Guide pas à pas destiné à la direction — à faire soi-même, sans aide technique*

---

## Où se trouvent les tarifs ?

Tous les tarifs de l'école (mensualités, frais d'inscription, cantine, bus, activités) sont regroupés dans un seul endroit :

> **Menu de gauche → « Offres de Scolarité »**

Chaque tarif est une « offre ». Vous verrez par exemple :

| Offre | Type | Exemple de tarif |
|---|---|---|
| Mensualité PS | Mensualité | 60 000 F CFA |
| Mensualité CP | Mensualité | 70 000 F CFA |
| Cantine (mensuelle) | Cantine | 30 000 F CFA |
| Bus scolaire (mensuel) | Bus | 25 000 F CFA |
| Activité Anglais | Mensualité | 10 000 F CFA |

Chaque offre indique aussi **les niveaux concernés** (ex. la Mensualité PS ne s'applique qu'à la Petite Section).

---

## Modifier un tarif en 4 étapes

1. **Ouvrez** le menu « Offres de Scolarité »
2. **Trouvez** l'offre à modifier (la barre de recherche en haut permet de taper son nom, ex. « CP »)
3. **Cliquez sur le petit crayon** ✏️ (bouton « Modifier ») sur la carte de l'offre
4. Dans la fenêtre qui s'ouvre, **changez le montant** dans le champ « Tarif mensuel », puis cliquez sur **Enregistrer**

C'est tout : le nouveau tarif est immédiatement pris en compte.

---

## Cas particulier : le crayon est grisé (« Lié à une facture »)

Si le bouton Modifier est **grisé**, c'est que cette offre a déjà servi à facturer des élèves. Par sécurité, l'application interdit de changer un tarif déjà utilisé sur des factures : cela fausserait l'historique comptable.

**La bonne méthode dans ce cas :**

1. Cliquez sur **« + Nouvelle offre »** en haut de la page
2. Créez la même offre avec le **nouveau tarif** (même nom, même type, mêmes niveaux — vous pouvez ajouter l'année dans le nom, ex. « Mensualité CP 2026-2027 »)
3. **Désactivez l'ancienne offre** (modifiez-la si possible pour la passer en « Inactive », ou laissez-la : seules les offres actives sont proposées aux nouvelles inscriptions)

Ainsi, les anciennes factures gardent l'ancien prix, et les nouveaux élèves paient le nouveau.

---

## Ce que le changement de tarif affecte (et n'affecte pas)

**✔ Affecté par le nouveau tarif :**
- Les **nouvelles inscriptions** (la facture d'inscription utilisera le nouveau montant)
- Les **nouveaux abonnements** créés après le changement (échéanciers des nouveaux élèves)

**✘ PAS affecté :**
- Les **échéances déjà générées** pour les élèves en cours d'année (leur échéancier a été calculé au moment de leur inscription)
- Les **factures et reçus déjà émis** (l'historique reste intact)

> Autrement dit : changer un tarif en cours d'année ne modifie pas ce que les familles actuelles doivent déjà — il s'applique aux prochains dossiers.

**À savoir :** la **remise cas social** se calcule automatiquement par-dessus le tarif (ex. tarif 60 000 F avec remise 50 % → la famille paie 30 000 F ; cas social total → 0 F). Vous n'avez rien à faire de spécial sur les tarifs pour les cas sociaux : la remise se règle sur la fiche de l'élève.

---

## Les frais d'inscription par niveau (Configuration Scolaire)

Les **frais d'inscription** se règlent à un second endroit :

> **Menu de gauche → « Paramètres » → onglet « Scolarité »**

Vous y trouverez le bloc **« Configuration Scolaire »** (année scolaire, trimestres, pénalités et frais d'inscription par niveau), qui contient :

- **Année scolaire** : nombre de mois de scolarité (10 par défaut)
- **Trimestres** : les mois de fin de chaque trimestre (ex. Décembre, Mars, Juin)
- **Jour limite de paiement** : le jour du mois avant lequel les mensualités doivent être réglées (le 5 par défaut)
- **Pénalités** : montant de la pénalité de retard de paiement et de retard de garde
- **Frais d'Inscription par Niveau (FCFA)** : un tableau avec un montant par niveau — Crèche, PS, MS, GS, CP, CE1, CE2, CM1, CM2

**Pour modifier les frais d'inscription :**

1. Ouvrez **Paramètres → Scolarité**
2. Descendez jusqu'au tableau **« Frais d'Inscription par Niveau (FCFA) »**
3. **Tapez le nouveau montant** dans la case du niveau concerné (chaque niveau a sa propre case, vous pouvez donc avoir des frais différents en crèche et en élémentaire)
4. Cliquez sur le bouton **« Enregistrer »** en haut à droite du bloc — il devient vert quand c'est sauvegardé

**⚠ Important — le lien avec la facturation :** ce tableau sert de référence de configuration. Pour que les frais d'inscription soient **réellement facturés** au moment d'inscrire un élève, il faut aussi qu'une offre de type **« Inscription »** existe dans **Offres de Scolarité** avec le bon montant (c'est cette offre qui apparaît sur la facture d'inscription). Quand vous changez les frais, pensez donc à mettre à jour **les deux** : le tableau de la Configuration Scolaire *et* l'offre « Inscription » correspondante.

---

## Bonne pratique : les tarifs de la nouvelle année scolaire

Au moment de préparer une nouvelle année (menu **Paramètres → Années scolaires**), utilisez la fonction **« Reconduire la configuration »** : elle copie les classes et les offres de l'année précédente vers la nouvelle. Vous n'avez plus qu'à ajuster les montants des offres copiées **avant** d'ouvrir les inscriptions — c'est le meilleur moment pour changer les prix, car aucune facture n'y est encore liée.

---

## En résumé

```
Changer une mensualité / cantine / bus → Offres de Scolarité → crayon ✏️ → nouveau montant → Enregistrer
Changer les frais d'inscription        → Paramètres → Scolarité → tableau « Frais d'Inscription par Niveau »
                                         + mettre à jour l'offre « Inscription » dans Offres de Scolarité
Pénalités et jour limite de paiement   → Paramètres → Scolarité → Configuration Scolaire
Crayon grisé                           → créer une Nouvelle offre au bon prix + désactiver l'ancienne
Nouvelle année scolaire                → reconduire la configuration puis ajuster les prix avant d'ouvrir les inscriptions
Cas sociaux                            → rien à faire ici, la remise se gère sur la fiche de l'élève
```

En cas de doute, faites le changement puis vérifiez : inscrivez un élève fictif de test et regardez le montant proposé sur sa facture d'inscription — vous pouvez le supprimer ensuite.
