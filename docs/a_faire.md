# À faire — liste (transcription de a_faire.jpeg)

> Transcription de la note manuscrite. Les passages incertains sont signalés par `[?]`.

1. **Recharge de l'année scolaire** : affiche toujours l'année active → dans la partie **Paramètres (Année scolaire)** Lorsque je cloture une ann.
3. **Signature digitale à implementer sur tous les document qui demande signature elle devra etre signer et mis dans l'application** *(urgent)*.
5. **Autorisation de soins avec fiche sanitaire elle doit aussi etre generer comme les autres** *(crèche)*.
6. **Convention de scolarité** *(Élémentaire + Maternelle)* à generer aussi voir les fichier  et signer digitalement : /home/dianka/Documents/Crèche_project/assets/convention_page_1.jpeg et /home/dianka/Documents/Crèche_project/assets/convention_page_2.jpeg.
7. **Flo Pays [?] de résidence des parents** *(pays de résidence des parents)* o doit avoir ce champs aussi dans la creation du dossier (Admission.tsx, Eleves.tsx, InscriptionParent.tsx etc.. ).
    - ✅ Fait : champ « Pays de résidence » ajouté pour parent 1 et parent 2 dans les 4 formulaires (Admission admin, Eleves admin, formulaire public /inscription, portail parent) + affiché dans la vue détail.
8. **Duplicata il doi etre possible de dupliquer une inscription (un eleve dans Eleves de telle sorte pour les parents qui on plusieurs enfannt on en instcits un et o le duplique en modifier les element necessaire(la modification est obligatoire))** *(urgent)*.
    - ✅ Fait : bouton « Dupliquer » (icône copie) sur chaque élève (vue cartes + tableau). Reprend la famille (parents, contacts, adresse, régime, nom de famille), vide l'identité de l'enfant (prénom, naissance, sexe, photo, matricule, classe). Enregistrement bloqué si le prénom reste identique à l'élève source. Garde-fou backend anti-doublon déjà en place.
9. **Liste par ordre alphabétique** en commençant par le nom de famille dans la partie Classe.tsx pour chaque class.
    - ✅ Fait : la liste des élèves d'une classe est triée par nom de famille (puis prénom), affichage « NOM Prénom ».
10. **Âge sur la classe** *(afficher l'âge de chaque eleve dans la classe : cet age est calculer automatiquement)*.
    - ✅ Fait : colonne « Âge » calculée automatiquement depuis la date de naissance (mois avant 2 ans, années ensuite).
11. **Reçus** (dans la section Offres de Scolarité) : elle s'applique partout — envoi par mail et WhatsApp.
12. **Revoir les bulletins car chaque classe sauf la creche possède deux bulletis : notes et appreciation** (avec les templates du Drive : /home/dianka/Documents/Crèche_project/assets/Drive) → Réproduit à l'identique les bon bulletin *(urgent)*.
    - ✅ Fait : grilles officielles PS/MS/GS (compétences) + CP/CE1/CE2 (notes /20 + compétences EA/A/M), 2 bulletins pour l'élémentaire, onglets Notes/Compétences.
    - ⏳ **Reste à faire : les bulletins CM1 et CM2** (aucun template CM1/CM2 dans le Drive — à fournir ou à décider : reprendre le modèle CE2 ?).
    - ⏳ Reste aussi : impression pixel-perfect (blocs « Bilan périodique / signatures » par trimestre) ; bulletin de compétences côté portail parent.
13. **CM1 et CM2** à prévoir(voir si tous est ok).
14. **Créer des templates WhatsApp. Donner acces à creer , modifir et supprimer des templates de whatshapp**
15. **Rencontre parent–prof. Dans la section Evenement pour la partie evenement de type rencontre parent-prof on doit pouvoir prevoir le calendrier de cet evenement en disant Eleve 1 09H00-12H00, ensuite Enlève 2 12H00-14H00** sous forme de créneaux.
16. **Gestion de la Paie RH** — pas de besoins (desactive le) [?].
17. **Notification RH Pour les demande de congés, etc on doit avoir une noification pour alerter l'admin ou l'employé e question** — congé ou justificatifs d'absence.
18. **Type de contrat ** (Standard, prestation).
19. **Pas de pointage en cas de non boulot** *(prendre en compte l'emploi du temps du prof)*.
