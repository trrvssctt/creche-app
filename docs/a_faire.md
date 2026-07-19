# À faire — liste (transcription de a_faire.jpeg)

> Transcription de la note manuscrite. Les passages incertains sont signalés par `[?]`.

1. **Recharge de l'année scolaire** : affiche toujours l'année active → dans la partie **Paramètres (Année scolaire)** Lorsque je cloture une ann.
    - ✅ Fait : après clôture, le backend bascule automatiquement `anneeActive` sur la prochaine année disponible. Le frontend met à jour le contexte + localStorage. Le filet de sécurité dans AnneeContext ignore une année clôturée même si elle est en cache.
3. **Signature digitale à implementer sur tous les document qui demande signature elle devra etre signer et mis dans l'application** *(urgent)*.
    - ✅ Fait : champ « Signature de la Direction » ajouté dans Paramètres > Assets Visuels (à côté du logo et cachet). Le cachet officiel + la signature sont automatiquement apposés sur tous les documents administratifs (fiche inscription, certificats scolarité/radiation, fiche sanitaire, autorisation sortie, convention de scolarisation, règlement intérieur). Migration BD appliquée (`signature_direction_url` sur tenant).
5. **Autorisation de soins avec fiche sanitaire elle doit aussi etre generer comme les autres** *(crèche)*.
    - ✅ Fait : document « Autorisation de soins » ajouté comme type de document généré pour la crèche. Inclut autorisations (SAMU, hospitalisation, premiers soins, traitement sur ordonnance), infos médicales (allergies, traitement, médecin), contacts d'urgence. Signature digitale incluse.
6. **Convention de scolarité** *(Élémentaire + Maternelle)* à generer aussi voir les fichier  et signer digitalement : /home/dianka/Documents/Crèche_project/assets/convention_page_1.jpeg et /home/dianka/Documents/Crèche_project/assets/convention_page_2.jpeg.
    - ✅ Fait : convention mise à jour avec les 8 articles du document officiel (objet, obligations établissement, obligations parents, coût, modalités paiement, assurances, dégradations, durée et résiliation avec 8-1 et 8-2). Signature digitale incluse.
7. **Flo Pays [?] de résidence des parents** *(pays de résidence des parents)* o doit avoir ce champs aussi dans la creation du dossier (Admission.tsx, Eleves.tsx, InscriptionParent.tsx etc.. ).
    - ✅ Fait : champ « Pays de résidence » ajouté pour parent 1 et parent 2 dans les 4 formulaires (Admission admin, Eleves admin, formulaire public /inscription, portail parent) + affiché dans la vue détail.
8. **Duplicata il doi etre possible de dupliquer une inscription (un eleve dans Eleves de telle sorte pour les parents qui on plusieurs enfannt on en instcits un et o le duplique en modifier les element necessaire(la modification est obligatoire))** *(urgent)*.
    - ✅ Fait : bouton « Dupliquer » (icône copie) sur chaque élève (vue cartes + tableau). Reprend la famille (parents, contacts, adresse, régime, nom de famille), vide l'identité de l'enfant (prénom, naissance, sexe, photo, matricule, classe). Enregistrement bloqué si le prénom reste identique à l'élève source. Garde-fou backend anti-doublon déjà en place.
9. **Liste par ordre alphabétique** en commençant par le nom de famille dans la partie Classe.tsx pour chaque class.
    - ✅ Fait : la liste des élèves d'une classe est triée par nom de famille (puis prénom), affichage « NOM Prénom ».
10. **Âge sur la classe** *(afficher l'âge de chaque eleve dans la classe : cet age est calculer automatiquement)*.
    - ✅ Fait : colonne « Âge » calculée automatiquement depuis la date de naissance (mois avant 2 ans, années ensuite).
11. **Les offres de scolarité s'applique chaque mois alors que je n'ai pas cocher le checkbox** (dans la section Offres de Scolarité) : elle s'applique partout alors que des fois quand je coche pas elle ne doit pas s'appliquer à tous les mois si c'est recurrents ou pas — envoi par mail et WhatsApp.
    - ✅ Fait : le champ `estRecurrent` est maintenant persisté en BD (migration `est_recurrent` sur table `services`). La génération mensuelle (syncMensuel + factureEleve) filtre désormais sur `estRecurrent: true`. Si la checkbox est décochée, le service n'est plus appliqué automatiquement chaque mois.
12. **Revoir les bulletins car chaque classe sauf la creche possède deux bulletis : notes et appreciation** (avec les templates du Drive : /home/dianka/Documents/Crèche_project/assets/Drive) → Réproduit à l'identique les bon bulletin *(urgent)*.
    - ✅ Fait : grilles officielles PS/MS/GS (compétences) + CP/CE1/CE2 (notes /20 + compétences EA/A/M), 2 bulletins pour l'élémentaire, onglets Notes/Compétences.
    - ⏳ **Reste à faire : les bulletins CM1 et CM2** (aucun template CM1/CM2 dans le Drive — à fournir ou à décider : reprendre le modèle CE2 ?).
    - ⏳ Reste aussi : impression pixel-perfect (blocs « Bilan périodique / signatures » par trimestre) ; bulletin de compétences côté portail parent.
13. **CM1 et CM2** à prévoir(voir si tous est ok).
14. **Créer des templates WhatsApp. Donner acces à creer , modifir et supprimer des templates de whatshapp**
    - ✅ Fait : CRUD complet des templates WhatsApp. Bouton « Créer un modèle » dans l'onglet Modèles — formulaire avec nom, description, icône, couleur, variables personnalisées, corps du message avec aperçu live. Modification du body pour tous les templates (natifs + personnalisés). Suppression possible uniquement pour les templates personnalisés (badge « Perso »). Réinitialisation vers le texte par défaut pour les templates natifs. Stockage localStorage (clé `wa_custom_templates`).
15. **Rencontre parent–prof. Dans la section Evenement pour la partie evenement de type rencontre parent-prof on doit pouvoir prevoir le calendrier de cet evenement en disant Eleve 1 09H00-12H00, ensuite Enlève 2 12H00-14H00** sous forme de créneaux.
    - ✅ Fait : pour les événements de type « Réunion parents-profs », un module de créneaux permet d'attribuer un horaire à chaque élève (sélecteur d'élève + heure début/fin). L'heure de début du créneau suivant est pré-remplie avec la fin du précédent. Les créneaux sont affichés dans la liste des événements. Données stockées en JSONB sur `school_events.creneaux`.
16. **Gestion de la Paie RH** — pas de besoins (desactive le) [?].
    - ✅ Fait : onglet « Gestion de la Paie » masqué dans le dashboard RH (section commentée, module inaccessible).
17. **Notification RH Pour les demande de congés, etc on doit avoir une noification pour alerter l'admin ou l'employé e question** — congé ou justificatifs d'absence.
    - ✅ Fait : notifications automatiques créées lors des événements de congé. 1) Demande de congé ou justification d'absence → notification broadcast aux admins/RH (type LEAVE, lien vers /rh?tab=conges). 2) Approbation ou refus → notification ciblée à l'employé concerné avec le motif de refus si applicable. Utilise le système de notifications in-app existant (table `notifications` + lecture/non-lu).
18. **Type de contrat ** (Standard, prestation).
    - ✅ Fait : types « STANDARD » et « PRESTATION » ajoutés aux options de contrat. STANDARD = contrat sans date de fin obligatoire avec période d'essai max 3 mois. PRESTATION = prestation de services avec date de fin obligatoire, pas de période d'essai. Modèle Sequelize passé de ENUM à STRING pour supporter de nouveaux types sans migration. Validations backend + frontend à jour.
19. **Pas de pointage en cas de non boulot** *(prendre en compte l'emploi du temps du prof)*.
    - ✅ Fait : le pointage vérifie désormais l'emploi du temps de l'employé. Si aucun créneau n'est programmé pour le jour courant (lundi=0…vendredi=4), le clock-in est refusé avec « Pas de cours programmé aujourd'hui ». Les horaires autorisés sont ceux de l'emploi du temps personnel (min heureDebut → max heureFin) au lieu des horaires globaux. Le bouton est grisé côté frontend avec un message explicatif.
