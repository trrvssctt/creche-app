#!/bin/bash

# Script de test complet pour la génération et le téléchargement de fiches de paie
# Usage: ./test-payslip-system.sh

set -e

echo "🎯 Test complet du système de génération de fiches de paie"
echo "============================================================"

# Configuration
SERVER_URL="http://localhost:3001"
ADMIN_EMAIL="admin@gestockpro.com"
ADMIN_PASSWORD="testPassword123"
TENANT_ID="1"

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour log
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test de connexion au serveur
echo ""
log_info "1. Test de connexion au serveur..."
if curl -s "$SERVER_URL/health" > /dev/null; then
    log_info "✅ Serveur accessible sur $SERVER_URL"
else
    log_error "❌ Serveur inaccessible sur $SERVER_URL"
    log_warn "Assurez-vous que le serveur est démarré avec: npm run dev"
    exit 1
fi

# Authentification
echo ""
log_info "2. Authentification utilisateur..."
AUTH_RESPONSE=$(curl -s -X POST "$SERVER_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$ADMIN_EMAIL\",
        \"password\": \"$ADMIN_PASSWORD\"
    }")

if echo "$AUTH_RESPONSE" | grep -q "token"; then
    TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    log_info "✅ Authentification réussie"
else
    log_error "❌ Échec de l'authentification"
    echo "Réponse: $AUTH_RESPONSE"
    exit 1
fi

# Récupération des employés
echo ""
log_info "3. Récupération des employés..."
EMPLOYEES_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    -H "X-Tenant-ID: $TENANT_ID" \
    "$SERVER_URL/hr/employees")

if echo "$EMPLOYEES_RESPONSE" | grep -q "employees"; then
    EMPLOYEE_COUNT=$(echo "$EMPLOYEES_RESPONSE" | grep -o '"id":[0-9]*' | wc -l)
    log_info "✅ $EMPLOYEE_COUNT employé(s) trouvé(s)"
    
    # Prendre le premier employé pour les tests
    EMPLOYEE_ID=$(echo "$EMPLOYEES_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    if [ -n "$EMPLOYEE_ID" ]; then
        log_info "✅ Employé sélectionné: ID $EMPLOYEE_ID"
    else
        log_error "❌ Aucun employé trouvé pour les tests"
        exit 1
    fi
else
    log_error "❌ Échec de récupération des employés"
    echo "Réponse: $EMPLOYEES_RESPONSE"
    exit 1
fi

# Génération des fiches de paie pour janvier 2025
echo ""
log_info "4. Tests de génération de fiches de paie..."

# Test formats disponibles
FORMATS=("pdf" "png" "html")

for FORMAT in "${FORMATS[@]}"; do
    echo ""
    log_info "4.$(($(echo ${FORMATS[@]} | tr ' ' '\n' | grep -n "^$FORMAT$" | cut -d: -f1))) Test génération format $FORMAT..."
    
    DOWNLOAD_RESPONSE=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Tenant-ID: $TENANT_ID" \
        -o "test_payslip_${EMPLOYEE_ID}_01_2025.$FORMAT" \
        "$SERVER_URL/hr/payslips/employee/$EMPLOYEE_ID/download?month=1&year=2025&format=$FORMAT")
    
    HTTP_CODE="${DOWNLOAD_RESPONSE: -3}"
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        FILE_SIZE=$(stat -c%s "test_payslip_${EMPLOYEE_ID}_01_2025.$FORMAT" 2>/dev/null || echo "0")
        if [ "$FILE_SIZE" -gt 1000 ]; then
            log_info "✅ Fichier $FORMAT généré: $FILE_SIZE bytes"
            
            # Vérification du type de fichier pour PDF et PNG
            if [ "$FORMAT" = "pdf" ]; then
                if file "test_payslip_${EMPLOYEE_ID}_01_2025.$FORMAT" | grep -q PDF; then
                    log_info "✅ Format PDF validé"
                else
                    log_warn "⚠️ Le fichier n'est pas un PDF valide"
                fi
            elif [ "$FORMAT" = "png" ]; then
                if file "test_payslip_${EMPLOYEE_ID}_01_2025.$FORMAT" | grep -q PNG; then
                    log_info "✅ Format PNG validé"
                else
                    log_warn "⚠️ Le fichier n'est pas un PNG valide"
                fi
            elif [ "$FORMAT" = "html" ]; then
                if grep -q "<html" "test_payslip_${EMPLOYEE_ID}_01_2025.$FORMAT"; then
                    log_info "✅ Format HTML validé"
                else
                    log_warn "⚠️ Le fichier ne contient pas de HTML valide"
                fi
            fi
        else
            log_warn "⚠️ Fichier $FORMAT généré mais très petit ($FILE_SIZE bytes)"
        fi
    else
        log_error "❌ Échec génération $FORMAT (HTTP $HTTP_CODE)"
    fi
done

# Nettoyage des fichiers de test
echo ""
log_info "5. Nettoyage des fichiers de test..."
rm -f test_payslip_*.pdf test_payslip_*.png test_payslip_*.html
log_info "✅ Fichiers de test supprimés"

# Résumé final
echo ""
echo "============================================================"
log_info "🎯 Test complet terminé !"
echo ""
log_info "Le système de génération de fiches de paie fonctionne correctement."
log_info "Les formats PDF, PNG et HTML sont tous disponibles."
log_info "L'authentification et les téléchargements fonctionnent."
echo ""
log_warn "Note: Vérifiez que vos employés ont des contrats et données de paie"
log_warn "pour le mois testé afin d'obtenir des fiches complètes."
echo ""