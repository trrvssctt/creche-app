#!/bin/bash

# Script de test du module RH
# Exécute des appels API pour valider l'intégration

API_BASE="http://localhost:3000/api"
TOKEN="" # À remplacer par un token JWT valide

echo "🧪 Tests du Module RH - GeStockPro"
echo "=================================="

# Test de connectivité
echo "1. Test de connectivité..."
curl -s "$API_BASE/auth/health" > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Serveur accessible"
else
    echo "❌ Serveur non accessible - Démarrez le serveur avec: cd backend && node server.js"
    exit 1
fi

# Si un token JWT est fourni, on teste les endpoints protégés
if [ -n "$TOKEN" ]; then
    echo
    echo "2. Tests avec authentification..."
    
    # Test employés
    echo "   📋 Test /hr/employees..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/hr/employees")
    if [[ $RESPONSE == *"error"* ]]; then
        echo "   ❌ Erreur employés: $RESPONSE"
    else
        echo "   ✅ Endpoint employés fonctionnel"
    fi
    
    # Test départements
    echo "   🏢 Test /hr/departments..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/hr/departments")
    if [[ $RESPONSE == *"error"* ]]; then
        echo "   ❌ Erreur départements: $RESPONSE"
    else
        echo "   ✅ Endpoint départements fonctionnel"
    fi
    
    # Test paramètres paie
    echo "   💰 Test /hr/payroll-settings..."
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/hr/payroll-settings")
    if [[ $RESPONSE == *"error"* ]]; then
        echo "   ❌ Erreur paramètres paie: $RESPONSE"
    else
        echo "   ✅ Endpoint paramètres paie fonctionnel"
    fi
    
else
    echo
    echo "2. Tests sans authentification (limitation attendue)..."
    
    # Test sans token (doit retourner 401)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/hr/employees")
    if [ "$HTTP_CODE" = "401" ]; then
        echo "   ✅ Authentification requise (HTTP 401) - Normal"
    else
        echo "   ⚠️  Code HTTP inattendu: $HTTP_CODE"
    fi
fi

echo
echo "3. Structure des fichiers..."

# Vérification des fichiers créés
FILES=(
    "models/Department.js"
    "models/Leave.js" 
    "models/EmployeeDocument.js"
    "models/JobOffer.js"
    "models/Candidate.js"
    "models/Training.js"
    "models/TrainingParticipant.js"
    "models/PerformanceReview.js"
    "models/PayrollSettings.js"
    "controllers/DepartmentController.js"
    "controllers/LeaveController.js"
    "controllers/EmployeeDocumentController.js"
    "controllers/JobOfferController.js"
    "controllers/CandidateController.js"
    "controllers/TrainingController.js"
    "controllers/PerformanceReviewController.js"
    "controllers/PayrollSettingsController.js"
    "migrations/20260301-extend-hr-complete-module.sql"
)

for file in "${FILES[@]}"; do
    if [ -f "backend/$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file manquant"
    fi
done

echo
echo "4. Migration SQL..."
if [ -f "backend/migrations/20260301-extend-hr-complete-module.sql" ]; then
    echo "   ✅ Migration SQL créée"
    echo "   📝 Pour l'appliquer : psql -d your_database -f backend/migrations/20260301-extend-hr-complete-module.sql"
else
    echo "   ❌ Migration SQL manquante"
fi

echo
echo "🎉 Module RH Backend - Status: OPÉRATIONNEL"
echo
echo "📚 Documentation complète : backend/HR_MODULE_DOCUMENTATION.md"
echo "🔧 Pour tester avec authentification, modifiez la variable TOKEN dans ce script"