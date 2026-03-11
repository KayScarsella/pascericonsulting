class ToggleContent {
    constructor(contentId, buttonId, initialState) {
      this.contentElement = document.getElementById(contentId);
      this.buttonElement = document.getElementById(buttonId);
      this.buttonElement.addEventListener('click', () => this.toggle());
  
      // Set initial state
      if (initialState === 'closed') {
        this.contentElement.classList.add("closed");
        this.buttonElement.innerHTML = "<i class='fas fa-chevron-up'></i>";
      } else if (initialState === 'open') {
        this.contentElement.classList.add("open");
        this.buttonElement.innerHTML = "<i class='fas fa-chevron-down'></i>";
      }
    }
  
    toggle() {
      if (this.contentElement.classList.contains("open") || this.contentElement.classList.contains("show-content")) {
        this.contentElement.classList.remove("open");
        this.contentElement.classList.remove("show-content");
        this.contentElement.classList.add("hide-content");
        this.buttonElement.innerHTML = "<i class='fas fa-chevron-up'></i>";
      } else {
        this.contentElement.classList.remove("closed");
        this.contentElement.classList.remove("hide-content");
        this.contentElement.classList.add("show-content");
        this.buttonElement.innerHTML = "<i class='fas fa-chevron-down'></i>";
      }
    }
  }
  const accessToken = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJYVUh3VWZKaHVDVWo0X3k4ZF8xM0hxWXBYMFdwdDd2anhob2FPLUxzREZFIn0.eyJleHAiOjE3MjQzNDk4MzQsImlhdCI6MTcyNDM0OTIzNCwianRpIjoiZWE4MmMxYWYtNWUxMi00NDdkLWIyODktMDRhMDc1M2I4ZTRlIiwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS5kYXRhc3BhY2UuY29wZXJuaWN1cy5ldS9hdXRoL3JlYWxtcy9DRFNFIiwic3ViIjoiYTBkYmRkMzktOWRlNy00MjRjLTlmY2QtNjQ1N2VlOWEwYmFhIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoic2gtZGFmMGE1ODMtYmIyZi00NTI5LTg3M2YtMjgyYzVjN2UxYWY0Iiwic2NvcGUiOiJlbWFpbCBwcm9maWxlIHVzZXItY29udGV4dCIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiY2xpZW50SG9zdCI6IjkzLjQ0LjIwMi4xOTciLCJvcmdhbml6YXRpb25zIjpbImRlZmF1bHQtZGRiOGUwOWYtY2Y2MC00YzlkLWEzYzktMGViZmUwMjIwNDYwIl0sInVzZXJfY29udGV4dF9pZCI6IjhlMWQwYTFjLTJjYWEtNGMwNS05YzU1LWRiYzc4MGQyMWFhNCIsImNvbnRleHRfcm9sZXMiOnt9LCJjb250ZXh0X2dyb3VwcyI6WyIvYWNjZXNzX2dyb3Vwcy91c2VyX3R5cG9sb2d5L2NvcGVybmljdXNfZ2VuZXJhbC8iLCIvb3JnYW5pemF0aW9ucy9kZWZhdWx0LWRkYjhlMDlmLWNmNjAtNGM5ZC1hM2M5LTBlYmZlMDIyMDQ2MC8iXSwicHJlZmVycmVkX3VzZXJuYW1lIjoic2VydmljZS1hY2NvdW50LXNoLWRhZjBhNTgzLWJiMmYtNDUyOS04NzNmLTI4MmM1YzdlMWFmNCIsInVzZXJfY29udGV4dCI6ImRlZmF1bHQtZGRiOGUwOWYtY2Y2MC00YzlkLWEzYzktMGViZmUwMjIwNDYwIiwiY2xpZW50QWRkcmVzcyI6IjkzLjQ0LjIwMi4xOTciLCJjbGllbnRfaWQiOiJzaC1kYWYwYTU4My1iYjJmLTQ1MjktODczZi0yODJjNWM3ZTFhZjQifQ.fRo0XWo4_WO3p1wHbucMWS204TftC_YQDk3HaS6Jvb2CF2JsXzwRPb_-GBbyKcTH1p5Sue3PT4My57qcTZXij_ucN5io25ZeOqBaXGBtHa6qsRyJqFt6I-7jIGVEpSYFcnygfUrkIFSVpmvdRWvWNOJf3PenL4pGc53BhfsphQYJgPWunro9P-mhW6sSeR9xDHhFlEotI8kbPXeEoruS5d1SzoxGt9slpruMhYB7rlkwJ2QRwazK0kqS98GKNh8dUf2M8vNh4rmlSQ3ktvCaAOWmO0eqaSO3czZWLKQDPSkZZiZIasNd5fMbRHqbZgvqsicxxbzY_3EY-7nfqr-mBA"';
  const storedData = [];
  let alert;
  let list_element;
  let formChildren;
  let myform;
  let formc;
  var id;
    document.addEventListener('DOMContentLoaded', function() {
      crea_select();
      new ToggleContent("contentBodyA", "toggleButtonA","closed");
      new ToggleContent("contentBodyB", "toggleButtonB","closed");
      new ToggleContent("contentBodyC", "toggleButtonC","open");
      new ToggleContent("contentBodyD", "toggleButtonD","open");
      new ToggleContent("contentBodyE", "toggleButtonE","open");
      new ToggleContent("contentBodyF", "toggleButtonF","open");
      new ToggleContent("contentBodyG", "toggleButtonG","open");
      new ToggleContent("contentBodyH", "toggleButtonH","open");
      new ToggleContent("contentBodyI", "toggleButtonI","open");
      alert = document.getElementById("alert");
      cercaPaese();
      document.getElementById('file_GeoJSON').addEventListener('change', handleFile);
      var queryString = window.location.search;
      var urlParams = new URLSearchParams(queryString);
      id = urlParams.get('id');
      startselect2(document.getElementById("NomeSpecie"));
      document.getElementById('myform').addEventListener('submit', function(event) {
        event.preventDefault(); 
    
        var form = document.getElementById('myform');
        var formData = new FormData(form);
        formData.append("id_analisi_finale",id);
    
        fetch('./server/add_fornitore.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.text()).then(response => console.log(response))
        .catch((error) => console.error('Error:', error));
    });
    document.getElementById('btnform').addEventListener('click', function(event) {
      // Prevenire l'invio del form
      event.preventDefault();
    
      var allFieldsSelected = true;
      var missingFieldMessage = " <strong>Warning!</strong> Per favore, compila tutti i campi. Non hai compilato il campo evidenziato.";
      var fields = document.querySelectorAll('.selected-option');
      
      for (let i = 0; i < fields.length; i++) {
        let field = fields[i];
        var value = field.textContent || '';
        if(i == 3){
          let dataInizio = document.getElementById('data_inizio').value;
          let dataFine = document.getElementById('data_fine').value;
          let filePeriodoProduzione = document.getElementById('file_periodo_produzione').value;

          if ((dataInizio && !dataFine) || (!dataInizio && dataFine)) {
              allFieldsSelected = false;
              missingFieldMessage = '<strong>Warning!</strong> Per favore, inserisci sia la data di inizio che la data di fine.';
              break;
          }

          if (dataInizio && dataFine && !filePeriodoProduzione) {
              allFieldsSelected = false;
              missingFieldMessage = '<strong>Warning!</strong> Per favore, carica il file per il periodo di produzione.';
              break;
          }
        }
        if (field.classList.contains('container-category')) {
          // Se l'elemento è gestito da Select2, ottenere il valore in un modo diverso
          value = $(field).val();
        }
        if (field.offsetParent !== null && (value === "Seleziona...")) {
          if(i==0){
            let f = document.getElementById("myform");
            if(f.checkValidity()){
              document.getElementById("btnfornitore").click();
              continue;
            }
            document.getElementById("btnfornitore").click();
          }
          let parent = field.closest('.col-sm-3') || field.closest('.col-sm-2') || field.closest('.col-sm-6') || field.closest('.col-sm-5');
          let ic = field.id;
            allFieldsSelected = false;
            if (parent) {
              parent.style.borderColor = 'yellow';
              parent.style.borderWidth = '3px';
            }
            break;          
        } else {
          let parent = field.closest('.col-sm-3') || field.closest('.col-sm-2') || field.closest('.col-sm-6') || field.closest('.col-sm-5');
          if (parent) {
              parent.style.borderColor = ''; // Rimuovere il colore del bordo
              parent.style.borderWidth = ''; // Ripristinare lo spessore del bordo
          }
        }
      }
      if (allFieldsSelected) {
        let nome_analisi = document.getElementById("nome_analisi").value;
        let formDataD = get_form(document.getElementById("contentBodyD"));
        let formDataE = get_form(document.getElementById("contentBodyE"));
        let formDataF = get_form(document.getElementById("contentBodyF"));
        let formDataG = get_form(document.getElementById("contentBodyG"));
        let formDataH = get_form(document.getElementById("contentBodyH"));
        let formDataI = get_form(document.getElementById("contentBodyI"));
        let allFormData = new FormData();
    
        let formDataSet = {D: formDataD, E: formDataE, F: formDataF, G: formDataG, H: formDataH, I: formDataI};
    
        for (let formKey in formDataSet) {
            let formData = formDataSet[formKey];
            for (let [key, value] of formData) {
                allFormData.append(`formData${formKey}[${key}]`, value);
            }
        }
        allFormData.append("nome_analisi", nome_analisi);
        allFormData.append("id", id);
    
        // Aggiungi i dati di `storedData` a `allFormData`
        storedData.forEach((data, index) => {
            const lottoName = `lotto${index + 1}`;
            data.forEach(entry => {
                allFormData.append(`${lottoName}[${entry.umd_tree_cover_loss__year}]`, entry.area_ha);
            });
        });
    
        fetch('server/add_valutazione_finale.php', {
            method: 'POST',
            body: allFormData
        })
        .then(response => response.text())
        .then(result => {
            window.location.href = './analisi.php?id=' + id;
        })
        .catch(error => console.error('Error:', error));
    }else {
        showAlert(
            "alert alert-danger alert-dismissible",
            missingFieldMessage
        );
    }         
    });
  });
  
  function generate_fornitore(element){
    let form = document.getElementById("myform");
    var queryString = window.location.search;
    var urlParams = new URLSearchParams(queryString);
    let id = urlParams.get('id');
    let id_fornitore = element.getAttribute("data-value");
    
    fetch(`server/add_fornitore.php?id_fornitore=${id_fornitore}&id=${id}`, {
      method: 'GET'
    }).then(response => response.json())
    .then(result => {
      for (let key in result) {
        let formElement = form.querySelector(`#${key}`);
        if (formElement) {
          formElement.value = result[key];
        }
      }
      
    }).catch(error => console.error('Error:', error));
  }
  function crea_select(){
      var selects = document.querySelectorAll('.custom-select');
    
      selects.forEach(function(select) {
          var options = select.querySelectorAll('.option');
          var selectedOption = select.querySelector('.selected-option');
        
          // Gestisci il click sul div .custom-select
          select.addEventListener('click', function() {
            var optionList = this.querySelector('.option-list');
            optionList.classList.toggle('show');
          });
        
          // Gestisci il click su un'opzione
          options.forEach(function(option) {
            option.addEventListener('click', function() {
              selectedOption.textContent = this.textContent;
              select.setAttribute('data-value', this.getAttribute('data-value'));
            });
          });
        
          // Chiudi la lista delle opzioni quando si clicca al di fuori del .custom-select
          document.addEventListener('click', function(event) {
            if (!select.contains(event.target)) {
              select.querySelector('.option-list').classList.remove('show');
            }
          });
      });
  }
   
  
  function get_form(sezione){
    var formData = new FormData();
    var inputs = sezione.querySelectorAll('input, textarea');
    inputs.forEach(function(input) {
        if (input.getClientRects().length > 0 || input.type === 'file') {
            if (input.type === 'checkbox') {
                formData.append(input.id, input.checked);
            } else if (input.type === 'file'&& input.files.length > 0) {
                formData.append(input.id, input.files[0]);
            } else if (input.type !== 'file'){
                formData.append(input.id, input.value); 
            }
        }
    });

    var selects = sezione.querySelectorAll('.custom-select');
    selects.forEach(function(select) {
        // Check if the select is visible
        if (select.getClientRects().length > 0) {
          var datavalue = select.getAttribute('data-value');
          formData.append(select.id, datavalue); 
        }
    });
    sezione.querySelectorAll(".container-category").forEach((select) => {
      var selectedElement = $(select).select2('data');
      var valore = selectedElement[0].id; 
      console.log(valore); 
      formData.append(select.id, valore);
    });
    return formData;
  }

  function startselect2(select){
    $(select).select2({
      dropdownCssClass : 'menu_a_discesa',
      placeholder: "Seleziona...",  
      allowClear: true     
  });
  }
  

  function setMinDate() {
    var dataInizio = document.getElementById('data_inizio').value;
    document.getElementById('data_fine').setAttribute('min', dataInizio);
}

  function showAlert(className, message) {
    alert.className = className;
    alert.style.display = '';
    alert.innerHTML =
      '<button type="button" class="btn-close"></button>' + message;
    alert.querySelector(".btn-close").addEventListener("click", function () {
      alert.style.display = "none";
    });
  }

  window.onload = function() {
    var idFornitore = document.getElementById('certificazione_prodotto_approvvigionamento').getAttribute('data-id-fornitore');
    if (idFornitore) {
        var options = document.querySelectorAll('.option');
        for (var i = 0; i < options.length; i++) {
            if (options[i].getAttribute('data-value') == idFornitore) {
                options[i].click();
                break;
            }
        }
        var inputs = document.querySelectorAll('#myform input');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].disabled = true;
        }
        document.getElementById('btnfornitore').disabled = true;
        var divFornitori = document.getElementById('certificazione_prodotto_approvvigionamento');
        divFornitori.style.opacity = '0.5';
        divFornitori.style.pointerEvents = 'none';
        document.body.click();
    }
  };
  function cercaPaese() {
    const paese = document.getElementById('paese').textContent;
    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(() => drawChart(paese));
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${paese}`;
  
    fetch(geocodeUrl)
      .then(response => response.json())
      .then(data => {
        if (data.length > 0) {
          const location = data[0];
          const lat = location.lat;
          const lon = location.lon;
          const boundingbox = location.boundingbox;
          const zoom = calcolaZoom(boundingbox);
          mostraMappa(lat, lon, zoom);
        } else {
          alert('Errore nella ricerca delle coordinate.');
        }
      })
      .catch(error => console.error('Errore:', error));
  }

  function getBoundingBox(coordinates) {
    let minLat = Number.MAX_VALUE, maxLat = -Number.MAX_VALUE;
    let minLon = Number.MAX_VALUE, maxLon = -Number.MAX_VALUE;

    coordinates.forEach(ring => {
        ring.forEach(coord => {
            if (coord[1] < minLat) minLat = coord[1];
            if (coord[1] > maxLat) maxLat = coord[1];
            if (coord[0] < minLon) minLon = coord[0];
            if (coord[0] > maxLon) maxLon = coord[0];
        });
    });

    return [minLat, maxLat, minLon, maxLon];
}

let map;
let geoJsonCounter = 1;  // Contatore per i file GeoJSON

function getCenter(boundingbox) {
    const lat = (boundingbox[0] + boundingbox[1]) / 2;
    const lon = (boundingbox[2] + boundingbox[3]) / 2;
    return { lat, lon };
}

function calcolaZoom(boundingbox) {
    const latDiff = Math.abs(boundingbox[1] - boundingbox[0]);
    const lonDiff = Math.abs(boundingbox[3] - boundingbox[2]);
    const maxDiff = Math.max(latDiff, lonDiff);

    if (maxDiff > 10) {
        return 5; // Zoom out for large countries
    } else if (maxDiff > 5) {
        return 6;
    } else if (maxDiff > 2) {
        return 7;
    } else {
        return 8; // Zoom in for small countries
    }
}

function mostraMappa(lat, lon, zoom) {
    if (!map) {
        map = L.map('map').setView([lat, lon], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    } else {
        map.setView([lat, lon], zoom);
    }
}

const api_key = '954a8c8b-27e1-4cbc-9229-be51cf1b9feb';
const url = 'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query/json';
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-key': api_key
};

async function getCountryISO(countryName) {
    const iso_url = `https://restcountries.com/v3.1/name/${countryName}`;
    const response = await fetch(iso_url);
    const data = await response.json();
    return data && data[0] && data[0].cca3 ? data[0].cca3 : null;
}

async function getGeoJSON(country) {
    const ISO_name = await getCountryISO(country);
    if (!ISO_name) return null;
    const geo_url = `https://raw.githubusercontent.com/johan/world.geo.json/master/countries/${ISO_name}.geo.json`;
    const response = await fetch(geo_url);
    const data = await response.json();
    return data && data.features && data.features[0] ? data.features[0].geometry : null;
}

async function getDataForYears(geojson) {
    const data = {
        "geometry": geojson,
        "sql": "SELECT umd_tree_cover_loss__year, SUM(area__ha) as area_ha FROM results WHERE umd_tree_cover_loss__year > 2014 GROUP BY umd_tree_cover_loss__year"
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });
    if (response.ok) {
        const result = await response.json();
        storedData[geoJsonCounter - 1] = result.data;
        return result.data;
    } else {
        console.error(`Errore nella richiesta: ${response.status}`);
        return null;
    }
}

async function getTreeCoverLossData(country, geojson = null) {
    if (!geojson) {
        geojson = await getGeoJSON(country);
    }
    if (!geojson) return "Errore nel recupero delle coordinate GeoJSON.";
    const data = await getDataForYears(geojson);
    if (!data) return "Errore nel recupero dei dati.";
    const years = data.map(entry => entry.umd_tree_cover_loss__year);
    const areas = data.map(entry => entry.area_ha);
    return { years, areas };
}

async function drawChart(country) {
    const data = await getTreeCoverLossData(country);
    drawChartWithData(data, country);
}

async function drawChartWithGeoJSON(geojson) {
    const data = await getTreeCoverLossData(null, geojson);
    drawChartWithData(data, 'GeoJSON File');
}

let chart;
let chartData;
let options;
let usedColors = [];  // Lista per tracciare i colori già utilizzati

function drawChartWithData(data, title) {
    const chartDiv = document.getElementById('mappa2');

    // --- CONTROLLO DATI VUOTI (Zero Deforestazione) ---
    if (!data.years || data.years.length === 0) {
        
        // 1. Se la richiesta NON viene da un file caricato dall'utente (es. è quella automatica all'avvio)
        // non facciamo nulla e usciamo silenziosamente.
        if (title !== 'GeoJSON File') {
            console.log("Check automatico senza dati per: " + title + ". Nessuna azione intrapresa.");
            return; 
        }

        // 2. Se è un file utente, gestiamo il feedback
        console.log("Nessun dato per il file GeoJSON utente.");

        // Se non esiste ancora nessun grafico (è il primo file ed è vuoto)
        if (!chartData) {
            chartDiv.innerHTML = `
                <div class="alert alert-success" role="alert" style="margin-top: 20px; text-align: center;">
                    <h4 class="alert-heading">🌲 Ottime notizie!</h4>
                    <p>Zero deforestazione rilevata in questo lotto nel periodo 2014-2023.</p>
                    <hr>
                    <p class="mb-0">L'analisi satellitare non ha riscontrato perdita di copertura arborea nell'area del file caricato.</p>
                </div>`;
        } else {
            // Se il grafico esiste già (abbiamo caricato file precedenti validi), 
            // NON tocchiamo il div 'mappa2'. Avvisiamo solo l'utente.
            alert(`Il file appena caricato non presenta deforestazione (Zero dati). Il grafico esistente non verrà modificato.`);
        }
        return; // Usciamo per non generare errori
    }
    // ------------------------------------------------

    // Se arriviamo qui, ABBIAMO DATI validi
    if (Array.isArray(data.areas)) {
        
        // Se c'era il messaggio di "Zero deforestazione" (perché il primo file era vuoto), lo rimuoviamo per fare spazio al grafico
        if (chartDiv.innerHTML.includes("Zero deforestazione")) {
            chartDiv.innerHTML = ""; 
        }

        if (geoJsonCounter === 1 || !chartData) {
            // --- PRIMO GIRO: Inizializzazione ---
            chartData = new google.visualization.DataTable();
            chartData.addColumn('string', 'Anno');
            chartData.addColumn('number', `Lotto ${geoJsonCounter}`);
            
            data.years.forEach((year, index) => {
                chartData.addRow([year.toString(), data.areas[index]]);
            });

            options = {
                title: 'Perdita di Copertura Arborea (2014-2023)',
                width: chartDiv.offsetWidth,
                height: 400,
                hAxis: { title: 'Anno' },
                vAxis: { title: 'Area (ha)' },
                series: {},
                interpolateNulls: true
            };

            chart = new google.visualization.LineChart(chartDiv);
            usedColors = []; 
        } else {
            // --- GIRI SUCCESSIVI (Aggiunta al grafico esistente) ---
            chartData.addColumn('number', `Lotto ${chartData.getNumberOfColumns()}`);
            const columnIndex = chartData.getNumberOfColumns() - 1;
            
            data.years.forEach((year, index) => {
                const rowsFound = chartData.getFilteredRows([{ column: 0, value: year.toString() }]);
                
                if (rowsFound.length > 0) {
                    const rowIndex = rowsFound[0];
                    chartData.setValue(rowIndex, columnIndex, data.areas[index]);
                } else {
                    let newRow = new Array(chartData.getNumberOfColumns()).fill(null);
                    newRow[0] = year.toString();
                    newRow[columnIndex] = data.areas[index];
                    chartData.addRow(newRow);
                }
            });
            
             chartData.sort({column: 0, desc: false});
        }

        const newColor = getUniqueColor();
        if (!options.series) options.series = {};
        options.series[chartData.getNumberOfColumns() - 2] = { color: newColor };
        
        chart.draw(chartData, options);
    } else {
        console.error("Formato dati non valido:", data);
    }
}

function getUniqueColor() {
    const letters = '0123456789ABCDEF';
    let color;
    do {
        color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
    } while (usedColors.includes(color));
    usedColors.push(color);
    return color;
}


function getUniqueColor() {
    const letters = '0123456789ABCDEF';
    let color;
    do {
        color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
    } while (usedColors.includes(color));
    usedColors.push(color);
    return color;
}


async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) {
      showError('Nessun file selezionato!');
      return;
  }
  const reader = new FileReader();
  reader.onload = async function(event) {
      try {
          const geoJson = JSON.parse(event.target.result);
          if (geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
              throw new Error('Il file non è un GeoJSON di tipo FeatureCollection valido.');
          }

          for (const feature of geoJson.features) {
              let geometry = feature.geometry; // Usiamo 'let' per poterla modificare
              
              if (!geometry || !geometry.type || !geometry.coordinates) {
                  console.warn("Skipping invalid feature:", feature);
                  continue;
              }

              // Gestiamo i diversi tipi di geometria
              switch (geometry.type) {
                  case 'Point':
                      // NUOVA LOGICA: Trasforma il punto in un poligono di 4 ettari
                      console.log(`Trovato un 'Point', lo converto in un poligono di 4 ettari per l'analisi.`);
                      geometry = createPolygonFromPoint(geometry.coordinates, 4);
                      // Da qui in poi, il codice tratterà questo punto come un poligono.
                      // Non mettiamo 'break' per farlo eseguire dalla logica del 'Polygon'.

                  case 'Polygon':
                  case 'MultiPolygon':
                      // Questa logica ora processa sia i poligoni originali sia quelli creati dai punti.
                      const boundingbox = getBoundingBox(geometry.type, geometry.coordinates);
                      const center = getCenter(boundingbox);
                      const zoom = calcolaZoom(boundingbox);
                      mostraMappa(center.lat, center.lon, zoom);
                      
                      const layerName = `Lotto${geoJsonCounter}`;
                      // Creiamo una nuova feature GeoJSON per visualizzarla correttamente sulla mappa
                      const featureToShow = { type: 'Feature', geometry: geometry };
                      
                      const layer = L.geoJSON(featureToShow, {
                          onEachFeature: function (feat, layer) {
                              layer.bindPopup(`<b>${layerName}</b>`);
                          }
                      }).addTo(map);
                      map.fitBounds(layer.getBounds());
                      
                      await drawChartWithGeoJSON(geometry);
                      geoJsonCounter++;
                      break;

                  default:
                      console.warn(`Tipo di geometria non supportato: ${geometry.type}. Lo ignoro.`);
                      break;
              }
          }
      } catch (error) {
          showError('Errore nel file: ' + error.message);
      }
  };
  reader.onerror = function() {
      showError('Errore nella lettura del file');
  };
  reader.readAsText(file);
}



function getBoundingBox(type, coordinates) {
    let minLat = Number.MAX_VALUE, maxLat = -Number.MAX_VALUE;
    let minLon = Number.MAX_VALUE, maxLon = -Number.MAX_VALUE;

    const processRing = (ring) => {
        ring.forEach(coord => {
            if (coord[1] < minLat) minLat = coord[1];
            if (coord[1] > maxLat) maxLat = coord[1];
            if (coord[0] < minLon) minLon = coord[0];
            if (coord[0] > maxLon) maxLon = coord[0];
        });
    };

    if (type === 'Polygon') {
        // coordinates è un array di anelli, es: [[...], [...]]
        coordinates.forEach(processRing);
    } else if (type === 'MultiPolygon') {
        // coordinates è un array di poligoni, es: [[[...]], [[...]]]
        coordinates.forEach(polygon => {
            polygon.forEach(processRing);
        });
    }

    return [minLat, maxLat, minLon, maxLon];
}

function showError(message) {
    const alert2 = document.getElementById('alert2');
    alert2.className = 'alert alert-danger alert-dismissible';
    alert2.style.display = '';
    alert2.innerHTML = '<button type="button" class="btn-close"></button>' + message;
    alert2.querySelector(".btn-close").addEventListener("click", function () {
        alert2.style.display = "none";
    });
}

/**
 * Crea una geometria Polygon quadrata (in formato GeoJSON) attorno a un punto.
 * @param {Array<number>} coordinates - Le coordinate [longitudine, latitudine] del punto centrale.
 * @param {number} areaInHectares - L'area desiderata del poligono in ettari.
 * @returns {object} Una geometria GeoJSON di tipo 'Polygon'.
 */
function createPolygonFromPoint(coordinates, areaInHectares) {
    const lon = coordinates[0];
    const lat = coordinates[1];

    // 1 ettaro = 10,000 metri quadrati
    const areaInMeters = areaInHectares * 10000;
    
    // Calcola il lato di un quadrato con l'area specificata
    const sideLength = Math.sqrt(areaInMeters);
    const halfSide = sideLength / 2;

    // Calcola la conversione da metri a gradi (approssimata ma efficace per queste dimensioni)
    // Gradi di latitudine per metro: 1 / 111132
    // Gradi di longitudine per metro: 1 / (111320 * cos(latitudine in radianti))
    const latOffset = halfSide / 111132;
    const lonOffset = halfSide / (111320 * Math.cos(lat * Math.PI / 180));

    // Calcola le coordinate dei 4 vertici del quadrato
    const topLeft = [lon - lonOffset, lat + latOffset];
    const topRight = [lon + lonOffset, lat + latOffset];
    const bottomRight = [lon + lonOffset, lat - latOffset];
    const bottomLeft = [lon - lonOffset, lat - latOffset];

    // Ritorna la struttura della geometria Polygon in formato GeoJSON
    // Nota: Il primo e l'ultimo punto devono coincidere per chiudere il poligono.
    return {
        type: 'Polygon',
        coordinates: [[
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            topLeft // Chiusura del poligono
        ]]
    };
}