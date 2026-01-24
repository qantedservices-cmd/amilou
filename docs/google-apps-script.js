/**
 * Google Apps Script - Amilou Webhook
 *
 * À installer dans le Google Sheet lié au formulaire :
 * 1. Ouvrir le Google Sheet
 * 2. Extensions > Apps Script
 * 3. Coller ce code
 * 4. Configurer le déclencheur :
 *    - Édition > Déclencheurs du projet actuel
 *    - Ajouter un déclencheur
 *    - Fonction: onFormSubmit
 *    - Événement: Sur envoi du formulaire
 * 5. Autoriser les permissions
 */

const WEBHOOK_URL = 'http://72.61.105.112:3000/api/webhook/google-forms';
const WEBHOOK_SECRET = 'amilou_webhook_2026';

function onFormSubmit(e) {
  try {
    const response = e.namedValues;

    const type = getVal(response, 'Type de suivi');
    const qui = getVal(response, 'Qui');
    const annee = parseInt(getVal(response, 'Année'));
    const semaine = parseInt(getVal(response, 'Semaine'));

    if (!qui || !annee || !semaine) {
      Logger.log('Données manquantes: ' + JSON.stringify(response));
      return;
    }

    let payload;

    if (type === 'Avancement Mémorisation') {
      payload = {
        type: 'memorisation',
        data: {
          qui: qui,
          annee: annee,
          semaine: semaine,
          numSourate: parseInt(getVal(response, 'Num_Sourate')) || 0,
          versetDebut: parseInt(getVal(response, 'Verset début')) || 1,
          versetFin: parseInt(getVal(response, 'Verset fin')) || 1,
          repetition: parseInt(getVal(response, 'Répétition')) || null,
          commentaire: getVal(response, 'Commentaire mémorisation') || null
        }
      };
    } else if (type === 'Assiduité au quotidien') {
      payload = {
        type: 'assiduite',
        data: {
          qui: qui,
          annee: annee,
          semaine: semaine,
          dimanche: parseFloat(getVal(response, 'Dimanche')) || 0,
          lundi: parseFloat(getVal(response, 'Lundi')) || 0,
          mardi: parseFloat(getVal(response, 'Mardi')) || 0,
          mercredi: parseFloat(getVal(response, 'Mercredi')) || 0,
          jeudi: parseFloat(getVal(response, 'Jeudi')) || 0,
          vendredi: parseFloat(getVal(response, 'Vendredi')) || 0,
          samedi: parseFloat(getVal(response, 'Samedi')) || 0,
          commentaire: getVal(response, 'Commentaire assiduité') || null
        }
      };
    } else {
      Logger.log('Type inconnu: ' + type);
      return;
    }

    // Send to webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-webhook-secret': WEBHOOK_SECRET
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const result = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Webhook response: ' + result.getResponseCode() + ' - ' + result.getContentText());

  } catch (error) {
    Logger.log('Erreur webhook: ' + error.toString());
  }
}

function getVal(namedValues, key) {
  if (namedValues[key] && namedValues[key].length > 0) {
    return namedValues[key][0].trim();
  }
  return '';
}

// Fonction de test - à lancer manuellement pour vérifier la connexion
function testWebhook() {
  const payload = {
    type: 'memorisation',
    data: {
      qui: 'Samir',
      annee: 2026,
      semaine: 4,
      numSourate: 1,
      versetDebut: 1,
      versetFin: 7,
      commentaire: 'Test depuis Google Apps Script'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-webhook-secret': WEBHOOK_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const result = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log('Test response: ' + result.getResponseCode() + ' - ' + result.getContentText());
}
