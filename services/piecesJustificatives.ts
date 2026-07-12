// Pièces justificatives obligatoires du dossier d'inscription, selon le cycle.
// Affichées dans le formulaire public, le portail parent et l'étape Documents admin.

export interface PieceJustificative {
  label: string;
  obligatoire: boolean;
}

const COMMUNES: PieceJustificative[] = [
  { label: "Extrait de naissance de l'enfant (copie)", obligatoire: true },
  { label: 'Carnet de vaccination à jour (copie)', obligatoire: true },
  { label: "2 photos d'identité de l'enfant", obligatoire: true },
  { label: 'Copie de la pièce d\'identité du parent / tuteur', obligatoire: true },
];

export function piecesForNiveau(niveau: string | undefined): PieceJustificative[] {
  if (niveau === 'CRECHE') {
    return [
      ...COMMUNES,
      { label: "Certificat médical d'aptitude à la vie en collectivité", obligatoire: true },
      { label: 'Ordonnance en cas de traitement médical', obligatoire: false },
    ];
  }
  // Maternelle & élémentaire
  return [
    ...COMMUNES,
    { label: 'Certificat médical', obligatoire: true },
    { label: "Livret scolaire ou certificat de radiation de l'ancienne école (en cas de transfert)", obligatoire: false },
  ];
}
