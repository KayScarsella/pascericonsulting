<?php
require 'Security/security.php';
protectPage('premium'); 

ini_set('display_errors', '1'); 
ini_set('display_startup_errors', '1'); 
error_reporting(E_ALL);

if(!(isset($_GET['id']))){
	header('Location: cerca.php');
	exit;
}

	if(isset($_GET["id"]) && (!(isset($_SESSION["ADMIN"]) && $_SESSION["ADMIN"] == "si"))){
		$sql = "SELECT v.id_utente
        FROM analisi_finale af
        JOIN analisi_preliminare_finale apf ON apf.id_analisi_finale = af.id
        JOIN analisi_preliminare ap ON apf.id_analisi_preliminare = ap.id 
        JOIN verifica_regolamento_ue v ON ap.id_verifica_regolameno_ue = v.id 
        WHERE af.id = ?";
		$stmt = $conn->prepare($sql); 
		$stmt->bind_param("i", $_GET["id"]);
		$stmt->execute();
		$result = $stmt->get_result();
		if ($result->num_rows > 0) {
			$row = $result->fetch_assoc();
			if ($row['id_utente'] == $_SESSION["username"]) {
				
			} else {
				header('Location: cerca.php');
			}
		
	}
}

?>
<!DOCTYPE html>
<html lang="en"> 
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Document</title>
	<?php
	$css_version = file_exists('style/stile.css') ? filemtime('style/stile.css') : '1'; 
	$js_version = file_exists('scripts/valutazione_finale.js') ? filemtime('scripts/valutazione_finale.js') : '1';
	$js_version1 = file_exists('scripts/updateFileName.js') ? filemtime('scripts/updateFileName.js') : '1';
	?>
	<link rel="stylesheet" href="style/stile.css?v=<?php echo $css_version; ?>">
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.0/css/all.min.css">
	<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
	<script src="https://code.jquery.com/jquery-3.6.3.min.js"></script>
	<link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-beta.1/dist/css/select2.min.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-beta.1/dist/js/select2.min.js"></script>
	<script src="scripts/valutazione_finale.js?v=<?php echo $js_version; ?>"></script>
	<script src="scripts/updateFileName.js?v=<?php echo $js_version1; ?>"></script>
	<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
	<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
	<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
</head>
<body>
<div class="logo-container" style="width: 80%; margin: auto; text-align: left;">
    <img src="style/logo-removebg-preview.png" alt="Logo" style="width: 200px; height: auto; ">
</div>
<div class="formbold-main-wrapper">
	<nav class="navbar navbar-expand-sm bg-light navbar-light" style="margin: auto; width: 80%;">
	<div class="container-fluid">
		<ul class="navbar-nav mr-auto"> <!-- Aggiunto 'mr-auto' per spingere il bottone 'Uscita' a destra -->
			<li class="nav-item">
				<a class="nav-link" href="home.php">HOME</a>
			</li>
			<li class="nav-item">
				<a class="nav-link" href="index.php">ANALISI RISCHIO</a>
			</li>
			<li class="nav-item">
				<a class="nav-link active" href="cerca.php">CERCA</a>
			</li>
			<li class="nav-item">
				<a class="nav-link" href="documenti.php">DOCUMENTAZIONE</a>
			</li>
			<li class="nav-item">
				<a class="nav-link" href="registro.php">REGISTRO</a>
			</li>
			<?php if(isset($_SESSION["ADMIN"]) && $_SESSION["ADMIN"] == "si"): ?>
            <li class="nav-item">
                <a class="nav-link" href="master.php">MASTER</a>
            </li>
            <?php endif; ?>
			<li class="nav-item">
       		 	<a class="nav-link" href="Valutazione_fornitore/cerca_fornitore.php">VALUTAZIONE FORNITORE</a>
      		</li>
		</ul>
		<!-- Aggiunto il bottone "Uscita" -->
		<ul class="navbar-nav">
			<li class="nav-item">
				<a class="nav-link" href="login.php?logout=true"><i class="fas fa-sign-out-alt"></i> USCITA</a>
			</li>
		</ul>
	</div>
	</nav>
</div>
<div class="formbold-main-wrapper">
  <div class="formbold-form-wrapper">
  		<?php
            $id_approvvigionato_specie_paesi = $_GET['id'];
            $sql = "SELECT 
			prodotti_ue.Descrizione AS 'Prodotto da verificare', 
			ue.Nome_Commerciale AS 'Nome commerciale prodotto',
			d.nome_file AS 'File del prodoto',
			ue.Riciclo AS 'Prodotto realizzato esclusivamente con materiale di recupero che ha concluso il suo ciclo di vita', 
			importazione.descrizione AS 'Procedura doganale utilizzata', 
			ue.Proprietario AS 'Legname tagliato dalla Sua Organizzazione in qualità di proprietario, gestore o utilizzatore forestale', 
			paese.Nome AS 'Paese di approvvigionamento', 
			ue.Acquistato_Furi_UE AS 'Prodotto acquistato tramite agente da organizzazione ubicata fuori UE',
			ue.identificazione_operatore AS 'Identificazione della mia organizzazione ',
			paese.Conflitti as 'Conflitti',
			af.nome as data,
			af.id_paese as paese,
			af.id_specie as cod_specie
			FROM analisi_preliminare_finale apf
			INNER JOIN analisi_preliminare ON apf.id_analisi_preliminare = analisi_preliminare.id
			INNER JOIN analisi_finale af ON apf.id_analisi_finale = af.id
			INNER JOIN verifica_regolamento_ue ue ON analisi_preliminare.id_verifica_regolameno_ue = ue.id
			LEFT JOIN prodotti_ue ON ue.Codice_UE = prodotti_ue.Codice_UE 
			LEFT JOIN paese ON ue.Paese = paese.Nome
			LEFT JOIN importazione ON ue.importazione = importazione.id
			LEFT JOIN documenti as d ON apf.id = d.tabella_id AND d.nome_tabella = 'verifica_regolamento_ue'
			JOIN specie s ON af.id_specie = s.codice
			WHERE af.id = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('s', $id_approvvigionato_specie_paesi);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
			$nomeanalisi = $row["data"];
			$paese =  $row["paese"];
			$cod_specie =  $row["cod_specie"];
			$row["data"] = null;
			$row["paese"] = null;
			$row["cod_specie"] = null;
			$paese_analisi_finale = $paese;

			$paese_verifica_regolamento = $row["Paese di approvvigionamento"] ?? null;
			$rischio1 = null;
			$rischio2 = null;
			if ($paese_analisi_finale) {
				$stmt = $conn->prepare("SELECT rischio_paese FROM paese WHERE Nome = ?");
				$stmt->bind_param("s", $paese_analisi_finale);
				$stmt->execute();
				$stmt->bind_result($rischio1);
				$stmt->fetch();
				$stmt->close();
			}
			if ($paese_verifica_regolamento) {
				$stmt = $conn->prepare("SELECT rischio_paese FROM paese WHERE Nome = ?");
				$stmt->bind_param("s", $paese_verifica_regolamento);
				$stmt->execute();
				$stmt->bind_result($rischio2);
				$stmt->fetch();
				$stmt->close();
			}
			$entrambi_basso_rischio = ($rischio1 === 'RB' && $rischio2 === 'RB');
			$valore_default = $entrambi_basso_rischio ? '2' : '4';
            ?>
		<input type="text" name="nome" id="nome_analisi" value="<?php echo $nomeanalisi ?>" style="width: 100%;  color: #967635;">
	</div>
</div>
<div class="formbold-main-wrapper">
  <div class="formbold-form-wrapper" id="content">
	<h5>A ) DATI RELATIVI ALLA FORNITURA <button id="toggleButtonA" class="toggleButton"><i class="fas fa-chevron-up"></i></button></h5>
	<div id="contentBodyA" class="contentBody">
	<?php
		$conflitti = "";
		$classe = 0;
		$count = 1;
		foreach ($row as $campo => $valore) {
			if (!is_null($valore)) {
				if(($campo === "Conflitti")&&( $valore==0)){
					$conflitti = "Per questo Paese non sono ad oggi previste sanzioni specifiche";
					$classe = $valore;
				}elseif(($campo === "Conflitti")&& ($valore==1)){
					$conflitti = "Per il Paese di origine del materiale sono previste delle sanzioni dell'Unione Europea o delle Nazioni Unite che impediscono l'acquisto";
					$classe = $valore;
				}else{
					echo "<div class='formbold-mb-3 row '>";
					echo "<div class='col-sm-6'>";
					echo "<label class='formbold-form-label'>".$count.")  " . $campo . "</label>";
					echo "</div>";
					echo "<div class='col-sm-6'>";
					echo "<label class='formbold-form-label'>";
					echo htmlspecialchars($valore);
					echo "</label>";
					echo "</div>";
					echo "</div>";
					$count ++;
				}
			}
		}
?>
	</div>
  </div>
</div>

<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
		<h5 >B ) INFORMAZIONI PRELIMINARI <button id="toggleButtonB" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
		<div id="contentBodyB" class="contentBody">
		<label id="conflitti" class="formbold-form-label <?php echo $classe ?>"><?php echo $conflitti ?></label><br>
			<?php
			$sql = "SELECT
					ap.regolamento_FLEGT AS `1) La fornitura è accompagnata da documenti di conformità al regolamento FLEGT e alle sue disposizioni di esecuzione`,
					d1.nome_file AS `file_1) La fornitura è accompagnata da documenti di conformità al regolamento FLEGT e alle sue disposizioni di esecuzione`,
					ap.Reg_CE_407_2009_CITES AS `2) Il prodotto è realizzato esclusivamente con specie che rientrano tutte negli allegati del Reg. CE 407/2009 (CITES) e la fornitura è accompagnata da documenti di autorizzazione validi e completi per tutte le specie componenti. Verificare il database`,
					d2.nome_file AS `file_2) Il prodotto è realizzato esclusivamente con specie che rientrano tutte negli allegati del Reg. CE 407/2009 (CITES) e la fornitura è accompagnata da documenti di autorizzazione validi e completi per tutte le specie componenti. Verificare il database`,
					ap.certificato_terzi AS `4) È presente un certificato in corso di validità relativo alla legalità del legname emesso da un Ente di terza parte (FSC O PEFC Ecc), che comprende il prodotto oggetto dell'approvvigionamento nel campo di applicazione`,
					d3.nome_file AS `file_4) È presente un certificato in corso di validità relativo alla legalità del legname emesso da un Ente di terza parte (FSC O PEFC Ecc), che comprende il prodotto oggetto dell'approvvigionamento nel campo di applicazione`,
					ap.certificazione_prodotto_approvvigionamento AS `5) La certificazione è riferita nello specifico al prodotto oggetto dell'approvvigionamento ed è attestata nei documenti di fornitura del fornitore della Sua Organizzazione`
				FROM analisi_preliminare ap
				JOIN analisi_preliminare_finale ON ap.id = analisi_preliminare_finale.id_analisi_preliminare
				JOIN analisi_finale af ON af.id = analisi_preliminare_finale.id_analisi_finale
				LEFT JOIN documenti d1 ON ap.id = d1.tabella_id AND d1.nome_tabella = 'analisi_preliminare' AND d1.colonna = 'regolamento_FLEGT'
				LEFT JOIN documenti d2 ON ap.id = d2.tabella_id AND d2.nome_tabella = 'analisi_preliminare' AND d2.colonna = 'Reg_CE_407_2009_CITES'
				LEFT JOIN documenti d3 ON ap.id = d3.tabella_id AND d3.nome_tabella = 'analisi_preliminare' AND d3.colonna = 'certificato_terzi'
				WHERE af.id = ?";
			$stmt = $conn->prepare($sql);
            $stmt->bind_param('i', $id_approvvigionato_specie_paesi);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
				
			foreach ($row as $campo => $valore) {
				if (!is_null($valore) && strpos($campo, 'file_') === false) {
					echo "<div class='formbold-mb-3 row '>";
					echo "<div class='col-sm-6'>";
					echo "<label class='formbold-form-label'>" . $campo . "</label>";
					echo "</div>";
					echo "<div class='col-sm-2'>";
					echo "<label class='formbold-form-label'>";
					echo htmlspecialchars($valore);
					echo "</label>";
					echo "</div>";
					if (isset($row['file_' . $campo])) {
						echo "<div class='col-sm-4'>";
						echo "<label class='formbold-form-label'>";
						echo htmlspecialchars($row['file_' . $campo]);
						echo "</label>";
						echo "</div>";
					}
					echo "</div>";
				}
			}
			?>
		</div>
  </div>
</div>

<div class="formbold-main-wrapper" id="contentMainC">
	<div class="formbold-form-wrapper">
	<h5>C ) DATI FORNITORE <button id="toggleButtonC" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyC" class="contentBody show-content">
		<label for="">
		Selezionare un fornitore dal menu a tendina. Se il fornitore non risultasse in archivio, inserire i dati del nuovo fornitore e premere il pulsante "Salva Fornitore" per salvarlo in archivio.
		</label>
		<form id="myform">
<div class="formbold-input-wrapp formbold-mb-3 row">
    <div class="col-sm-6">
        <label class="formbold-form-label"><strong>Seleziona Fornitore</strong></label>
    </div>
    <?php
        $id = $_GET["id"];
        if ($stmt = $conn->prepare("SELECT id_fornitore FROM analisi_finale WHERE id = ?")) {
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows == 1) {
                $row = $result->fetch_assoc();
            } else {
                $row["id_fornitore"] = null;
            }
            $stmt->close();
        }

    ?>
    <div class="formbold-form-input custom-select col-sm-3" id="certificazione_prodotto_approvvigionamento" data-id-fornitore="<?php echo $row['id_fornitore']; ?>">
        <div class="selected-option">Seleziona...</div>
        <?php
			if (isset($_SESSION["ADMIN"]) && $_SESSION["ADMIN"] == "si") {
				$stmt = $conn->query("SELECT * FROM fornitore");
			} else {
				$username = $_SESSION["username"]; // Supponendo che il nome utente sia memorizzato nella sessione
				$stmt = $conn->prepare("SELECT * FROM fornitore WHERE utente = ?");
				$stmt->bind_param("s", $username);
				$stmt->execute();
				$stmt = $stmt->get_result();
			}
            echo '<ul class="option-list list">';
            while ($row = $stmt->fetch_assoc()) {
                echo '<li class="option" onclick="generate_fornitore(this)" data-value="' . $row['id'] . '">' . $row['Nome_Fornitore'] . '</li>';
            }
            echo '</ul>';
        ?>
    </div>
</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Nome Fornitore</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Nome_Fornitore"
				id="Nome_Fornitore"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				required
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Partita IVA</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="P_IVA"
				id="P_IVA"
				placeholder="numero di Partita IVA"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>EORI</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="EORI"
				id="EORI"
				placeholder="EORI"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Indirizzo</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Indirizzo"
				id="Indirizzo"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Telefono</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Telefono"
				id="Telefono"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Email</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Email"
				id="Email"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				required
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Sito web</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Sito_web"
				id="Sito_web"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
			<div class="col-sm-6">
				<label class="formbold-form-label"><strong>Referente</strong></label>
			</div>
			<div class="col-sm-3">
				<input
				type="text"					
				name="Referente"
				id="Referente"
				placeholder="Nome commerciale"
				class="formbold-form-input"
				/>
			</div>
		</div>
		<button class="formbold-btn formbold-mb-3" id="btnfornitore">Salva Fornitore</button>
	</form>
	</div>
	</div>
</div>
<div id="BIGform">
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>D ) DATI SPECIE<button id="toggleButtonD" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyD" class="contentBody show-content">
	<form id="formD">
		<div class="formbold-input-wrapp formbold-mb-3 row ">
			<div class="col-sm-5">
				<label class="formbold-form-label">1)  Nome della specie</label>
			</div>
			<div class="col-sm-4">
				<select class="form-control container-category" id="NomeSpecie"> 
					<?php
						$stmt = $conn->prepare("SELECT id_specie FROM analisi_finale WHERE id = ?");
						$stmt->bind_param("i", $id_approvvigionato_specie_paesi);
						$stmt->execute();
						$result = $stmt->get_result();
						$row = $result->fetch_assoc();
						$id_specie =  $row["id_specie"];
						$sql = "SELECT Codice, Nome_Comune, Nome_Scentifico FROM specie";
						$result = $conn->query($sql);
						while ($row = $result->fetch_assoc())
						{
							$selected = ($row['Codice'] == $id_specie) ? 'selected' : '';
							echo '<option value="' . $row['Codice'] . '" ' . $selected . '>' . $row['Nome_Comune'] . ' - ' . $row['Nome_Scentifico'] . '</option>';
						}
					?>
				</select>
			</div>
		</div>
		<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-5">
							<label class="formbold-form-label">2)	Quantità</label>
					</div>
					<div class="col-sm-1">
					<input
						type="number"
						value="0.0"
						class="formbold-form-input"
						name="Quantita"
						id="Quantita"
						/>
					</div>
					<div class="formbold-form-input custom-select col-sm-2" id="Misura" data-value="kg">
							<div class="selected-option">kg</div>
								<ul class="option-list list">
								<li class="option" data-value="m2">m2</li>
								<li class="option" data-value="m3">m3</li>
								<li class="option" data-value="it">it</li>
								<li class="option" data-value="kg">kg</li>
								<li class="option" data-value="q.li">q.li</li>
								<li class="option" data-value="ton">ton</li>
								<li class="option" data-value="num. pezzi">num. pezzi</li>
								</ul>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						id="file_quantita"
						class="formbold-form-input"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_quantita">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
	</form>
	</div>
	</div>
</div>
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>E ) DATI RELATIVI AL PAESE DI RACCOLTA DEL LEGNAME<button id="toggleButtonE" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyE" class="contentBody show-content">
	<label for="">
	I dati sono compilati automaticamente dal sistema. Se si desidera modificarli è possibile farlo precisando le motivazioni. I dati predefiniti sono evidenziati in giallo nei menu a tendina.	
	</label>
	<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">1)	Paese di raccolta del legname</label>
					</div>
					<div class="col-sm-3">
						<label class="formbold-form-label" id="paese"><?php echo $paese; ?></label>
					</div>
				</div>

				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">2)	rischio paese</label>
					</div>
					<?php
						$stmt1 = $conn->prepare("SELECT paese.*, rischio_paese.Descrizione as Descrizione_Rischio, rischio_paese.Codice as Codice
            				FROM paese,rischio_paese
            				WHERE paese.rischio_paese = rischio_paese.Codice
            				AND Nome = ?");
						$stmt1->bind_param("s", $paese);
						$stmt1->execute();
						$result1 = $stmt1->get_result();
						if ($result1->num_rows == 1) {
							$paese2 = $result1->fetch_assoc();
						}
						$stmt = $conn->prepare("SELECT Codice, Descrizione FROM rischio_paese ORDER BY Ordine ASC");
						$stmt->execute();
						$result = $stmt->get_result();
						echo '<div class="formbold-form-input custom-select col-sm-3" id="rischio_paese" data-value="' . $paese2["Codice"] . '">';
						echo '<div class="selected-option">'.$paese2["Descrizione_Rischio"].'</div>';
						echo '<ul class="option-list list">';
						while ($row = $result->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_rischio_paese"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_rischio_paese">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div id="map" style="height: 600px; width: 50%;" class="col-sm-6">
					</div>
					<div id="mappa2" class="col-sm-6 d-flex flex-column">
						
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div id="info" class="col-sm-6">
					<label class="formbold-form-label">Inserisci il file GeoJSON con le cordinate del punto di raccolta</label>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_GeoJSON"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_GeoJSON">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div id="alert2" style="display: none;"></div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
				<div class="col-sm-5">
					<label class="formbold-form-label">3) intervallo tempo di produzione (Data di inizio e Data di fine)</label>
				</div>
				<div class="col-sm-2">
					<input
						type="date"
						name="data_inizio"
						id="data_inizio"
						placeholder="Data di inizio"
						class="formbold-form-input"
						onchange="setMinDate()"
					/>
				</div>
				<div class="col-sm-2">
					<input
						type="date"
						name="data_fine"
						id="data_fine"
						placeholder="Data di fine"
						class="formbold-form-input"
					/>
				</div>
				<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_periodo_produzione"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_periodo_produzione">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
			</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">4)	la specie di cui è composto il prodotto proviene da una foresta di origine primaria, Foresta Rigenerata, da una piantagione forestale o altri terreni boschivi?</label>
					</div>				
						<div class="formbold-form-input custom-select col-sm-3" id="Origine_Foresta">
						<div class="selected-option">Seleziona...</div>
						<ul class="option-list list">				
							<li class="option" data-value="foresta primaria">foresta primaria</li>
							<li class="option" data-value="foresta piantate">foresta piantate</li>
							<li class="option" data-value="piantagione">piantagione</li>
							<li class="option" data-value="terreni boschivi">terreni boschivi</li>
						</ul>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_Origine_Foresta"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_Origine_Foresta">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
				<div class="col-sm-6">
					<label class="formbold-form-label">5) FAO Naturally regenerating forest ANNEX2 2010\2020</label>
				</div>
				<div class="col-sm-3">
					<?php
					$sql = "SELECT fao FROM paese WHERE nome = ?";
					$stmt = $conn->prepare($sql);
					$stmt->bind_param("s", $paese);
					$stmt->execute();
					$result = $stmt->get_result();
					if ($row = $result->fetch_assoc()) {
						$valore_fao = $row["fao"];
					} else {
						$valore_fao = "";
					}
					?>
					<input
						type="number"
						name="fao"
						id="fao"
						value="<?php echo $valore_fao; ?>"
						placeholder="inserisci il valore fao"
						class="formbold-form-input"
						required
					/>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">6)	Non è prevista nessuna trasformazione della foresta o piantagione ad uso agricolo dal 31 dicembre 2020</label>
					</div>
					<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="trasformazione_foresta_uso_agricolo">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_trasformazione_foresta_uso_agricolo"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_trasformazione_foresta_uso_agricolo">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">7)	Dal 31 dicembre 2020 non si registra alcun degrado delle foreste</label>
					</div>
					<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="degrado_foreste_2020">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_degrado_foreste_2020"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_degrado_foreste_2020">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>		
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">8)	Sono presenti conflitti nel paese/regione subnazionale di raccolta, che coinvolgono la raccolta del legname</label>
					</div>
						<?php
						$stmt = $conn->prepare("SELECT Conflitti FROM paese WHERE Nome = ?");
						$stmt->bind_param("s", $paese);
						$stmt->execute();
						$result = $stmt->get_result();
						$row = $result->fetch_assoc();
						$Conflitti = $row["Conflitti"];
						if($Conflitti == "1"){
							echo '<div class="formbold-form-input custom-select col-sm-3" data-value="si" id="ConflittiPresenti">';
							echo '<div class="selected-option">si</div>';
						}else{
							echo '<div class="formbold-form-input custom-select col-sm-3" data-value="no" id="ConflittiPresenti">';
							echo '<div class="selected-option">no</div>';
						}
						?>
						<ul class="option-list list">
							<li class="option" data-value="si">si</li>
							<li class="option" data-value="no">no</li>
						</ul>
					</div>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_ConflittiPresenti"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_ConflittiPresenti">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
	</div>
	</div>
</div>
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>F ) INFORMAZIONI RELATIVE ALLO STATO SOCIALE E DIRITTI DI TERZI<button id="toggleButtonF" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyF" class="contentBody show-content">
		<form id="formF">
		<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">1)	Sono rispettati i requisiti legali relativi alla salute e alla sicurezza sul lavoro</label>
					</div>
					<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="requisiti_sicurezza_lavoro">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_requisiti_sicurezza_lavoro"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_requisiti_sicurezza_lavoro">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>	
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">2)	I diritti umani tutelati dal diritto internazionale, così come sanciti dal diritto nazionale, vengono rispettati.</label>
					</div>
					<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="diritti_umani_rispettati">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_diritti_umani_rispettati"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_diritti_umani_rispettati">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">3)	I diritti dei Popoli Tradizionali, popolazioni indigene e le comunità locali, compresi il possesso e la gestione della terra, sono rispettati e sostenuti secondo i principi della FPIC.</label>
					</div>
					<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="diritti_popoli_FPIC">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_diritti_popoli_FPIC"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_diritti_popoli_FPIC">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">4)	Esistono segnalazioni debitamente motivate delle popolazioni indigene, le popolazioni tradizionali e le comunità locali basate su informazioni oggettive e verificabili riguardanti l’uso o la proprietà della superficie utilizzata ai fini della produzione della materia prima Interessata</label>
					</div>
					<div class="formbold-form-input custom-select col-sm-3" id="segnalazioni_popoli_indigeni">
							<div class="selected-option">Seleziona...</div>
							<ul class="option-list list">
							<li class="option" data-value="si">si</li>
							<li class="option" data-value="no">no</li>
							<li class="option" data-value="non applicabile">non applicabile</li>
							</ul>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_segnalazioni_popoli_indigeni"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_segnalazioni_popoli_indigeni">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">5) Indice di Percezione della Corruzione (CPI)</label>
					</div>
					<div class="col-sm-3">
						<?php
						$sql = "SELECT cpi FROM paese WHERE nome = ?";
						$stmt = $conn->prepare($sql);
						$stmt->bind_param("s", $paese);
						$stmt->execute();
						$result = $stmt->get_result();
						if ($row = $result->fetch_assoc()) {
							$valore_cpi = $row["cpi"];
						} else {
							$valore_cpi = "";
						}
						?>
						<input
							type="number"
							name="cpi"
							id="cpi"
							value="<?php echo $valore_cpi; ?>"
							placeholder="inserisci il valore cpi"
							class="formbold-form-input"
							required
						/>
					</div>
				</div>	
	</form>
	</div>
	</div>
</div>
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>G ) INFORMAZIONI RELATIVE ALLA LEGISLAZIONE APPLICABILE NEL PAESE DI RACCOLTA<button id="toggleButtonG" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyG" class="contentBody show-content">
		<form id="formG">
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">1)	esistenza di evidenze sui diritti d’uso del suolo</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="evidenze_uso_suolo">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						?>
					</div>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_evidenze_uso_suolo"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_evidenze_uso_suolo">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">2)	Esistenza di evidenze sui diritti di tutela dell’ambiente</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="evidenze_tutela_ambiente">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_evidenze_tutela_ambiente"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_evidenze_tutela_ambiente">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">3)	esistenza di evidenza su norme relative alle foreste, comprese la gestione delle foreste e la conservazione della biodiversità, ove direttamente connesse alla raccolta del legno</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="evidenze_norme_foreste">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_evidenze_norme_foreste"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_evidenze_norme_foreste">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">4)	informazioni adeguatamente probanti e verificabili secondo cui le materie prime interessate sono state prodotte nel rispetto della legislazione pertinente del paese di produzione, compresi eventuali accordi che conferiscono il diritto di adibire l’area specifica alla produzione della materia prima interessata.</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="rispetto_legislazione">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_rispetto_legislazione"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_rispetto_legislazione">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">5)	esistenza di evidenze su leggi applicabili nel paese di produzione per quanto riguarda lo status giuridico della zona di produzione in termini di: disciplina fiscale, sull’anticorruzione, commerciale e doganale.</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="leggi_status_giuridico">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_leggi_status_giuridico"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_leggi_status_giuridico">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">6)	esistenza di informazioni adeguatamente probanti e verificabili secondo cui i prodotti interessati sono a deforestazione zero</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="deforestazione_zero">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_deforestazione_zero"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_deforestazione_zero">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">7)	preoccupazioni inerenti al paese di produzione e di origine o a parti di esso, ad esempio a livello di corruzione, diffusione di pratiche di falsificazione di documenti e dati, carenze nell’applicazione della legge</label>
					</div>
						<?php
						echo '<div class="formbold-form-input custom-select col-sm-3" data-value="' . $valore_default . '" id="preoccupazioni_produzione_origine">';
						$stmt = $conn->query("SELECT Codice, Descrizione FROM dati_legali");
						echo '<div class="selected-option">' . ($entrambi_basso_rischio ? 'affidabilità medio alta' : 'affidabilità medio bassa') . '</div>';
						echo '<ul class="option-list list">';						
						while ($row = $stmt->fetch_assoc()) {
							echo '<li class="option" data-value="' . $row['Codice'] . '">' . $row['Descrizione'] . '</li>';
						}
						echo '</ul>';
						echo '</div>';
						?>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_preoccupazioni_produzione_origine"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_preoccupazioni_produzione_origine">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
	</form>
	</div>
	</div>
</div>
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>H ) INFORMAZIONI RELATIVE ALLA CATENA DI APPROVVIGIONAMENTO<button id="toggleButtonH" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyH" class="contentBody show-content">
		<form id="formH">
			<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">1)	Sono noti tutti i passaggi di proprietà e di destinazione di tutte le specie legnose utilizzate nel prodotto fino al luogo di raccolta del legname</label>
					</div>
					<div class="formbold-form-input custom-select col-sm-3" id="PassaggiProprietaConosciuti">
							<div class="selected-option">Seleziona...</div>
							<ul class="option-list list">
							<li class="option" data-value="si">si</li>
							<li class="option" data-value="no">no</li>
							</ul>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_PassaggiProprietaConosciuti"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_PassaggiProprietaConosciuti">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>

				<div class="formbold-input-wrapp formbold-mb-3 row ">
					<div class="col-sm-6">
						<label class="formbold-form-label">2)	E' possibile avere ragionevole sicurezza circa il non mescolamento dei materiali oggetto di analisi con altri materiali in tutta la catena di fornitura?</label>
					</div>
					<div class="formbold-form-input custom-select col-sm-3" id="SicurezzaNonMescolamento">
						<div class="selected-option">Seleziona...</div>
							<ul class="option-list list">
							<li class="option" data-value="si">si</li>
							<li class="option" data-value="no">no</li>
							</ul>
					</div>
					<div class="col-sm-3">
						<input
						type="file"
						name="lastname"
						id="file_SicurezzaNonMescolamento"
						class="formbold-form-input file_prodotto"
						style="display: none;"
						onchange="updateFileName(this)"
						/>
						<label for="file_SicurezzaNonMescolamento">
							<i class="fa fa-upload"></i>  
						</label>
						<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>	
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
							<label class="formbold-form-label">3)	Relativamente ai paesi di raccolta del legname, di transito o ai fornitori sono in vigore sanzioni imposte dal Consiglio di sicurezza delle Nazioni Unite o dal Consiglio dell'Unione europea sulle importazioni o esportazioni di legno</label>
					</div>
					<div class="formbold-form-input custom-select col-sm-3" id="SanzioniInVigore">
							<div class="selected-option">Seleziona...</div>
								<ul class="option-list list">
								<li class="option" data-value="si">si</li>
								<li class="option" data-value="no">no</li>
								</ul>
					</div>
					<div class="col-sm-3">
							<input
							type="file"
							name="lastname"
							id="file_SanzioniInVigore"
							class="formbold-form-input file_prodotto"
							style="display: none;"
							onchange="updateFileName(this)"
							/>
							<label for="file_SanzioniInVigore">
								<i class="fa fa-upload"></i>  
							</label>
							<span class="file_name"></span>
						<button onclick="removeFile(this,event)"class="remove-button">Rimuovi file</button>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">4)	Numero di imprese extra-europee presenti nella catena di approvvigionamento</label>
					</div>
					<div class="col-sm-3">
							<input
							type="number"
							name="lastname"
							id="NumeroImpreseExtraEuropee"
							class="formbold-form-input"
							/>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">5)	numero di paesi extra- europei in cui non è avvenuto il taglio degli alberi (origine del legno), ma lavorazioni del legno o cambi di possesso fisico della merce.</label>
					</div>
					<div class="col-sm-3">
							<input
							type="number"
							name="lastname"
							id="PaesiExtraEuropeiLavorazioneLegno"
							class="formbold-form-input"
							/>
					</div>
				</div>
		</form>
	</div>
	</div>
</div>
<div class="formbold-main-wrapper">
	<div class="formbold-form-wrapper">
	<h5>I ) INFORMAZIONI RELATIVE AL COMMENTO DEL VALUTATORE<button id="toggleButtonI" class="toggleButton"><i class="fas fa-chevron-down"></i></button></h5>
	<div id="contentBodyI" class="contentBody show-content">
		<form id="formI">
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">3)	commento del valutatore</label>
					</div>
					<div class="col-sm-6">
							<textarea
							name="commento_valutatore"
							id="commento_valutatore"
							class="formbold-form-input"
							style="height: 100px; width: 100%;"
						></textarea>
					</div>
				</div>
				<div class="formbold-input-wrapp formbold-mb-3 row">
					<div class="col-sm-6">
						<label class="formbold-form-label">4)	eventuali azioni di mitigazioni previste</label>
					</div>
					<div class="col-sm-6">
							<textarea
							name="azioni_mitigazioni_previste"
							id="azioni_mitigazioni_previste"
							class="formbold-form-input"
							style="height: 100px; width: 100%;"
						></textarea>
					</div>
				</div>		
		</form>
	</div>
	</div>
</div>
<div class="formbold-form-wrapper" style="background: transparent; padding:0px;  border:none;">
	<div id="alert"></div>
	<button class="formbold-btn formbold-mb-3" id="btnform">Salva</button>
</div>
</div>
</body>
</html>