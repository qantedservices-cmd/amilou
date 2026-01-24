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
    Logger.log('=== FORM SUBMIT TRIGGERED ===');
    Logger.log('Event object: ' + JSON.stringify(e));

    const response = e.namedValues;
    Logger.log('Named values keys: ' + Object.keys(response).join(', '));

    const type = getVal(response, 'Type de suivi');
    const qui = getVal(response, 'Qui');
    const annee = parseInt(getVal(response, 'Année'));
    const semaine = parseInt(getVal(response, 'Semaine'));

    Logger.log('Parsed: type=' + type + ', qui=' + qui + ', annee=' + annee + ', semaine=' + semaine);

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
  // Exact match first
  if (namedValues[key] && namedValues[key].length > 0) {
    return namedValues[key][0].trim();
  }
  // Case-insensitive fallback
  var lowerKey = key.toLowerCase();
  var keys = Object.keys(namedValues);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase().trim() === lowerKey) {
      return namedValues[keys[i]][0].trim();
    }
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

// Créer le déclencheur sur envoi de formulaire
// IMPORTANT: Supprimer les anciens déclencheurs avant de relancer
function createTrigger() {
  // Supprimer les anciens déclencheurs
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log(triggers.length + ' ancien(s) déclencheur(s) supprimé(s)');

  // Créer un nouveau déclencheur sur le spreadsheet lié
  var ss = SpreadsheetApp.openById('1b_FgwVsTc3mrV6iJAIxRv_rI6UWyGxZJ-vKUr8ooppI');
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  Logger.log('Nouveau déclencheur créé pour le spreadsheet: ' + ss.getName());
}

// Vérifier les déclencheurs existants
function checkTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('Nombre de déclencheurs: ' + triggers.length);
  for (var i = 0; i < triggers.length; i++) {
    Logger.log('Trigger ' + (i+1) + ': ' + triggers[i].getHandlerFunction() + ' - ' + triggers[i].getEventType());
  }
}

// Lire les colonnes du sheet pour debug
function debugColumns() {
  var ss = SpreadsheetApp.openById('1b_FgwVsTc3mrV6iJAIxRv_rI6UWyGxZJ-vKUr8ooppI');
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Sheet "' + sheet.getName() + '" colonnes: ' + headers.join(' | '));
  }
}
