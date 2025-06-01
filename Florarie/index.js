const express = require('express');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const DatabaseManager = require("./database");
const db = new DatabaseManager();

(async () => {
  await db.connect();  // te conectezi la MySQL
})();

global.obGlobal = {
    obErori: null
};

function initErori() {
    const caleErori = path.join(__dirname, 'erori.json');
    const continut = fs.readFileSync(caleErori, 'utf-8');
    const ob = JSON.parse(continut);

    for (let eroare of ob.info_erori) {
        eroare.imagine = path.join(ob.cale_baza, eroare.imagine);
    }
    ob.eroare_default.imagine = path.join(ob.cale_baza, ob.eroare_default.imagine);

    obGlobal.obErori = ob;
}

global.folderScss = path.join(__dirname, 'resurse/scss');
global.folderCss = path.join(__dirname, 'resurse/css');
global.folderBackup = path.join(__dirname, 'resurse/backup');

[global.folderScss, global.folderCss, global.folderBackup].forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
});

initErori();

const app = express();
const port = 8080;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// Middleware pentru parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =================== SCSS ===================
function compilareScss(caleScss, caleCss) {
    const caleBackupCss = path.join(global.folderBackup, path.basename(caleCss));
    if (fs.existsSync(caleCss)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const caleBackupCuTimestamp = path.join(global.folderBackup, `${timestamp}_${path.basename(caleCss)}`);
        fs.copyFileSync(caleCss, caleBackupCuTimestamp);
    }

    if (path.isAbsolute(caleScss) && path.isAbsolute(caleCss)) {
        sass.render({ file: caleScss, outFile: caleCss }, function (error, result) {
            if (!error) fs.writeFileSync(caleCss, result.css);
        });
    } else {
        sass.render({
            file: path.join(global.folderScss, caleScss),
            outFile: path.join(global.folderCss, caleCss)
        }, function (error, result) {
            if (!error) fs.writeFileSync(path.join(global.folderCss, caleCss), result.css);
        });
    }
}

app.get('/compile', (req, res) => {
    compilareScss('style.scss', 'style.css');
    res.send('Compilare SCSS realizată!');
});

// =================== GALERIE GENERALĂ ===================

app.get("/galerie", (req, res) => {
  try {
    const caleJson = path.join(__dirname, "resurse/json/galerie.json");
    const continut = fs.readFileSync(caleJson, "utf-8");
    const galerie = JSON.parse(continut);

    const imagini = galerie.imagini;
    const cale_galerie = galerie.cale_galerie;

    res.render("pagini/galerie", {
      titlu: "Galerie",
      imagini,
      cale_galerie,
      pagina_css: "galerie"
    });
  } catch (err) {
    console.error("Eroare la încărcarea galeriei:", err);
    afiseazaEroare(res, 500, "Eroare server", "Nu s-a putut încărca galeria.");
  }
});

app.get("/manager-produse", (req, res) => {
  res.render("manager_produse");
});

// =================== RUTE FILTRATE ===================
app.get('/flori/:tip', async (req, res) => {
    try {
        const tipFloare = req.params.tip;
        const produse = await db.getProduseByFloare(tipFloare);
        
        res.render('pagini/galerie', {
            produse,
            filtru: `Flori: ${tipFloare}`,
            pagina_css: 'galerie'
        });
    } catch (error) {
        console.error('Eroare la filtrarea după flori:', error);
        afiseazaEroare(res, 500);
    }
});

app.get('/sarbatori/:nume', async (req, res) => {
    try {
        const numeSarbatoare = req.params.nume;
        const produse = await db.getProduseByServatore(numeSarbatoare);
        
        res.render('pagini/galerie', {
            produse,
            filtru: `Sărbătoare: ${numeSarbatoare}`,
            pagina_css: 'galerie'
        });
    } catch (error) {
        console.error('Eroare la filtrarea după sărbători:', error);
        afiseazaEroare(res, 500);
    }
});

app.get('/aranjamente/:tip', async (req, res) => {
    try {
        const tipAranjament = req.params.tip;
        const produse = await db.getProduseByAranjament(tipAranjament);
        
        res.render('pagini/galerie', {
            produse,
            filtru: `Aranjament: ${tipAranjament}`,
            pagina_css: 'galerie'
        });
    } catch (error) {
        console.error('Eroare la filtrarea după aranjamente:', error);
        afiseazaEroare(res, 500);
    }
});

// =================== RUTĂ PRODUS ===================
app.get("/produs/:id", async (req, res) => {
  try {
    const produs = await db.getProdusByID(req.params.id);
    if (!produs) {
      return res.status(404).render("eroare", { mesaj: "Produs inexistent" });
    }

    const disponibil = await db.isProdusDisponibil(produs.id);
    console.log(">>> Produs disponibil:", disponibil);

    res.render("produs", { produs, disponibil, pagina_css: "produs" });

  } catch (err) {
    console.error("Eroare la încărcarea produsului:", err);
    res.status(500).render("eroare", { mesaj: "Nu s-a putut încărca produsul." });
  }
});

// =================== API ENDPOINTS ===================
// API pentru obținerea produselor
app.get("/produse", async (req, res) => {
  try {
    let produse = await db.getProduse(); // toate produsele

     const { categorie, action } = req.query;

    if (action === "sortare_cresc") {
      produse.sort((a, b) => {
        if (a.pret !== b.pret) return a.pret - b.pret;
        return a.categorie.localeCompare(b.categorie);
      });
    } else if (action === "sortare_desc") {
      produse.sort((a, b) => {
        if (a.pret !== b.pret) return b.pret - a.pret;
        return b.categorie.localeCompare(a.categorie);
      });
    }

    res.render("produse", {
      produse,
      pagina_css: "produse"
    });
  } catch (err) {
    console.error("❌ Eroare:", err);
    res.status(500).send("Eroare la afișarea produselor");
  }
});

// API pentru căutare produse
app.get('/api/cautare', async (req, res) => {
    try {
        const { tip, valoare } = req.query;
        let produse = [];

        switch (tip) {
            case 'floare':
                produse = await db.getProduseByFloare(valoare);
                break;
            case 'sarbatoare':
                produse = await db.getProduseByServatore(valoare);
                break;
            case 'aranjament':
                produse = await db.getProduseByAranjament(valoare);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Tip căutare invalid' });
        }

        res.json({ success: true, produse });
    } catch (error) {
        console.error('Eroare API căutare:', error);
        res.status(500).json({ success: false, error: 'Eroare server' });
    }
});

// API pentru statistici
app.get('/api/statistici', async (req, res) => {
    try {
        const statistici = await db.getStatistici();
        res.json({ success: true, statistici });
    } catch (error) {
        console.error('Eroare API statistici:', error);
        res.status(500).json({ success: false, error: 'Eroare server' });
    }
});

// =================== ALTE RUTE ===================
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'imagini', 'favicon.ico'));
});

app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index', {
        titlu: 'Navarre - Flori pentru orice ocazie',
        ip: req.ip,
        pagina_css: 'index'
    });
});

app.get('/despre', (req, res) => {
  res.render('pagini/despre', {
    titlu: 'Despre Navarre',
    mesaj: 'Bine ai venit pe pagina de prezentare a florăriei noastre!',
    ip: req.ip,
    pagina_css: 'despre'  // ← acest câmp e esențial dacă e apelat în `head.ejs`
  });
});

// Prevenire acces direct .ejs
app.use((req, res, next) => {
    if (req.url.toLowerCase().endsWith('.ejs')) return afiseazaEroare(res, 400);
    next();
});

// Pagini dinamice
app.get('/:pagina', (req, res) => {
    const pagina = req.params.pagina;
    const caleFisier = path.join(__dirname, 'views', 'pagini', `${pagina}.ejs`);
    fs.access(caleFisier, fs.constants.F_OK, (err) => {
        if (err) afiseazaEroare(res, 404);
        else {
            res.render(`pagini/${pagina}`, {
                titlu: `Pagina ${pagina}`,
                ip: req.ip,
                pagina_css: pagina
            });
        }
    });
});

function afiseazaEroare(res, identificator = -1, titlu, text, imagine) {
    let eroare = null;
    if (identificator !== -1) {
        eroare = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }
    if (!eroare) eroare = obGlobal.obErori.eroare_default;

    res.status(eroare.status === false ? identificator : 200).render('pagini/eroare', {
        titlu: titlu || eroare.titlu,
        text: text || eroare.text,
        imagine: imagine || eroare.imagine,
        pagina_css: 'eroare'
    });
}

app.use((err, req, res, next) => {
    console.error("EROARE SERVER:", err);
    afiseazaEroare(res, 500);
});

// Inițializare server și bază de date
async function startServer() {
    try {
        await db.connect();
        
        app.listen(port, () => {
            console.log(`Serverul rulează la http://localhost:${port}`);
            console.log('Conectat la baza de date MySQL');
            
            // Compilare SCSS la pornire
            fs.readdir(global.folderScss, (err, files) => {
                if (err) return;
                files.forEach(file => {
                    if (file.endsWith('.scss')) {
                        compilareScss(file, file.replace('.scss', '.css'));
                    }
                });
            });
        });
    } catch (error) {
        console.error('Eroare la pornirea serverului:', error);
        process.exit(1);
    }
}

// Închidere gracioasă
process.on('SIGINT', async () => {
    console.log('\nÎnchidere server...');
    await db.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nÎnchidere server...');
    await db.disconnect();
    process.exit(0);
});

startServer();