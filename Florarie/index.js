const express = require('express');
const fs = require('fs');
const path = require('path');

global.obGlobal = {
    obErori: null
};

// ====== Inițializare erori ======
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

// ====== Crează foldere dacă nu există ======
const vect_foldere = ['temp'];
for (let folder of vect_foldere) {
    const caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        console.log(`Folder creat: ${folder}`);
    }
}

initErori();

const app = express();
const port = 8080;

// ===== CONFIGURĂRI =====
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ===== FIȘIERE STATICE =====
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// ===== CITEȘTE GALERIE O SINGURĂ DATĂ =====
const galerie = JSON.parse(fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf-8'));

// ===== RUTE =====
app.get('/galerie', (req, res) => {
    const galerie = JSON.parse(fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf-8'));

    const acum = new Date();
    const oraCurenta = acum.getHours() + acum.getMinutes() / 60;

    let imaginiFiltrate = galerie.imagini.filter(imagine => {
        if (!imagine.timp) return false;
        const [start, end] = imagine.timp.split('-').map(str => {
            const [h, m] = str.split(':').map(Number);
            return h + m / 60;
        });
        return start <= oraCurenta && oraCurenta <= end;
    });

    // ======= Fallback dacă nu găsește imagini =======
    if (imaginiFiltrate.length === 0) {
        imaginiFiltrate = galerie.imagini;
    }
    // ================================================

    // Limităm la maxim 10 imagini
    imaginiFiltrate = imaginiFiltrate.slice(0, 12);

    res.render('pagini/galerie', {
        cale_galerie: galerie.cale_galerie,
        imagini: imaginiFiltrate,
        pagina_css: 'galerie'
    });
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'imagini', 'favicon.ico'));
});

// ===== RUTE PRINCIPALE =====
app.get(['/', '/index', '/home'], (req, res) => {
    res.render('pagini/index', {
        titlu: 'Navarre - Flori pentru orice ocazie',
        ip: req.ip,
        pagina_css: 'index'
    });
});

// ===== PAGINA DESPRE =====
app.get('/despre', (req, res) => {
    res.render('pagini/despre', {
        titlu: 'Despre Navarre',
        mesaj: 'Bine ai venit pe pagina de prezentare a florăriei noastre!',
        ip: req.ip,
        pagina_css: 'despre'
    });
});

// ===== INTERZICERE ACCES .ejs DIRECT =====
app.use((req, res, next) => {
    if (req.url.toLowerCase().endsWith('.ejs')) {
        return afiseazaEroare(res, 400);
    }
    next();
});

// ===== RUTĂ ERROARE 403 =====
app.get('/eroare403', (req, res) => {
    afiseazaEroare(res, 403);
});

// ===== PAGINI DINAMICE =====
app.get('/:pagina', (req, res) => {
    const pagina = req.params.pagina;
    const caleFisier = path.join(__dirname, 'views', 'pagini', `${pagina}.ejs`);

    fs.access(caleFisier, fs.constants.F_OK, (err) => {
        if (err) {
            afiseazaEroare(res, 404);
        } else {
            res.render(`pagini/${pagina}`, {
                titlu: `Pagina ${pagina}`,
                ip: req.ip,
                pagina_css: pagina // presupunem că există CSS cu numele paginii
            });
        }
    });
});

// ===== FUNCȚIE GENERALĂ DE EROARE =====
function afiseazaEroare(res, identificator = -1, titlu, text, imagine) {
    let eroare = null;

    if (identificator !== -1) {
        eroare = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
    }

    if (!eroare) {
        eroare = obGlobal.obErori.eroare_default;
    }

    const titluFinal = titlu || eroare.titlu;
    const textFinal = text || eroare.text;
    const imagineFinal = imagine || eroare.imagine;

    res.status(eroare.status === false ? identificator : 200).render('pagini/eroare', {
        titlu: titluFinal,
        text: textFinal,
        imagine: imagineFinal,
        pagina_css: 'eroare' // ca să poți stiliza eroarea separat dacă vrei
    });
}

// ===== ERORI SERVER (500) =====
app.use((err, req, res, next) => {
    console.error("EROARE SERVER:", err);
    afiseazaEroare(res, 500);
});

// ===== PORNEȘTE SERVERUL =====
app.listen(port, () => {
    console.log(`Serverul rulează la adresa http://localhost:${port}`);
});
