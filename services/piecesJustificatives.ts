// Pièces justificatives obligatoires du dossier d'inscription, selon le cycle.
// Affichées dans le formulaire public, le portail parent et l'étape Documents admin.

export interface PieceJustificative {
  code: string;        // typeDoc stocké dans eleve_documents
  label: string;
  obligatoire: boolean;
}

const COMMUNES: PieceJustificative[] = [
  { code: 'EXTRAIT_NAISSANCE',  label: "Extrait de naissance de l'enfant (copie)", obligatoire: true },
  { code: 'CARNET_VACCINATION', label: 'Carnet de vaccination à jour (copie)', obligatoire: true },
  { code: 'PHOTOS_IDENTITE',    label: "2 photos d'identité de l'enfant", obligatoire: true },
  { code: 'CNI_PARENT',         label: 'Copie de la pièce d\'identité du parent / tuteur', obligatoire: true },
];

export function piecesForNiveau(niveau: string | undefined): PieceJustificative[] {
  if (niveau === 'CRECHE') {
    return [
      ...COMMUNES,
      { code: 'CERTIFICAT_MEDICAL', label: "Certificat médical d'aptitude à la vie en collectivité", obligatoire: true },
      { code: 'ORDONNANCE',         label: 'Ordonnance en cas de traitement médical', obligatoire: false },
    ];
  }
  // Maternelle & élémentaire
  return [
    ...COMMUNES,
    { code: 'CERTIFICAT_MEDICAL', label: 'Certificat médical', obligatoire: true },
    { code: 'LIVRET_SCOLAIRE',    label: "Livret scolaire ou certificat de radiation de l'ancienne école (en cas de transfert)", obligatoire: false },
  ];
}

// Pièce jointe prête à l'envoi (data-URL image compressée ou PDF)
export interface PieceJointe {
  typeDoc: string;
  nom: string;
  dataUrl: string;
  mimeType: string;
  fileSize: number;
}
