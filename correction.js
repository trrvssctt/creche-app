// Formatte les résultats selon le type spécifié
const allResults = $input.all();
const userQuestion = $('Webhook1').first().json.body.chatInput;
const sessionId = $('Webhook1').first().json.body.sessionId;

// Récupère les métadonnées
const metadata = allResults[0]?.json?._metadata || {};
const formatType = metadata.format || 'list';
const stats = metadata.stats;
const resultCount = allResults.length;

if (resultCount === 0) {
  return [{
    json: {
      formattedResponse: `Désolé, je n'ai trouvé aucune donnée correspondant à votre requête : "${userQuestion}".`,
      sessionId: sessionId,
      format: 'text',
      resultCount: 0
    }
  }];
}

let response = '';
let rawData = allResults.map(item => item.json);

switch(formatType) {
  case 'simple':
    const value = Object.values(allResults[0].json)[0];
    response = `**Résultat :** ${value}`;
    break;
    
  case 'list':
    response = `**Résultats (${resultCount}) :**\n\n`;
    allResults.forEach((item, index) => {
      const data = item.json;
      const columns = Object.keys(data);
      if (columns.length === 1) {
        response += `• ${data[columns[0]]}\n`;
      } else {
        const values = columns.map(col => `${data[col]}`).join(' - ');
        response += `${index + 1}. ${values}\n`;
      }
    });
    break;
    
  case 'table':
    const columns = Object.keys(allResults[0].json);
    response = `**Tableau des résultats (${resultCount} lignes) :**\n\n`;
    response += '| ' + columns.join(' | ') + ' |\n';
    response += '|' + columns.map(() => '---').join('|') + '|\n';
    allResults.forEach(item => {
      const row = columns.map(col => item.json[col] || '').join(' | ');
      response += `| ${row} |\n`;
    });
    break;
    
  case 'stats':
    response = `**Statistiques :**\n\n`;
    response += `Total : ${resultCount} enregistrement(s)\n\n`;
    if (stats) {
      Object.keys(stats).forEach(col => {
        const s = stats[col];
        response += `**${col} :**\n`;
        response += `  • Somme : ${s.sum.toFixed(2)}\n`;
        response += `  • Moyenne : ${s.avg.toFixed(2)}\n`;
        response += `  • Min : ${s.min.toFixed(2)}\n`;
        response += `  • Max : ${s.max.toFixed(2)}\n\n`;
      });
    }
    if (resultCount <= 20) {
      response += `**Détails :**\n`;
      allResults.forEach((item, index) => {
        const data = item.json;
        const values = Object.entries(data).map(([key, value]) => `${key}: ${value}`).join(', ');
        response += `${index + 1}. ${values}\n`;
      });
    }
    break;
    
  case 'chart':
    // Format spécial pour graphiques
    const chartColumns = Object.keys(allResults[0].json);
    response = `**Données pour visualisation (${resultCount} points) :**\n\n`;
    
    if (chartColumns.length >= 2) {
      const labelCol = chartColumns[0];
      const valueCol = chartColumns.find(col => col.includes('total') || col.includes('count') || col.includes('sum') || col.includes('ventes') || col.includes('ca') || col.includes('chiffre'));
      
      if (valueCol) {
        response += `*Ces données peuvent être représentées sous forme de graphique :*\n`;
        response += `- Axe X (labels) : ${labelCol}\n`;
        response += `- Axe Y (valeurs) : ${valueCol}\n\n`;
      }
    }
    
    // Affiche les données en tableau
    response += '| ' + chartColumns.join(' | ') + ' |\n';
    response += '|' + chartColumns.map(() => '---').join('|') + '|\n';
    allResults.forEach(row => {
      const rowData = chartColumns.map(col => row.json[col] || '').join(' | ');
      response += `| ${rowData} |\n`;
    });
    break;
    
  default:
    response = `**Résultats pour :** ${userQuestion}\n\n`;
    allResults.forEach((item, index) => {
      const data = item.json;
      const values = Object.entries(data).map(([key, value]) => `**${key}** : ${value}`).join(', ');
      response += `${index + 1}. ${values}\n`;
    });
}

response += `\n---\n*${resultCount} résultat(s) trouvé(s)*`;

return [{
  json: {
    formattedResponse: response,
    sessionId: sessionId,
    format: formatType,
    resultCount: resultCount,
    rawResults: rawData,
    metadata: metadata
  }
}];