/**
 * Google Apps Script - Amilou Webhook
 *
 * À installer dans le Google Sheet lié au formulaire :
 * 1. Ouvrir le Google Sheet
 * 2. Extensions > Apps Script
 * 3. Coller ce code
 * 4. Exécuter createTrigger() une fois
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

    // Calculer année et semaine depuis le Timestamp (ou champs si présents)
    let annee = parseInt(getVal(response, 'Année'));
    let semaine = parseInt(getVal(response, 'Semaine'));

    // Si année/semaine non fournis, calculer depuis Timestamp
    if (isNaN(annee) || isNaN(semaine)) {
      const timestamp = getVal(response, 'Timestamp');
      const weekInfo = getWeekFromTimestamp(timestamp);
      annee = weekInfo.year;
      semaine = weekInfo.week;
      Logger.log('Calculé depuis Timestamp: année=' + annee + ', semaine=' + semaine);
    }

    Logger.log('Parsed: type=' + type + ', qui=' + qui + ', annee=' + annee + ', semaine=' + semaine);

    if (!qui || isNaN(annee) || isNaN(semaine)) {
      Logger.log('Données manquantes: qui=' + qui + ', annee=' + annee + ', semaine=' + semaine);
      return;
    }

    let payload;

    if (type === 'Avancement Mémorisation') {
      // Pour mémorisation, essayer de récupérer sourate depuis différents noms de colonnes
      let numSourate = parseInt(getVal(response, 'Num_Sourate')) ||
                       parseInt(getVal(response, 'Sourate')) ||
                       parseInt(getVal(response, 'NumSourate')) || 0;

      payload = {
        type: 'memorisation',
        data: {
          qui: qui,
          annee: annee,
          semaine: semaine,
          numSourate: numSourate,
          versetDebut: parseInt(getVal(response, 'Verset début')) || parseInt(getVal(response, 'VersetDebut')) || 1,
          versetFin: parseInt(getVal(response, 'Verset fin')) || parseInt(getVal(response, 'VersetFin')) || 1,
          repetition: parseInt(getVal(response, 'Répétition')) || null,
          commentaire: getVal(response, 'Commentaire mémorisation') || getVal(response, 'Commentaire') || null
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
          commentaire: getVal(response, 'Commentaire assiduité') || getVal(response, 'Commentaire') || null
        }
      };
    } else {
      Logger.log('Type inconnu: ' + type);
      return;
    }

    Logger.log('Envoi webhook: ' + JSON.stringify(payload));

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

// Calculer l'année et la semaine depuis un timestamp Google Forms
// Semaine Sun-Sat (dimanche = premier jour de la semaine)
function getWeekFromTimestamp(timestamp) {
  let date;

  if (timestamp) {
    // Format Google Forms: "1/25/2026 16:07:25" (M/D/YYYY H:mm:ss)
    const parts = timestamp.split(' ')[0].split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1;
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      date = new Date(year, month, day);
    }
  }

  if (!date || isNaN(date.getTime())) {
    date = new Date(); // Fallback to today
  }

  // Pour semaine Sun-Sat: trouver le dimanche qui commence cette semaine
  const dayOfWeek = date.getDay(); // 0 = Dimanche, 6 = Samedi
  const sundayOfThisWeek = new Date(date);
  sundayOfThisWeek.setDate(date.getDate() - dayOfWeek);
  sundayOfThisWeek.setHours(0, 0, 0, 0);

  // Le lundi suivant ce dimanche nous donne le numéro de semaine ISO
  const mondayOfThisWeek = new Date(sundayOfThisWeek);
  mondayOfThisWeek.setDate(sundayOfThisWeek.getDate() + 1);

  // Calculer le numéro de semaine ISO en utilisant ce lundi
  const tempDate = new Date(mondayOfThisWeek.getTime());
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

  const isoYear = tempDate.getFullYear();

  return { year: isoYear, week: weekNumber };
}

function getVal(namedValues, key) {
  // Exact match first
  if (namedValues[key] && namedValues[key].length > 0 && namedValues[key][0].trim() !== '') {
    return namedValues[key][0].trim();
  }
  // Case-insensitive fallback
  var lowerKey = key.toLowerCase();
  var keys = Object.keys(namedValues);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase().trim() === lowerKey) {
      var val = namedValues[keys[i]][0].trim();
      if (val !== '') return val;
    }
  }
  return '';
}

// Fonction de test - à lancer manuellement pour vérifier la connexion
function testWebhook() {
  const payload = {
    type: 'assiduite',
    data: {
      qui: 'Samir',
      annee: 2026,
      semaine: 5,
      dimanche: 4,
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
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

// Test du calcul de semaine (Sun-Sat)
function testWeekCalculation() {
  var tests = [
    '1/24/2026 10:00:00',  // Samedi 24 jan → semaine 4 (fin de semaine S4)
    '1/25/2026 16:07:25',  // Dimanche 25 jan → semaine 5 (début de semaine S5)
    '1/26/2026 10:00:00',  // Lundi 26 jan → semaine 5 (même semaine que dim 25)
    '1/31/2026 10:00:00',  // Samedi 31 jan → semaine 5 (fin de semaine S5)
    '2/1/2026 10:00:00',   // Dimanche 1 fév → semaine 6 (début de semaine S6)
  ];

  for (var i = 0; i < tests.length; i++) {
    var result = getWeekFromTimestamp(tests[i]);
    Logger.log(tests[i] + ' => Année: ' + result.year + ', Semaine: ' + result.week);
  }
}
